import * as fs from "node:fs";
import * as path from "node:path";
import type { Anime, AnimeSummary } from "@/types/anime";

interface CachedEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/**
 * 2-tier metadata cache (in-memory + local file persistence) that ensures
 * anime titles, cover artwork, episode totals, format and genres remain
 * available during upstream service suspensions and network outages.
 */
export class MetadataCache {
  private readonly memorySummaries = new Map<number, CachedEntry<AnimeSummary>>();
  private readonly memoryDetails = new Map<number, CachedEntry<Anime>>();
  private readonly memorySeasonal = new Map<string, CachedEntry<AnimeSummary[]>>();
  private memoryPopular: CachedEntry<AnimeSummary[]> | null = null;
  private memoryTrending: CachedEntry<AnimeSummary[]> | null = null;

  private readonly cacheDir: string | null;
  private readonly defaultTtlMs: number;

  constructor(options: { cacheDir?: string; defaultTtlMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    this.cacheDir = options.cacheDir ?? path.join(process.cwd(), ".cache", "catalog");
    this.initFileStore();
    this.seedDefaultEntries();
  }

  private initFileStore(): void {
    if (!this.cacheDir) return;
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } else {
        this.loadPersistedData();
      }
    } catch {
      // Non-fatal if filesystem is restricted (e.g. read-only container)
    }
  }

  private loadPersistedData(): void {
    if (!this.cacheDir) return;
    try {
      const summaryFile = path.join(this.cacheDir, "summaries.json");
      if (fs.existsSync(summaryFile)) {
        const raw = fs.readFileSync(summaryFile, "utf-8");
        const list = JSON.parse(raw) as Array<CachedEntry<AnimeSummary>>;
        for (const entry of list) {
          if (entry?.data?.id) {
            this.memorySummaries.set(entry.data.id, entry);
          }
        }
      }

      const collectionsFile = path.join(this.cacheDir, "collections.json");
      if (fs.existsSync(collectionsFile)) {
        const raw = fs.readFileSync(collectionsFile, "utf-8");
        const collections = JSON.parse(raw);
        if (collections.popular) this.memoryPopular = collections.popular;
        if (collections.trending) this.memoryTrending = collections.trending;
        if (collections.seasonal) {
          for (const [key, entry] of Object.entries(collections.seasonal)) {
            this.memorySeasonal.set(key, entry as CachedEntry<AnimeSummary[]>);
          }
        }
      }
    } catch {
      // Ignore corrupted or unreadable cache file
    }
  }

  private flushSummaries(): void {
    if (!this.cacheDir) return;
    try {
      const summaryFile = path.join(this.cacheDir, "summaries.json");
      const list = Array.from(this.memorySummaries.values());
      fs.writeFileSync(summaryFile, JSON.stringify(list), "utf-8");
    } catch {
      // Best-effort flush
    }
  }

  private flushCollections(): void {
    if (!this.cacheDir) return;
    try {
      const collectionsFile = path.join(this.cacheDir, "collections.json");
      const seasonalObj: Record<string, CachedEntry<AnimeSummary[]>> = {};
      for (const [k, v] of this.memorySeasonal.entries()) {
        seasonalObj[k] = v;
      }
      const data = {
        popular: this.memoryPopular,
        trending: this.memoryTrending,
        seasonal: seasonalObj,
      };
      fs.writeFileSync(collectionsFile, JSON.stringify(data), "utf-8");
    } catch {
      // Best-effort flush
    }
  }

  private seedDefaultEntries(): void {
    const seeds: AnimeSummary[] = [
      {
        id: 172654,
        title: {
          english: "TOUGEN ANKI",
          romaji: "Tougen Anki",
          native: "桃源暗鬼",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx172654-q2Xk3k.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx172654-q2Xk3k.jpg",
          color: "#c084fc",
        },
        format: "TV",
        episodes: 24,
        averageScore: 82,
        seasonYear: 2024,
        status: "RELEASING",
        genres: ["Action", "Supernatural"],
      },
      {
        id: 154587,
        title: {
          english: "Frieren: Beyond Journey's End",
          romaji: "Sousou no Frieren",
          native: "葬送のフリーレン",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1HJZ9.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587-n1HJZ9.jpg",
          color: "#8b5cf6",
        },
        format: "TV",
        episodes: 28,
        averageScore: 91,
        seasonYear: 2023,
        status: "FINISHED",
        genres: ["Adventure", "Drama", "Fantasy"],
      },
      {
        id: 151807,
        title: {
          english: "Solo Leveling",
          romaji: "Ore dake Level Up na Ken",
          native: "俺だけレベルアップな件",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-3L1bXp.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx151807-3L1bXp.jpg",
          color: "#0ea5e9",
        },
        format: "TV",
        episodes: 12,
        averageScore: 84,
        seasonYear: 2024,
        status: "FINISHED",
        genres: ["Action", "Adventure", "Fantasy"],
      },
      {
        id: 145064,
        title: {
          english: "Jujutsu Kaisen Season 2",
          romaji: "Jujutsu Kaisen 2nd Season",
          native: "呪術廻戦 懐玉・玉折／渋谷事変",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-7D6y8e.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx145064-7D6y8e.jpg",
          color: "#f43f5e",
        },
        format: "TV",
        episodes: 23,
        averageScore: 88,
        seasonYear: 2023,
        status: "FINISHED",
        genres: ["Action", "Fantasy", "Supernatural"],
      },
      {
        id: 101922,
        title: {
          english: "Demon Slayer: Kimetsu no Yaiba",
          romaji: "Kimetsu no Yaiba",
          native: "鬼滅の刃",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx101922-WBsBl0.jpg",
          color: "#10b981",
        },
        format: "TV",
        episodes: 26,
        averageScore: 84,
        seasonYear: 2019,
        status: "FINISHED",
        genres: ["Action", "Fantasy", "Supernatural"],
      },
      {
        id: 140960,
        title: {
          english: "SPY x FAMILY",
          romaji: "SPY×FAMILY",
          native: "SPY×FAMILY",
        },
        coverImage: {
          extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-YrkF4k.jpg",
          large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx140960-YrkF4k.jpg",
          color: "#06b6d4",
        },
        format: "TV",
        episodes: 12,
        averageScore: 85,
        seasonYear: 2022,
        status: "FINISHED",
        genres: ["Action", "Comedy", "Supernatural"],
      },
    ];

    for (const seed of seeds) {
      if (!this.memorySummaries.has(seed.id)) {
        this.putSummary(seed, this.defaultTtlMs);
      }
    }

    if (!this.memoryPopular) {
      this.putPopular(seeds, this.defaultTtlMs);
    }
  }

  getSummary(id: number): { data: AnimeSummary; isStale: boolean } | null {
    const entry = this.memorySummaries.get(id);
    if (!entry) return null;
    return {
      data: entry.data,
      isStale: Date.now() > entry.expiresAt,
    };
  }

  getSummaries(ids: number[]): {
    found: Map<number, AnimeSummary>;
    missing: number[];
  } {
    const found = new Map<number, AnimeSummary>();
    const missing: number[] = [];

    for (const id of ids) {
      const cached = this.getSummary(id);
      if (cached) {
        found.set(id, cached.data);
      } else {
        missing.push(id);
      }
    }

    return { found, missing };
  }

  putSummary(summary: AnimeSummary, ttlMs = this.defaultTtlMs): void {
    if (!summary || !summary.id) return;
    const now = Date.now();
    this.memorySummaries.set(summary.id, {
      data: summary,
      cachedAt: now,
      expiresAt: now + ttlMs,
    });
    this.flushSummaries();
  }

  putSummaries(summaries: AnimeSummary[], ttlMs = this.defaultTtlMs): void {
    const now = Date.now();
    for (const s of summaries) {
      if (s && s.id) {
        this.memorySummaries.set(s.id, {
          data: s,
          cachedAt: now,
          expiresAt: now + ttlMs,
        });
      }
    }
    this.flushSummaries();
  }

  getDetails(id: number): { data: Anime; isStale: boolean } | null {
    const entry = this.memoryDetails.get(id);
    if (!entry) return null;
    return {
      data: entry.data,
      isStale: Date.now() > entry.expiresAt,
    };
  }

  putDetails(anime: Anime, ttlMs = this.defaultTtlMs): void {
    if (!anime || !anime.id) return;
    const now = Date.now();
    this.memoryDetails.set(anime.id, {
      data: anime,
      cachedAt: now,
      expiresAt: now + ttlMs,
    });
  }

  getSeasonal(season: string, year: number): AnimeSummary[] | null {
    const key = `${season.toUpperCase()}_${year}`;
    const entry = this.memorySeasonal.get(key);
    return entry ? entry.data : null;
  }

  putSeasonal(
    season: string,
    year: number,
    items: AnimeSummary[],
    ttlMs = this.defaultTtlMs,
  ): void {
    const key = `${season.toUpperCase()}_${year}`;
    const now = Date.now();
    this.memorySeasonal.set(key, {
      data: items,
      cachedAt: now,
      expiresAt: now + ttlMs,
    });
    this.flushCollections();
  }

  getPopular(): AnimeSummary[] | null {
    return this.memoryPopular ? this.memoryPopular.data : null;
  }

  putPopular(items: AnimeSummary[], ttlMs = this.defaultTtlMs): void {
    const now = Date.now();
    this.memoryPopular = {
      data: items,
      cachedAt: now,
      expiresAt: now + ttlMs,
    };
    this.flushCollections();
  }

  getTrending(): AnimeSummary[] | null {
    return this.memoryTrending ? this.memoryTrending.data : null;
  }

  putTrending(items: AnimeSummary[], ttlMs = this.defaultTtlMs): void {
    const now = Date.now();
    this.memoryTrending = {
      data: items,
      cachedAt: now,
      expiresAt: now + ttlMs,
    };
    this.flushCollections();
  }

  searchLocal(query: string, limit = 20): AnimeSummary[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    const matches: AnimeSummary[] = [];
    for (const { data } of this.memorySummaries.values()) {
      const candidates = [
        data.title.english,
        data.title.romaji,
        data.title.native,
      ].filter(Boolean);

      const hit = candidates.some((c) => c?.toLowerCase().includes(needle));
      if (hit) {
        matches.push(data);
        if (matches.length >= limit) break;
      }
    }

    return matches;
  }

  clear(): void {
    this.memorySummaries.clear();
    this.memoryDetails.clear();
    this.memorySeasonal.clear();
    this.memoryPopular = null;
    this.memoryTrending = null;
    if (this.cacheDir) {
      try {
        const file1 = path.join(this.cacheDir, "summaries.json");
        if (fs.existsSync(file1)) fs.unlinkSync(file1);
        const file2 = path.join(this.cacheDir, "collections.json");
        if (fs.existsSync(file2)) fs.unlinkSync(file2);
      } catch {
        // Ignore
      }
    }
  }

  get size(): number {
    return this.memorySummaries.size;
  }
}

let defaultCache: MetadataCache | null = null;

export function getMetadataCache(): MetadataCache {
  defaultCache ??= new MetadataCache();
  return defaultCache;
}
