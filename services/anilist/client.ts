import { TtlCache } from "@/lib/cache";
import { clamp } from "@/lib/utils";
import type {
  Anime,
  AnimePage,
  AnimeSearchParams,
  AnimeSeason,
  AnimeSummary,
} from "@/types/anime";

import { AniListError } from "./errors";
import { mapAnime, mapAnimeList, mapAnimePage } from "./map";
import {
  ANIME_BY_IDS_QUERY,
  ANIME_DETAILS_QUERY,
  SEARCH_ANIME_QUERY,
} from "./queries";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const TTL = {
  search: 60_000,
  details: 10 * 60_000,
  list: 5 * 60_000,
} as const;

const MAX_PER_PAGE = 50;

interface GraphQLPayload {
  data?: unknown;
  errors?: Array<{ message?: string }>;
}

export interface AniListClientOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  cache?: TtlCache<unknown>;
  cacheMaxEntries?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

interface CallOptions {
  ttlMs?: number;
}

function stableKey(query: string, variables: Record<string, unknown>): string {
  const parts = Object.keys(variables)
    .sort()
    .map((key) => `${key}=${JSON.stringify(variables[key] ?? null)}`);
  return `${query}::${parts.join("&")}`;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfter(header: string | null, now: number): number | null {
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }
  const date = Date.parse(header);
  if (Number.isFinite(date)) {
    return Math.max(0, date - now);
  }
  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const payload = JSON.parse(text) as GraphQLPayload;
    const message = payload.errors?.[0]?.message;
    if (message) {
      return message;
    }
  } catch {
    // The body was not JSON; fall through to the status message.
  }
  return `AniList request failed with status ${response.status}`;
}

export class AniListClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<unknown>;
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: AniListClientOptions = {}) {
    this.endpoint = options.endpoint ?? ANILIST_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache =
      options.cache ?? new TtlCache<unknown>(options.cacheMaxEntries ?? 250);
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseBackoffMs = options.baseBackoffMs ?? 400;
    this.maxBackoffMs = options.maxBackoffMs ?? 8_000;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random.bind(Math);
  }

  private backoffDelay(attempt: number): number {
    const exponential = Math.min(
      this.baseBackoffMs * 2 ** attempt,
      this.maxBackoffMs,
    );
    return Math.round(exponential + this.random() * 100);
  }

  /**
   * Executes a GraphQL document with request deduplication and a bounded
   * TTL cache. Concurrent identical reads share a single network request.
   */
  private async execute<T>(
    query: string,
    variables: Record<string, unknown>,
    ttlMs: number,
  ): Promise<T> {
    const key = stableKey(query, variables);
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached as T;
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const request = this.send(query, variables)
      .then((data) => {
        this.cache.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request as Promise<T>;
  }

  private async send(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    let lastError: AniListError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
        });

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = parseRetryAfter(
            response.headers.get("retry-after"),
            Date.now(),
          );
          lastError = new AniListError(
            response.status === 429
              ? "AniList rate limit reached"
              : "AniList is temporarily unavailable",
            { status: response.status, retryAfterMs: retryAfter },
          );
          if (attempt < this.maxRetries) {
            await this.sleep(
              Math.min(
                retryAfter ?? this.backoffDelay(attempt),
                this.maxBackoffMs,
              ),
            );
            continue;
          }
          throw lastError;
        }

        if (!response.ok) {
          throw new AniListError(await readErrorMessage(response), {
            status: response.status,
          });
        }

        let payload: GraphQLPayload;
        try {
          payload = (await response.json()) as GraphQLPayload;
        } catch (error) {
          throw new AniListError("AniList returned invalid JSON", {
            status: response.status,
            cause: error,
          });
        }

        const errors = payload.errors ?? [];
        if (errors.length > 0 && payload.data == null) {
          throw new AniListError(
            errors[0]?.message ?? "AniList rejected the request",
            { status: response.status },
          );
        }
        if (payload.data == null) {
          throw new AniListError("AniList returned no data", {
            status: response.status,
          });
        }

        return payload.data;
      } catch (error) {
        if (error instanceof AniListError && !this.isRetryable(error)) {
          throw error;
        }
        lastError =
          error instanceof AniListError
            ? error
            : new AniListError("Could not reach AniList", { cause: error });

        if (attempt >= this.maxRetries) {
          throw lastError;
        }
        await this.sleep(
          Math.min(
            lastError.retryAfterMs ?? this.backoffDelay(attempt),
            this.maxBackoffMs,
          ),
        );
      }
    }

    throw lastError ?? new AniListError("AniList request failed");
  }

  private isRetryable(error: AniListError): boolean {
    if (error.status === null) {
      return true;
    }
    return error.status === 429 || error.status >= 500;
  }

  async searchAnime(
    params: AnimeSearchParams = {},
    options: CallOptions = {},
  ): Promise<AnimePage> {
    const page = clamp(Math.trunc(params.page ?? 1), 1, 500);
    const perPage = clamp(
      Math.trunc(params.perPage ?? 24),
      1,
      MAX_PER_PAGE,
    );
    const search = params.query?.trim();

    const variables = {
      page,
      perPage,
      search: search ? search.slice(0, 120) : undefined,
      genre: params.genre || undefined,
      format: params.format || undefined,
      season: params.season || undefined,
      seasonYear: params.seasonYear,
      sort: [params.sort ?? "POPULARITY_DESC"],
    };

    const data = await this.execute<{ Page?: unknown }>(
      SEARCH_ANIME_QUERY,
      variables,
      options.ttlMs ?? TTL.search,
    );

    return mapAnimePage(data.Page, page);
  }

  async getAnimeById(
    id: number,
    options: CallOptions = {},
  ): Promise<Anime | null> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AniListError("Invalid anime id");
    }

    let data: { Media?: unknown };
    try {
      data = await this.execute<{ Media?: unknown }>(
        ANIME_DETAILS_QUERY,
        { id },
        options.ttlMs ?? TTL.details,
      );
    } catch (error) {
      // AniList reports a removed or nonexistent media id as "Not Found."
      // rather than returning `Media: null`.
      if (
        error instanceof AniListError &&
        (error.status === 404 ||
          (error.status === 400 && /not found/i.test(error.message)))
      ) {
        return null;
      }
      throw error;
    }

    if (data.Media == null) {
      return null;
    }

    const anime = mapAnime(data.Media);
    if (!anime) {
      throw new AniListError("AniList returned unreadable anime details");
    }
    return anime;
  }

  /** Hydrates personal-library entries with provider metadata. */
  async getAnimeByIds(ids: number[]): Promise<Map<number, AnimeSummary>> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    const result = new Map<number, AnimeSummary>();

    for (let index = 0; index < unique.length; index += MAX_PER_PAGE) {
      const chunk = unique.slice(index, index + MAX_PER_PAGE);
      const data = await this.execute<{ Page?: unknown }>(
        ANIME_BY_IDS_QUERY,
        { ids: chunk, page: 1, perPage: chunk.length },
        TTL.list,
      );

      const page = data.Page as { media?: unknown } | undefined;
      const summaries = mapAnimeList(page?.media ?? []);
      for (const summary of summaries) {
        result.set(summary.id, summary);
      }
    }

    return result;
  }

  async getSeasonalAnime(
    season: AnimeSeason,
    seasonYear: number,
    options: CallOptions & { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    return this.searchAnime(
      {
        season,
        seasonYear,
        sort: "POPULARITY_DESC",
        page: options.page ?? 1,
        perPage: options.perPage ?? 24,
      },
      { ttlMs: options.ttlMs ?? TTL.list },
    );
  }

  async getPopularAnime(
    options: CallOptions & { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    return this.searchAnime(
      {
        sort: "POPULARITY_DESC",
        page: options.page ?? 1,
        perPage: options.perPage ?? 24,
      },
      { ttlMs: options.ttlMs ?? TTL.list },
    );
  }

  async getTrendingAnime(
    options: CallOptions & { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    return this.searchAnime(
      {
        sort: "TRENDING_DESC",
        page: options.page ?? 1,
        perPage: options.perPage ?? 24,
      },
      { ttlMs: options.ttlMs ?? TTL.list },
    );
  }
}

let defaultClient: AniListClient | null = null;

/** Shared server-side client so cache and in-flight dedupe are reused. */
export function getAniListClient(): AniListClient {
  defaultClient ??= new AniListClient();
  return defaultClient;
}
