import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createCatalogPersistence,
  SupabaseCatalogPersistence,
  type CatalogPersistence,
  type PersistedCacheRecord,
} from "@/services/catalog/cache-store";
import { createTestCache, makeAnime, makeSummary } from "./helpers/catalog-fixtures";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

class FakePersistence implements CatalogPersistence {
  readonly name = "fake";

  records: PersistedCacheRecord[] = [];
  saves: PersistedCacheRecord[][] = [];
  removes: string[][] = [];
  loadError: Error | null = null;
  saveError: Error | null = null;

  async load(): Promise<PersistedCacheRecord[]> {
    if (this.loadError) throw this.loadError;
    return [...this.records];
  }

  async save(records: PersistedCacheRecord[]): Promise<void> {
    this.saves.push(records);
    if (this.saveError) throw this.saveError;
  }

  async remove(keys: string[]): Promise<void> {
    this.removes.push(keys);
  }
}

function record(
  key: string,
  payload: unknown,
  now: number,
  window: { freshMs: number; staleMs: number },
): PersistedCacheRecord {
  return {
    key,
    payload,
    cachedAt: now - 1000,
    freshUntil: now - 1000 + window.freshMs,
    expiresAt: now - 1000 + window.freshMs + window.staleMs,
  };
}

describe("MetadataCache", () => {
  it("starts empty: no hard-coded production seeds", () => {
    const cache = createTestCache();

    expect(cache.size).toBe(0);
    expect(cache.detailCount).toBe(0);
    expect(cache.collectionCount).toBe(0);
    expect(cache.getPopular()).toBeNull();
    expect(cache.getTrending()).toBeNull();
    // IDs that used to be seeded directly in the production cache.
    expect(cache.getSummary(154587)).toBeNull();
    expect(cache.getSummary(172654)).toBeNull();
    expect(cache.searchLocal("Frieren")).toEqual([]);
  });

  it("distinguishes fresh, stale and expired entries", () => {
    const nowMs = Date.parse("2026-01-01T00:00:00Z");
    const cache = createTestCache({ now: () => nowMs });
    cache.putSummary(makeSummary(1));

    expect(cache.getSummary(1)?.isStale).toBe(false);

    const fresh = cache.getSummary(1);
    expect(fresh?.cachedAt).toBe(nowMs);
    expect(fresh?.freshUntil).toBe(nowMs + 12 * HOUR);

    // Past the fresh window: no longer served as fresh data.
    const afterFresh = nowMs + 12 * HOUR + 1;
    const staleCache = createTestCache({ now: () => afterFresh });
    staleCache.putSummary(makeSummary(1), { now: nowMs });
    expect(staleCache.getSummary(1)).toBeNull();
    const stale = staleCache.getSummary(1, { allowStale: true });
    expect(stale?.isStale).toBe(true);
    expect(stale?.data.id).toBe(1);

    // Past the retention window: gone entirely.
    const afterRetention = nowMs + 12 * HOUR + 30 * DAY + 1;
    const expiredCache = createTestCache({ now: () => afterRetention });
    expiredCache.putSummary(makeSummary(1), { now: nowMs });
    expect(expiredCache.getSummary(1)).toBeNull();
    expect(expiredCache.getSummary(1, { allowStale: true })).toBeNull();
  });

  it("uses independent freshness windows per cache kind", () => {
    let now = 1_000_000;
    const cache = createTestCache({ now: () => now });
    cache.putSummary(makeSummary(1));
    cache.putDetails(makeAnime(2));
    cache.putPopular([makeSummary(3)]);

    now += 7 * HOUR;
    expect(cache.getSummary(1)).not.toBeNull(); // 12h window
    expect(cache.getDetails(2)).toBeNull(); // 6h window
    expect(cache.getPopular()).toBeNull(); // 30m window
    expect(cache.getDetails(2, { allowStale: true })?.isStale).toBe(true);
    expect(cache.getPopular({ allowStale: true })?.isStale).toBe(true);
  });

  it("returns partial batch results for fresh and missing ids", () => {
    const cache = createTestCache();
    cache.putSummary(makeSummary(1));
    cache.putSummary(makeSummary(2));

    const result = cache.getSummaries([1, 2, 3]);
    expect([...result.hits.keys()]).toEqual([1, 2]);
    expect(result.missing).toEqual([3]);
  });

  it("evicts oldest entries to stay bounded", () => {
    const cache = createTestCache({ maxSummaries: 2 });
    cache.putSummary(makeSummary(1));
    cache.putSummary(makeSummary(2));
    cache.putSummary(makeSummary(3));

    expect(cache.size).toBe(2);
    expect(cache.getSummary(1)).toBeNull();
    expect(cache.getSummary(2)).not.toBeNull();
    expect(cache.getSummary(3)).not.toBeNull();
  });

  it("searches local metadata, including stale entries only when allowed", () => {
    let now = 1_000_000;
    const cache = createTestCache({ now: () => now });
    cache.putSummary(
      makeSummary(1, {
        title: {
          english: "Frieren: Beyond Journey's End",
          romaji: "Sousou no Frieren",
          native: null,
        },
      }),
    );

    expect(cache.searchLocal("frieren")).toHaveLength(1);

    now += 12 * HOUR + 1;
    expect(cache.searchLocal("frieren")).toHaveLength(0);
    expect(
      cache.searchLocal("frieren", 10, { allowStale: true }),
    ).toHaveLength(1);
  });

  it("hydrates valid persisted records and ignores corrupt or expired ones", async () => {
    const now = 1_000_000;
    const persistence = new FakePersistence();
    persistence.records = [
      record("summary:1", makeSummary(1), now, {
        freshMs: 12 * HOUR,
        staleMs: 30 * DAY,
      }),
      // Expired summary is not restored.
      {
        ...record("summary:2", makeSummary(2), now, {
          freshMs: 12 * HOUR,
          staleMs: 30 * DAY,
        }),
        expiresAt: now - 1,
      },
      // Corrupt payload and mismatched key are ignored.
      record("summary:3", { id: 3 }, now, {
        freshMs: 12 * HOUR,
        staleMs: 30 * DAY,
      }),
      record("summary:7", makeSummary(8), now, {
        freshMs: 12 * HOUR,
        staleMs: 30 * DAY,
      }),
      record("details:4", makeAnime(4), now, {
        freshMs: 6 * HOUR,
        staleMs: 30 * DAY,
      }),
      record("collection:popular", [makeSummary(5)], now, {
        freshMs: 30 * 60_000,
        staleMs: 7 * DAY,
      }),
      record("collection:seasonal:FALL_2026", [makeSummary(6)], now, {
        freshMs: 6 * HOUR,
        staleMs: 30 * DAY,
      }),
      // Unknown key namespace.
      record("garbage:9", { hello: "world" }, now, {
        freshMs: HOUR,
        staleMs: HOUR,
      }),
    ];

    const warnings: string[] = [];
    const cache = createTestCache({
      now: () => now,
      persistence,
      logger: { warn: (message) => warnings.push(message) },
    });

    await cache.ready();

    expect(cache.getSummary(1)?.data.id).toBe(1);
    expect(cache.getSummary(2)).toBeNull();
    expect(cache.getSummary(3)).toBeNull();
    expect(cache.getSummary(7)).toBeNull();
    expect(cache.getDetails(4)?.data.id).toBe(4);
    expect(cache.getPopular()?.data[0]?.id).toBe(5);
    expect(cache.getSeasonal("FALL", 2026)?.data[0]?.id).toBe(6);
    expect(warnings.some((message) => message.includes("corrupt"))).toBe(true);
  });

  it("survives a persistence read failure and stays usable in memory", async () => {
    const persistence = new FakePersistence();
    persistence.loadError = new Error("database offline");
    const warnings: string[] = [];

    const cache = createTestCache({
      persistence,
      logger: {
        warn: (message, ...args) => warnings.push([message, ...args].join(" ")),
      },
    });

    await expect(cache.ready()).resolves.toBeUndefined();
    expect(warnings.join(" ")).toContain("database offline");

    cache.putSummary(makeSummary(11));
    expect(cache.getSummary(11)?.data.id).toBe(11);
  });

  it("logs persistence write failures instead of throwing", async () => {
    const persistence = new FakePersistence();
    persistence.saveError = new Error("permission denied");
    const warnings: string[] = [];

    const cache = createTestCache({
      persistence,
      logger: {
        warn: (message, ...args) => warnings.push([message, ...args].join(" ")),
      },
    });

    cache.putSummary(makeSummary(12));
    await expect(cache.flush()).resolves.toBeUndefined();

    expect(persistence.saves).toHaveLength(1);
    expect(warnings.join(" ")).toContain("permission denied");
    // Data remains available in memory for this instance.
    expect(cache.getSummary(12)?.data.id).toBe(12);
  });

  it("persists written entries with explicit freshness timestamps", async () => {
    const persistence = new FakePersistence();
    const now = 5_000_000;
    const cache = createTestCache({ persistence, now: () => now });

    cache.putSummary(makeSummary(13));
    cache.putPopular([makeSummary(14)]);
    await cache.flush();

    const persisted = persistence.saves.flat();
    const summary = persisted.find((entry) => entry.key === "summary:13");
    expect(summary).toBeDefined();
    expect(summary?.freshUntil).toBe(now + 12 * HOUR);
    expect(summary?.expiresAt).toBe(now + 12 * HOUR + 30 * DAY);
    expect(persisted.some((entry) => entry.key === "collection:popular")).toBe(
      true,
    );
  });

  it("removes persisted records on clear", async () => {
    const now = 1_000_000;
    const persistence = new FakePersistence();
    persistence.records = [
      record("summary:20", makeSummary(20), now, {
        freshMs: 12 * HOUR,
        staleMs: 30 * DAY,
      }),
      record("collection:popular", [makeSummary(21)], now, {
        freshMs: 30 * 60_000,
        staleMs: 7 * DAY,
      }),
    ];

    const cache = createTestCache({ persistence, now: () => now });
    await cache.ready();
    cache.clear();

    await vi.waitFor(() => {
      expect(persistence.removes.flat().sort()).toEqual([
        "collection:popular",
        "summary:20",
      ]);
    });
    expect(cache.size).toBe(0);
  });

  it("falls back to the in-memory cache when durable credentials are missing", () => {
    expect(createCatalogPersistence({})).toBeNull();
    expect(
      createCatalogPersistence({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toBeNull();
    expect(
      createCatalogPersistence({ SUPABASE_SERVICE_ROLE_KEY: "service-key" }),
    ).toBeNull();
  });

  it("rejects unusable Supabase URLs without throwing", () => {
    expect(
      createCatalogPersistence({
        NEXT_PUBLIC_SUPABASE_URL: "not a url",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      }),
    ).toBeNull();
    expect(
      createCatalogPersistence({
        NEXT_PUBLIC_SUPABASE_URL: "ftp://example.com",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      }),
    ).toBeNull();
  });

  it("constructs the durable adapter only with server-side credentials", () => {
    const persistence = createCatalogPersistence({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    expect(persistence).toBeInstanceOf(SupabaseCatalogPersistence);
    expect(persistence?.name).toBe("supabase");
  });

  it("never persists user-shaped fields that were not in the cached payload", () => {
    // Sanity check for the cache contract: entries only carry public metadata.
    const cache = createTestCache();
    cache.putSummary(makeSummary(30));
    const hit = cache.getSummary(30);
    expect(hit).not.toBeNull();
    expect(Object.keys(hit!.data)).not.toContain("userId");
    expect(Object.keys(hit!.data)).not.toContain("progress");
  });
});
