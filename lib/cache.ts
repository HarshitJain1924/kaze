interface CacheRecord<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-memory TTL cache with least-recently-used eviction.
 * Used to soften AniList rate limits within a single server instance.
 */
export class TtlCache<T> {
  private readonly records = new Map<string, CacheRecord<T>>();

  constructor(private readonly maxEntries = 200) {
    if (maxEntries < 1) {
      throw new Error("TtlCache maxEntries must be at least 1");
    }
  }

  get(key: string, now = Date.now()): T | undefined {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }

    if (record.expiresAt <= now) {
      this.records.delete(key);
      return undefined;
    }

    // Refresh insertion order so frequently used keys survive eviction.
    this.records.delete(key);
    this.records.set(key, record);
    return record.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (ttlMs <= 0) {
      return;
    }

    this.records.delete(key);
    this.records.set(key, { value, expiresAt: now + ttlMs });

    while (this.records.size > this.maxEntries) {
      const oldest = this.records.keys().next();
      if (oldest.done) {
        break;
      }
      this.records.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.records.delete(key);
  }

  clear(): void {
    this.records.clear();
  }

  get size(): number {
    return this.records.size;
  }
}
