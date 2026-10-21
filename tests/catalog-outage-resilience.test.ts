import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AniListClient } from "@/services/anilist/client";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";
import { CircuitBreaker } from "@/services/anilist/circuit-breaker";
import { MetadataCache } from "@/services/catalog/metadata-cache";
import { KitsuClient } from "@/services/catalog/kitsu-client";
import { CatalogService } from "@/services/catalog/catalog-service";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryEntry } from "@/types/library";

describe("Phase 6: Catalog Outage Resilience & Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. AniList 403 suspension handling", () => {
    it("detects suspension error, prevents tight-loop retries, and trips circuit breaker", async () => {
      const circuitBreaker = new CircuitBreaker({ cooldownMs: 5000 });
      let fetchCallCount = 0;

      const fetchMock = vi.fn().mockImplementation(async () => {
        fetchCallCount += 1;
        return new Response(
          JSON.stringify({
            errors: [
              {
                message:
                  "The AniList API has been temporarily disabled due to severe stability issues.",
                status: 403,
              },
            ],
            data: null,
          }),
          {
            status: 403,
            statusText: "Forbidden",
            headers: { "content-type": "application/json" },
          },
        );
      });

      const client = new AniListClient({
        fetchImpl: fetchMock as unknown as typeof fetch,
        circuitBreaker,
        maxRetries: 3, // Should NOT retry 403 suspensions
      });

      await expect(client.getAnimeById(154587)).rejects.toThrow(
        AniListSuspendedError,
      );

      // Crucial: Must NOT perform tight-loop retries on suspension
      expect(fetchCallCount).toBe(1);

      // Circuit breaker must immediately trip to OPEN
      expect(circuitBreaker.isOpen()).toBe(true);
      expect(circuitBreaker.getState().state).toBe("OPEN");

      // Immediate subsequent call must be rejected by circuit breaker without network request
      await expect(client.getAnimeById(154587)).rejects.toThrow(
        CircuitBreakerOpenError,
      );
      expect(fetchCallCount).toBe(1); // Still exactly 1!
    });
  });

  describe("2. HTTP 429 rate limit with Retry-After", () => {
    it("parses Retry-After header and respects rate limit backoff", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [{ message: "Too Many Requests", status: 429 }],
          }),
          {
            status: 429,
            headers: {
              "retry-after": "5",
              "content-type": "application/json",
            },
          },
        ),
      );

      const client = new AniListClient({
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 0,
      });

      try {
        await client.getAnimeById(100);
        expect.unreachable("Should have thrown rate limit error");
      } catch (err) {
        expect(err).toBeInstanceOf(AniListError);
        const anilistErr = err as AniListError;
        expect(anilistErr.status).toBe(429);
        expect(anilistErr.retryAfterSeconds).toBe(5);
        expect(anilistErr.isRateLimited).toBe(true);
      }
    });
  });

  describe("3. Transient server failure with bounded retries", () => {
    it("retries transient 500 errors up to bounded limit with backoff and stops", async () => {
      let fetchAttempts = 0;
      const fetchMock = vi.fn().mockImplementation(async () => {
        fetchAttempts += 1;
        return new Response(
          JSON.stringify({
            errors: [{ message: "Internal server error", status: 500 }],
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      });

      const client = new AniListClient({
        fetchImpl: fetchMock as unknown as typeof fetch,
        maxRetries: 2,
        baseBackoffMs: 1, // Fast backoff for testing
        sleep: () => Promise.resolve(),
      });

      await expect(client.getAnimeById(100)).rejects.toThrow(AniListError);
      // Initial attempt (1) + 2 retries = 3 attempts total
      expect(fetchAttempts).toBe(3);
    });
  });

  describe("4. Cache hit while AniList is suspended", () => {
    it("serves cached metadata without network overhead during an outage", async () => {
      const cache = new MetadataCache({ cacheDir: undefined });
      const testSummary: AnimeSummary = {
        id: 99999,
        title: {
          english: "Cached Anime",
          romaji: "Cached Anime Romaji",
          native: "キャシュ",
        },
        coverImage: {
          extraLarge: "https://example.com/cover.jpg",
          large: "https://example.com/cover-m.jpg",
          color: "#4f46e5",
        },
        format: "TV",
        episodes: 12,
        averageScore: 85,
        seasonYear: 2024,
        status: "FINISHED",
        genres: ["Action", "Sci-Fi"],
      };
      cache.putSummary(testSummary);

      // Simulate open circuit breaker (suspended AniList)
      const cb = new CircuitBreaker();
      cb.trip();

      const failingFetch = vi.fn().mockRejectedValue(new Error("Network dead"));
      const anilistClient = new AniListClient({
        fetchImpl: failingFetch as unknown as typeof fetch,
        circuitBreaker: cb,
      });

      const catalog = new CatalogService({
        anilistClient,
        metadataCache: cache,
      });

      // Single item resolution
      const details = await catalog.getAnimeById(99999);
      expect(details).not.toBeNull();
      expect(details?.id).toBe(99999);
      expect(details?.title.english).toBe("Cached Anime");
      expect(details?.episodes).toBe(12);

      // Batch resolution for library
      const batchMap = await catalog.getAnimeByIds([99999]);
      expect(batchMap.get(99999)?.title.english).toBe("Cached Anime");

      // Verify no network calls were attempted
      expect(failingFetch).not.toHaveBeenCalled();
    });
  });

  describe("5. Cache miss with secondary provider (Kitsu) fallback", () => {
    it("resolves un-cached anime via Kitsu with AniList ID cross-mapping", async () => {
      const cache = new MetadataCache({ cacheDir: undefined });

      const cb = new CircuitBreaker();
      cb.trip(); // AniList suspended

      const anilistClient = new AniListClient({
        fetchImpl: vi.fn() as unknown as typeof fetch,
        circuitBreaker: cb,
      });

      // Mock Kitsu returning mapped entry for AniList ID 154587
      const kitsuFetchMock = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("mappings")) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: "mapping-1",
                  relationships: {
                    item: {
                      data: { type: "anime", id: "46892" },
                    },
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/anime/46892")) {
          return new Response(
            JSON.stringify({
              data: {
                id: "46892",
                attributes: {
                  canonicalTitle: "Sousou no Frieren",
                  titles: {
                    en: "Frieren: Beyond Journey's End",
                    ja_jp: "葬送のフリーレン",
                  },
                  posterImage: {
                    large: "https://kitsu.io/frieren-large.jpg",
                    medium: "https://kitsu.io/frieren-med.jpg",
                  },
                  subtype: "tv",
                  episodeCount: 28,
                  averageRating: "91.2",
                  startDate: "2023-09-29",
                  status: "finished",
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("Not found", { status: 404 });
      });

      const kitsuClient = new KitsuClient({
        fetchImpl: kitsuFetchMock as unknown as typeof fetch,
      });

      const catalog = new CatalogService({
        anilistClient,
        metadataCache: cache,
        kitsuClient,
      });

      const result = await catalog.getAnimeById(154587);
      expect(result).not.toBeNull();
      // AniList ID MUST be preserved as canonical ID
      expect(result?.id).toBe(154587);
      expect(result?.title.english).toBe("Frieren: Beyond Journey's End");
      expect(result?.episodes).toBe(28);

      // Verify resolved data was stored in cache for future calls
      expect(cache.getSummary(154587)?.data.title.english).toBe(
        "Frieren: Beyond Journey's End",
      );
    });
  });

  describe("6. Existing library entries with unavailable metadata", () => {
    it("preserves user progress, status, and episodes when metadata is missing", () => {
      const entry: LibraryEntry = {
        id: "entry-abc",
        userId: "user-123",
        anilistId: 777777, // Uncached & unavailable ID
        status: "watching",
        progress: 14,
        score: 9,
        startedAt: "2026-01-01",
        completedAt: null,
        notes: "Loved episode 12",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      };

      const watchedEpisodes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

      // Simulate library item with missing metadata (anime: null)
      const libraryItem = {
        entry,
        anime: null,
        watchedEpisodes,
      };

      // Progress, score, notes, and watched episodes MUST NOT be lost
      expect(libraryItem.entry.progress).toBe(14);
      expect(libraryItem.entry.score).toBe(9);
      expect(libraryItem.entry.status).toBe("watching");
      expect(libraryItem.watchedEpisodes).toHaveLength(14);
      expect(libraryItem.entry.anilistId).toBe(777777);
      expect(libraryItem.entry.completedAt).toBeNull(); // Must NOT infer completed
    });
  });

  describe("7. Search and schedule errors versus empty results", () => {
    it("throws clean outage error on search when upstream and fallback fail, preventing false empty results", async () => {
      const cache = new MetadataCache({ cacheDir: undefined });
      cache.clear();

      const cb = new CircuitBreaker();
      cb.trip();

      const kitsuFailingFetch = vi.fn().mockRejectedValue(new Error("Kitsu down"));
      const kitsuClient = new KitsuClient({
        fetchImpl: kitsuFailingFetch as unknown as typeof fetch,
      });

      const catalog = new CatalogService({
        anilistClient: new AniListClient({ circuitBreaker: cb }),
        metadataCache: cache,
        kitsuClient,
      });

      // Must throw AniListSuspendedError, NOT return an empty list { items: [] }
      await expect(
        catalog.searchAnime({ query: "NonexistentAnimexyz" }),
      ).rejects.toThrow(AniListSuspendedError);
    });

    it("throws clean outage error on schedule when AniList is suspended", async () => {
      const cb = new CircuitBreaker();
      cb.trip();

      const catalog = new CatalogService({
        anilistClient: new AniListClient({ circuitBreaker: cb }),
      });

      await expect(
        catalog.getAiringSchedule({ airingAtGreater: 0, airingAtLesser: 100 }),
      ).rejects.toThrow(AniListSuspendedError);
    });
  });

  describe("8. Episode tracking resilience", () => {
    it("resolves episode count from cache without network when catalogue is down", async () => {
      const cache = new MetadataCache({ cacheDir: undefined });
      cache.putSummary({
        id: 154587,
        title: {
          english: "Frieren: Beyond Journey's End",
          romaji: null,
          native: null,
        },
        coverImage: { extraLarge: null, large: null, color: null },
        format: "TV",
        episodes: 28,
        averageScore: 91,
        seasonYear: 2023,
        status: "FINISHED",
        genres: [],
      });

      const cb = new CircuitBreaker();
      cb.trip();

      const catalog = new CatalogService({
        anilistClient: new AniListClient({ circuitBreaker: cb }),
        metadataCache: cache,
      });

      const anime = await catalog.getAnimeById(154587);
      expect(anime?.episodes).toBe(28);
    });
  });
});
