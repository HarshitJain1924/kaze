import type { Anime, AnimeSummary } from "@/types/anime";

import {
  createCatalogPersistence,
  type CatalogPersistence,
  type PersistedCacheRecord,
} from "./cache-store";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type CacheKind =
  | "summary"
  | "details"
  | "popular"
  | "trending"
  | "seasonal";

export interface CacheTtls {
  /** Window in which an entry is served without any refresh attempt. */
  freshMs: number;
  /**
   * Additional window after `freshMs` in which the entry may still be served
   * as an explicitly stale fallback. The entry is deleted afterwards.
   */
  staleMs: number;
}

export const DEFAULT_CACHE_TTLS: Record<CacheKind, CacheTtls> = {
  summary: { freshMs: 12 * HOUR, staleMs: 30 * DAY },
  details: { freshMs: 6 * HOUR, staleMs: 30 * DAY },
  popular: { freshMs: 30 * MINUTE, staleMs: 7 * DAY },
  trending: { freshMs: 30 * MINUTE, staleMs: 7 * DAY },
  seasonal: { freshMs: 6 * HOUR, staleMs: 30 * DAY },
};

export interface CacheHit<T> {
  data: T;
  cachedAt: number;
  freshUntil: number;
  expiresAt: number;
  /** True when the entry is past its fresh window and is a fallback only. */
  isStale: boolean;
}

export interface CacheReadOptions {
  /**
   * When true, an entry past its fresh window is returned and flagged as
   * stale. Stale data is only ever served during an upstream outage.
   */
  allowStale?: boolean;
  now?: number;
}

export interface CacheWriteOptions {
  ttls?: Partial<CacheTtls>;
  now?: number;
}

export interface CacheLogger {
  warn(message: string, ...args: unknown[]): void;
}

export interface MetadataCacheOptions {
  now?: () => number;
  /** Pass `null` to disable persistence entirely (tests, dry runs). */
  persistence?: CatalogPersistence | null;
  logger?: CacheLogger;
  maxSummaries?: number;
  maxDetails?: number;
  maxCollections?: number;
  ttls?: Partial<Record<CacheKind, Partial<CacheTtls>>>;
  /** Debounce for batched persistence writes. */
  flushDelayMs?: number;
}

interface CachedEntry<T> {
  data: T;
  cachedAt: number;
  freshUntil: number;
  expiresAt: number;
}

const SUMMARY_KEY = /^summary:(\d+)$/;
const DETAILS_KEY = /^details:(\d+)$/;
const SEASONAL_KEY = /^collection:seasonal:([A-Z]+)_(\d{4})$/;

const POPULAR_KEY = "collection:popular";
const TRENDING_KEY = "collection:trending";

function seasonalKey(season: string, year: number): string {
  return `collection:seasonal:${season.toUpperCase()}_${year}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural validation for data restored from an untrusted store. */
export function isAnimeSummary(value: unknown): value is AnimeSummary {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "number" || !Number.isInteger(value.id) || value.id <= 0) {
    return false;
  }
  if (!isRecord(value.title) || !isRecord(value.coverImage)) return false;
  if (!Array.isArray(value.genres)) return false;
  return value.genres.every((genre) => typeof genre === "string");
}

export function isAnime(value: unknown): value is Anime {
  if (!isAnimeSummary(value)) return false;
  const candidate = value as Partial<Anime>;
  return Array.isArray(candidate.tags) && Array.isArray(candidate.relations);
}

function isSummaryList(value: unknown): value is AnimeSummary[] {
  return Array.isArray(value) && value.every(isAnimeSummary);
}

function toHit<T>(entry: CachedEntry<T>, now: number): CacheHit<T> {
  return {
    data: entry.data,
    cachedAt: entry.cachedAt,
    freshUntil: entry.freshUntil,
    expiresAt: entry.expiresAt,
    isStale: now >= entry.freshUntil,
  };
}

/**
 * Shared metadata cache for public catalogue data.
 *
 * Three states are modelled explicitly:
 * - **fresh**: served without contacting the provider;
 * - **stale**: kept past the fresh window, only served (and flagged) when the
 *   provider is unavailable, until the retention window ends;
 * - **expired**: deleted, indistinguishable from a cache miss.
 *
 * The cache is bounded in memory and never stores user-owned data. Durable
 * persistence is optional: without a configured store it is explicitly
 * best-effort and per server instance only.
 */
export class MetadataCache {
  private readonly summaries = new Map<number, CachedEntry<AnimeSummary>>();
  private readonly details = new Map<number, CachedEntry<Anime>>();
  private readonly collections = new Map<string, CachedEntry<AnimeSummary[]>>();

  private readonly now: () => number;
  private readonly logger: CacheLogger;
  private readonly persistence: CatalogPersistence | null;
  private readonly ttls: Record<CacheKind, CacheTtls>;
  private readonly maxSummaries: number;
  private readonly maxDetails: number;
  private readonly maxCollections: number;
  private readonly flushDelayMs: number;

  private hydratePromise: Promise<void> | null = null;
  private readonly dirty = new Map<string, PersistedCacheRecord | null>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushChain: Promise<void> = Promise.resolve();

  constructor(options: MetadataCacheOptions = {}) {
    this.now = options.now ?? Date.now.bind(Date);
    this.logger = options.logger ?? console;
    this.persistence =
      options.persistence === undefined
        ? createCatalogPersistence()
        : options.persistence;
    this.maxSummaries = Math.max(1, options.maxSummaries ?? 2_000);
    this.maxDetails = Math.max(1, options.maxDetails ?? 300);
    this.maxCollections = Math.max(1, options.maxCollections ?? 48);
    this.flushDelayMs = Math.max(0, options.flushDelayMs ?? 20);

    this.ttls = { ...DEFAULT_CACHE_TTLS };
    for (const kind of Object.keys(DEFAULT_CACHE_TTLS) as CacheKind[]) {
      this.ttls[kind] = {
        ...DEFAULT_CACHE_TTLS[kind],
        ...options.ttls?.[kind],
      };
    }
  }

  /** Loads durable records once per process; safe to call concurrently. */
  async ready(): Promise<void> {
    if (!this.persistence) {
      return;
    }
    this.hydratePromise ??= this.hydrate();
    await this.hydratePromise;
  }

  private async hydrate(): Promise<void> {
    if (!this.persistence) {
      return;
    }

    let records: PersistedCacheRecord[];
    try {
      records = await this.persistence.load();
    } catch (error) {
      this.logger.warn(
        "[catalog-cache] could not read persisted metadata; continuing without it",
        errorMessage(error),
      );
      return;
    }

    const now = this.now();
    let corrupt = 0;

    for (const record of records) {
      if (
        !record ||
        typeof record.key !== "string" ||
        !Number.isFinite(record.cachedAt) ||
        !Number.isFinite(record.freshUntil) ||
        !Number.isFinite(record.expiresAt)
      ) {
        corrupt += 1;
        continue;
      }
      if (record.expiresAt <= now) {
        // Expired records are simply not loaded; they are pruned on the next write.
        continue;
      }
      if (!this.restore(record)) {
        corrupt += 1;
      }
    }

    if (corrupt > 0) {
      this.logger.warn(
        `[catalog-cache] ignored ${corrupt} corrupt cache record(s)`,
      );
    }
  }

  private restore(record: PersistedCacheRecord): boolean {
    const summaryMatch = SUMMARY_KEY.exec(record.key);
    if (summaryMatch) {
      const id = Number(summaryMatch[1]);
      if (!isAnimeSummary(record.payload) || record.payload.id !== id) {
        return false;
      }
      this.summaries.set(id, {
        data: record.payload,
        cachedAt: record.cachedAt,
        freshUntil: record.freshUntil,
        expiresAt: record.expiresAt,
      });
      this.trim(this.summaries, this.maxSummaries);
      return true;
    }

    const detailsMatch = DETAILS_KEY.exec(record.key);
    if (detailsMatch) {
      const id = Number(detailsMatch[1]);
      if (!isAnime(record.payload) || record.payload.id !== id) {
        return false;
      }
      this.details.set(id, {
        data: record.payload,
        cachedAt: record.cachedAt,
        freshUntil: record.freshUntil,
        expiresAt: record.expiresAt,
      });
      this.trim(this.details, this.maxDetails);
      return true;
    }

    if (record.key === POPULAR_KEY || record.key === TRENDING_KEY) {
      if (!isSummaryList(record.payload)) return false;
      this.collections.set(record.key, {
        data: record.payload,
        cachedAt: record.cachedAt,
        freshUntil: record.freshUntil,
        expiresAt: record.expiresAt,
      });
      this.trim(this.collections, this.maxCollections);
      return true;
    }

    if (SEASONAL_KEY.test(record.key)) {
      if (!isSummaryList(record.payload)) return false;
      this.collections.set(record.key, {
        data: record.payload,
        cachedAt: record.cachedAt,
        freshUntil: record.freshUntil,
        expiresAt: record.expiresAt,
      });
      this.trim(this.collections, this.maxCollections);
      return true;
    }

    return false;
  }

  private ttlFor(kind: CacheKind, override?: Partial<CacheTtls>): CacheTtls {
    const base = override
      ? { ...this.ttls[kind], ...override }
      : this.ttls[kind];
    return {
      freshMs: Math.max(1, base.freshMs),
      staleMs: Math.max(0, base.staleMs),
    };
  }

  private entryFrom<T>(data: T, kind: CacheKind, options: CacheWriteOptions): CachedEntry<T> {
    const now = options.now ?? this.now();
    const ttl = this.ttlFor(kind, options.ttls);
    return {
      data,
      cachedAt: now,
      freshUntil: now + ttl.freshMs,
      expiresAt: now + ttl.freshMs + ttl.staleMs,
    };
  }

  private read<T>(
    entry: CachedEntry<T> | undefined,
    options: CacheReadOptions,
  ): CacheHit<T> | null {
    if (!entry) return null;
    const now = options.now ?? this.now();
    if (now >= entry.expiresAt) {
      return null;
    }
    if (!options.allowStale && now >= entry.freshUntil) {
      return null;
    }
    return toHit(entry, now);
  }

  private trim<T>(map: Map<number | string, T>, max: number): void {
    while (map.size > max) {
      const oldest = map.keys().next();
      if (oldest.done) break;
      map.delete(oldest.value);
    }
  }

  // ---------------------------------------------------------------------
  // Summaries
  // ---------------------------------------------------------------------

  getSummary(
    id: number,
    options: CacheReadOptions = {},
  ): CacheHit<AnimeSummary> | null {
    return this.read(this.summaries.get(id), options);
  }

  getSummaries(
    ids: number[],
    options: CacheReadOptions = {},
  ): { hits: Map<number, CacheHit<AnimeSummary>>; missing: number[] } {
    const hits = new Map<number, CacheHit<AnimeSummary>>();
    const missing: number[] = [];
    for (const id of ids) {
      const hit = this.getSummary(id, options);
      if (hit) {
        hits.set(id, hit);
      } else {
        missing.push(id);
      }
    }
    return { hits, missing };
  }

  putSummary(summary: AnimeSummary, options: CacheWriteOptions = {}): void {
    if (!isAnimeSummary(summary)) return;
    const entry = this.entryFrom(summary, "summary", options);
    this.summaries.delete(summary.id);
    this.summaries.set(summary.id, entry);
    this.trim(this.summaries, this.maxSummaries);
    this.markDirty(`summary:${summary.id}`, {
      key: `summary:${summary.id}`,
      payload: summary,
      cachedAt: entry.cachedAt,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt,
    });
  }

  putSummaries(summaries: AnimeSummary[], options: CacheWriteOptions = {}): void {
    for (const summary of summaries) {
      this.putSummary(summary, options);
    }
  }

  // ---------------------------------------------------------------------
  // Details
  // ---------------------------------------------------------------------

  getDetails(id: number, options: CacheReadOptions = {}): CacheHit<Anime> | null {
    return this.read(this.details.get(id), options);
  }

  putDetails(anime: Anime, options: CacheWriteOptions = {}): void {
    if (!isAnime(anime)) return;
    const entry = this.entryFrom(anime, "details", options);
    this.details.delete(anime.id);
    this.details.set(anime.id, entry);
    this.trim(this.details, this.maxDetails);
    this.markDirty(`details:${anime.id}`, {
      key: `details:${anime.id}`,
      payload: anime,
      cachedAt: entry.cachedAt,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt,
    });
  }

  // ---------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------

  getCollection(
    key: string,
    options: CacheReadOptions = {},
  ): CacheHit<AnimeSummary[]> | null {
    return this.read(this.collections.get(key), options);
  }

  private putCollection(
    key: string,
    items: AnimeSummary[],
    kind: CacheKind,
    options: CacheWriteOptions,
  ): void {
    const valid = items.filter(isAnimeSummary);
    if (valid.length === 0) return;
    const entry = this.entryFrom(valid, kind, options);
    this.collections.delete(key);
    this.collections.set(key, entry);
    this.trim(this.collections, this.maxCollections);
    this.markDirty(key, {
      key,
      payload: valid,
      cachedAt: entry.cachedAt,
      freshUntil: entry.freshUntil,
      expiresAt: entry.expiresAt,
    });
  }

  getPopular(options: CacheReadOptions = {}): CacheHit<AnimeSummary[]> | null {
    return this.getCollection(POPULAR_KEY, options);
  }

  putPopular(items: AnimeSummary[], options: CacheWriteOptions = {}): void {
    this.putCollection(POPULAR_KEY, items, "popular", options);
  }

  getTrending(options: CacheReadOptions = {}): CacheHit<AnimeSummary[]> | null {
    return this.getCollection(TRENDING_KEY, options);
  }

  putTrending(items: AnimeSummary[], options: CacheWriteOptions = {}): void {
    this.putCollection(TRENDING_KEY, items, "trending", options);
  }

  getSeasonal(
    season: string,
    year: number,
    options: CacheReadOptions = {},
  ): CacheHit<AnimeSummary[]> | null {
    if (!Number.isInteger(year)) return null;
    return this.getCollection(seasonalKey(season, year), options);
  }

  putSeasonal(
    season: string,
    year: number,
    items: AnimeSummary[],
    options: CacheWriteOptions = {},
  ): void {
    if (!Number.isInteger(year)) return;
    this.putCollection(seasonalKey(season, year), items, "seasonal", options);
  }

  /**
   * Local title lookup with freshness metadata, used by the catalogue service
   * to label degraded responses accurately.
   */
  searchLocalHits(
    query: string,
    limit = 20,
    options: CacheReadOptions = {},
  ): CacheHit<AnimeSummary>[] {
    const needle = query.trim().toLowerCase();
    if (!needle || limit <= 0) return [];

    const matches: CacheHit<AnimeSummary>[] = [];
    for (const entry of this.summaries.values()) {
      const hit = this.read(entry, options);
      if (!hit) continue;
      const candidates = [
        hit.data.title.english,
        hit.data.title.romaji,
        hit.data.title.native,
      ].filter((value): value is string => Boolean(value));
      if (candidates.some((value) => value.toLowerCase().includes(needle))) {
        matches.push(hit);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }

  /** Local title lookup used only when the provider is unreachable. */
  searchLocal(
    query: string,
    limit = 20,
    options: CacheReadOptions = {},
  ): AnimeSummary[] {
    return this.searchLocalHits(query, limit, options).map((hit) => hit.data);
  }

  // ---------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------

  private markDirty(key: string, record: PersistedCacheRecord | null): void {
    if (!this.persistence) return;
    this.dirty.set(key, record);
    if (this.dirty.size >= 100) {
      void this.flush();
      return;
    }
    if (this.flushTimer) return;

    const timer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushDelayMs);
    // Never keep a Node process alive just to write cache metadata.
    (timer as unknown as { unref?: () => void }).unref?.();
    this.flushTimer = timer;
  }

  /**
   * Writes queued cache changes. Failures are logged and swallowed: cache
   * durability must never break a catalogue read.
   */
  async flush(): Promise<void> {
    if (!this.persistence || this.dirty.size === 0) {
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = [...this.dirty.entries()];
    this.dirty.clear();

    const upserts: PersistedCacheRecord[] = [];
    const deletes: string[] = [];
    for (const [key, record] of batch) {
      if (record) {
        upserts.push(record);
      } else {
        deletes.push(key);
      }
    }

    const persistence = this.persistence;
    this.flushChain = this.flushChain.then(async () => {
      try {
        if (upserts.length > 0) {
          await persistence.save(upserts);
        }
        if (deletes.length > 0) {
          await persistence.remove(deletes);
        }
      } catch (error) {
        this.logger.warn(
          "[catalog-cache] could not persist metadata; cache stays in memory",
          errorMessage(error),
        );
      }
    });

    await this.flushChain;
  }

  // ---------------------------------------------------------------------
  // Introspection / maintenance
  // ---------------------------------------------------------------------

  get size(): number {
    return this.summaries.size;
  }

  get detailCount(): number {
    return this.details.size;
  }

  get collectionCount(): number {
    return this.collections.size;
  }

  clear(): void {
    if (this.persistence) {
      for (const id of this.summaries.keys()) {
        this.dirty.set(`summary:${id}`, null);
      }
      for (const id of this.details.keys()) {
        this.dirty.set(`details:${id}`, null);
      }
      for (const key of this.collections.keys()) {
        this.dirty.set(key, null);
      }
    }

    this.summaries.clear();
    this.details.clear();
    this.collections.clear();

    if (this.persistence) {
      void this.flush();
    }
  }
}

let defaultCache: MetadataCache | null = null;

export function getMetadataCache(): MetadataCache {
  defaultCache ??= new MetadataCache();
  return defaultCache;
}
