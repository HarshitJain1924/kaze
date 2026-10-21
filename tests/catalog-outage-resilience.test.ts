import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AniListClient } from "@/services/anilist/client";
import { CircuitBreaker } from "@/services/anilist/circuit-breaker";
import { CatalogService } from "@/services/catalog/catalog-service";
import { CatalogUnavailableError } from "@/services/catalog/errors";
import { KitsuClient } from "@/services/catalog/kitsu-client";
import type { MetadataCache } from "@/services/catalog/metadata-cache";
import type { LibraryEntry } from "@/types/library";

import {
  anilistDetailsResponse,
  anilistPageResponse,
  createTestCache,
  jsonResponse,
  kitsuMappingResponse,
  kitsuSearchResponse,
  makeSummary,
  suspensionResponse,
} from "./helpers/catalog-fixtures";

const HOUR = 60 * 60 * 1000;

interface CatalogHarnessOptions {
  cache?: MetadataCache;
  circuitBreaker?: CircuitBreaker;
  fetchImpl?: ReturnType<typeof vi.fn>;
  kitsuFetch?: ReturnType<typeof vi.fn>;
  now?: () => number;
  maxRetries?: number;
}

function createCatalog(options: CatalogHarnessOptions = {}) {
  const fetchImpl =
    options.fetchImpl ??
    vi.fn(async () => anilistPageResponse([]));
  const kitsuFetch =
    options.kitsuFetch ??
    vi.fn(async () => jsonResponse({ data: [], meta: { count: 0 } }));

  const cache = options.cache ?? createTestCache();
  const anilistClient = new AniListClient({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    circuitBreaker: options.circuitBreaker,
    maxRetries: options.maxRetries ?? 0,
    sleep: async () => {},
    random: () => 0,
    baseBackoffMs: 1,
    maxBackoffMs: 10,
    timeoutMs: 1000,
    now: options.now,
  });
  const kitsuClient = new KitsuClient({
    fetchImpl: kitsuFetch as unknown as typeof fetch,
    timeoutMs: 1000,
  });

  return {
    catalog: new CatalogService({
      anilistClient,
      metadataCache: cache,
      kitsuClient,
      now: options.now,
    }),
    cache,
    fetchImpl,
    kitsuFetch,
  };
}

function emptyKitsu() {
  return vi.fn(async () => jsonResponse({ data: [], meta: { count: 0 } }));
}

describe("Catalogue outage resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("AniList suspension and rate limits", () => {
    it("does not retry a confirmed suspension and reports it accurately", async () => {
      const circuitBreaker = new CircuitBreaker({ cooldownMs: 5000 });
      let fetchCallCount = 0;
      const fetchMock = vi.fn(async () => {
        fetchCallCount += 1;
        return suspensionResponse();
      });

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        circuitBreaker,
        maxRetries: 3,
        kitsuFetch: emptyKitsu(),
      });

      await expect(catalog.getAnimeById(154587)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );

      // A suspension must never be retried in a tight loop.
      expect(fetchCallCount).toBe(1);
      expect(circuitBreaker.getState().state).toBe("OPEN");

      const status = catalog.getStatus();
      expect(status.isSuspended).toBe(true);
      expect(status.circuitBreakerState).toBe("OPEN");
      // Nothing answered, so the provider is unavailable — not Kitsu.
      expect(status.activeProvider).toBe("unavailable");

      await expect(catalog.getAnimeById(154587)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(fetchCallCount).toBe(1);
    });

    it("surfaces a rate-limit reason when the retry budget is exhausted", async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 5 });
      const fetchMock = vi.fn(
        async () =>
          new Response("", {
            status: 429,
            headers: { "retry-after": "120" },
          }),
      );

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
        maxRetries: 2,
      });

      const error = await catalog
        .searchAnime({ query: "rate limited" })
        .then(() => null)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CatalogUnavailableError);
      const unavailable = error as CatalogUnavailableError;
      expect(unavailable.reason).toBe("rate_limited");
      expect(unavailable.retryAfterMs).toBe(120_000);
      // The server-requested delay was never shortened into a tight loop.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("treats an open circuit from transient failures as degraded, not suspended", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 5000,
      });
      const fetchMock = vi.fn(async () =>
        jsonResponse({ errors: [{ message: "boom" }] }, 500),
      );

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(
        catalog.searchAnime({ query: "anything" }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);

      const status = catalog.getStatus();
      expect(status.circuitBreakerState).toBe("OPEN");
      // An open breaker alone is not proof of an upstream suspension.
      expect(status.isSuspended).toBe(false);
      expect(status.activeProvider).toBe("unavailable");
    });
  });

  describe("Fallback ordering", () => {
    it("serves fresh cached details without contacting any provider", async () => {
      const cache = createTestCache();
      cache.putSummary(
        makeSummary(99999, {
          title: {
            english: "Cached Anime",
            romaji: "Cached Romaji",
            native: null,
          },
          episodes: 12,
        }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const fetchMock = vi.fn(async () => {
        throw new Error("network must not be used");
      });
      const kitsuFetch = vi.fn(async () => {
        throw new Error("Kitsu must not be used");
      });

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch,
      });

      const details = await catalog.getAnimeById(99999);
      expect(details?.id).toBe(99999);
      expect(details?.title.english).toBe("Cached Anime");
      expect(details?.episodes).toBe(12);

      const batch = await catalog.getAnimeByIds([99999]);
      expect(batch.get(99999)?.title.english).toBe("Cached Anime");

      expect(fetchMock).not.toHaveBeenCalled();
      expect(kitsuFetch).not.toHaveBeenCalled();
      expect(catalog.getStatus().activeProvider).toBe("cache");
      expect(catalog.getStatus().degraded).toBe(true);
    });

    it("serves stale cached data as a flagged fallback during an outage", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(7));

      // Move past the 12h fresh window but stay inside the 30-day retention.
      now += 13 * HOUR;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      expect(cache.getSummary(7)).toBeNull();
      expect(cache.getSummary(7, { allowStale: true })?.isStale).toBe(true);

      const anime = await catalog.getAnimeById(7);
      expect(anime?.id).toBe(7);
      expect(catalog.getStatus().activeProvider).toBe("cache");
    });

    it("drops expired cache entries and reports unavailability", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(8));
      now += 12 * HOUR + 30 * 24 * HOUR + 1;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      await expect(catalog.getAnimeById(8)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(catalog.getStatus().activeProvider).toBe("unavailable");
    });

    it("falls back to Kitsu only with a verified AniList mapping", async () => {
      const cache = createTestCache();
      const kitsuFetch = vi.fn(async () =>
        kitsuMappingResponse(154587, { kitsuId: "46474" }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch,
      });

      const anime = await catalog.getAnimeById(154587);

      expect(anime?.id).toBe(154587);
      expect(anime?.title.english).toBe("Kitsu English 154587");
      expect(anime?.episodes).toBe(24);
      expect(catalog.getStatus().activeProvider).toBe("kitsu");
      expect(cache.getSummary(154587)?.data.id).toBe(154587);
    });

    it("does not invent a result when Kitsu has no mapping", async () => {
      const cache = createTestCache();
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(catalog.getAnimeById(154587)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(cache.getSummary(154587)).toBeNull();
    });

    it("distinguishes a missing anime from unavailable metadata", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ data: { Media: null } }),
      );
      const kitsuFetch = emptyKitsu();

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        kitsuFetch,
      });

      await expect(catalog.getAnimeById(4242)).resolves.toBeNull();
      expect(kitsuFetch).not.toHaveBeenCalled();
      expect(catalog.getStatus().activeProvider).toBe("anilist");
    });

    it("throws unavailable instead of returning null when details cannot be loaded", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 5000,
      });
      const fetchMock = vi.fn(async () =>
        jsonResponse({ errors: [{ message: "boom" }] }, 500),
      );

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
      });

      await expect(catalog.getAnimeById(1)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
    });
  });

  describe("Search", () => {
    it("returns a genuine empty page when AniList is healthy", async () => {
      const { catalog } = createCatalog({
        fetchImpl: vi.fn(async () => anilistPageResponse([])),
      });

      const page = await catalog.searchAnime({ query: "no such title" });

      expect(page.items).toEqual([]);
      expect(page.pageInfo.total).toBe(0);
      expect(catalog.getStatus().activeProvider).toBe("anilist");
    });

    it("throws an unavailable error on outage instead of faking an empty search", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache: createTestCache(),
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(
        catalog.searchAnime({ query: "NonexistentAnimexyz" }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
    });

    it("uses Kitsu search results with verified AniList IDs during an outage", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();
      const kitsuFetch = vi.fn(async () =>
        kitsuSearchResponse([
          { anilistId: 100, kitsuId: "7001" },
          { anilistId: 101, kitsuId: "7002" },
        ]),
      );

      const { catalog } = createCatalog({
        circuitBreaker,
        kitsuFetch,
      });

      const page = await catalog.searchAnime({ query: "frieren" });

      expect(page.items.map((item) => item.id)).toEqual([100, 101]);
      expect(page.pageInfo.total).toBe(2);
      expect(catalog.getStatus().activeProvider).toBe("kitsu");
    });

    it("falls back to local cached titles when Kitsu has no matches", async () => {
      const cache = createTestCache();
      cache.putSummary(
        makeSummary(300, {
          title: {
            english: "Frieren: Beyond Journey's End",
            romaji: "Sousou no Frieren",
            native: null,
          },
        }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const page = await catalog.searchAnime({ query: "frieren" });

      expect(page.items.map((item) => item.id)).toEqual([300]);
      expect(catalog.getStatus().activeProvider).toBe("cache");
    });

    it("falls back to cached popular titles for an empty browse query", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(1), makeSummary(2)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const page = await catalog.searchAnime({});

      expect(page.items.map((item) => item.id)).toEqual([1, 2]);
      expect(catalog.getStatus().activeProvider).toBe("cache");
    });
  });

  describe("Collections", () => {
    it("serves cached seasonal results during an outage", async () => {
      const cache = createTestCache();
      cache.putSeasonal("FALL", 2026, [makeSummary(1), makeSummary(2)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const page = await catalog.getSeasonalAnime("FALL", 2026, {
        perPage: 12,
      });

      expect(page.items).toHaveLength(2);
      expect(page.pageInfo.total).toBe(2);
      expect(catalog.getStatus().activeProvider).toBe("cache");
    });

    it("does not relabel the popular list as seasonal data", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(9)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      await expect(
        catalog.getSeasonalAnime("FALL", 2026),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
    });

    it("does not relabel the popular list as trending data", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(9)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      await expect(catalog.getTrendingAnime()).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
    });

    it("serves cached popular results with pagination applied", async () => {
      const cache = createTestCache();
      cache.putPopular([1, 2, 3, 4, 5].map((id) => makeSummary(id)));

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const page = await catalog.getPopularAnime({ page: 2, perPage: 2 });
      expect(page.items.map((item) => item.id)).toEqual([3, 4]);
      expect(page.pageInfo.hasNextPage).toBe(true);
      expect(page.pageInfo.lastPage).toBe(3);
    });
  });

  describe("Library hydration", () => {
    it("resolves what it can and omits unavailable entries", async () => {
      const cache = createTestCache();
      cache.putSummary(makeSummary(1));

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const map = await catalog.getAnimeByIds([1, 2]);

      expect(map.get(1)?.id).toBe(1);
      expect(map.has(2)).toBe(false);
    });

    it("preserves user-owned fields when metadata is unavailable", async () => {
      const entry: LibraryEntry = {
        id: "entry-abc",
        userId: "user-123",
        anilistId: 777777,
        status: "watching",
        progress: 14,
        score: 9,
        startedAt: "2026-01-01",
        completedAt: null,
        notes: "Loved episode 12",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      };

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const resolved = await catalog.getAnimeByIds([entry.anilistId]);
      const item = {
        entry,
        anime: resolved.get(entry.anilistId) ?? null,
        watchedEpisodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      };

      expect(item.anime).toBeNull();
      expect(item.entry.progress).toBe(14);
      expect(item.entry.score).toBe(9);
      expect(item.entry.status).toBe("watching");
      expect(item.entry.notes).toBe("Loved episode 12");
      expect(item.entry.completedAt).toBeNull();
      expect(item.watchedEpisodes).toHaveLength(14);
    });

    it("bounds Kitsu fallback fan-out and caches negative mappings", async () => {
      const ids = [10, 11, 12, 13, 14, 15, 16, 17];
      const kitsuFetch = emptyKitsu();
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache: createTestCache(),
        circuitBreaker,
        kitsuFetch,
      });

      const first = await catalog.getAnimeByIds(ids);
      expect(first.size).toBe(0);
      expect(kitsuFetch).toHaveBeenCalledTimes(ids.length);

      // Known-missing mappings are negatively cached for ten minutes.
      const second = await catalog.getAnimeByIds(ids);
      expect(second.size).toBe(0);
      expect(kitsuFetch).toHaveBeenCalledTimes(ids.length);
    });

    it("serves known episode totals from stale cache for episode tracking", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(154587, { episodes: 28 }));
      now += 13 * HOUR;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      const anime = await catalog.getAnimeById(154587);
      expect(anime?.episodes).toBe(28);
    });
  });

  describe("Airing schedule", () => {
    it("reports unavailability instead of an empty schedule", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ circuitBreaker });

      await expect(
        catalog.getAiringSchedule({ airingAtGreater: 0, airingAtLesser: 100 }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
      expect(catalog.getStatus().activeProvider).toBe("unavailable");
    });

    it("returns schedule entries when AniList is healthy", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({
          data: {
            Page: {
              pageInfo: { hasNextPage: false },
              airingSchedules: [],
            },
          },
        }),
      );

      const { catalog } = createCatalog({ fetchImpl: fetchMock });

      await expect(
        catalog.getAiringSchedule({ airingAtGreater: 0, airingAtLesser: 100 }),
      ).resolves.toEqual([]);
      expect(catalog.getStatus().activeProvider).toBe("anilist");
    });
  });

  describe("Details fallback provenance", () => {
    it("marks cached details as cache-sourced, not AniList", async () => {
      const cache = createTestCache();
      cache.putSummary(makeSummary(500));

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      await catalog.getAnimeById(500);
      const status = catalog.getStatus();

      expect(status.activeProvider).toBe("cache");
      expect(status.lastProvider).toBe("cache");
      expect(status.degraded).toBe(true);
      expect(status.cachedTitlesCount).toBeGreaterThan(0);
    });

    it("clears the confirmed-suspension flag after a healthy response", async () => {
      let now = 0;
      const circuitBreaker = new CircuitBreaker({
        cooldownMs: 1000,
        failureThreshold: 1,
        now: () => now,
      });
      let calls = 0;
      const fetchMock = vi.fn(async () => {
        calls += 1;
        return calls === 1 ? suspensionResponse() : anilistDetailsResponse(1);
      });

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
        now: () => now,
      });

      await expect(catalog.getAnimeById(1)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(catalog.getStatus().isSuspended).toBe(true);

      // After the cooldown, a healthy probe confirms recovery.
      now += 1000;
      const anime = await catalog.getAnimeById(1);

      expect(anime?.id).toBe(1);
      expect(catalog.getStatus().isSuspended).toBe(false);
      expect(catalog.getStatus().activeProvider).toBe("anilist");
      expect(catalog.getStatus().degraded).toBe(false);
    });
  });
});
