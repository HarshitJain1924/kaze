import { TtlCache } from "@/lib/cache";
import { clamp } from "@/lib/utils";
import type {
  AiringScheduleEntry,
  Anime,
  AnimePage,
  AnimeSearchParams,
  AnimeSeason,
  AnimeSummary,
} from "@/types/anime";

import { CircuitBreaker } from "./circuit-breaker";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "./errors";
import {
  mapAiringScheduleList,
  mapAnime,
  mapAnimeList,
  mapAnimePage,
} from "./map";
import {
  AIRING_SCHEDULE_QUERY,
  ANIME_BY_IDS_QUERY,
  ANIME_DETAILS_QUERY,
  SEARCH_ANIME_QUERY,
} from "./queries";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const TTL = {
  search: 60_000,
  details: 10 * 60_000,
  list: 5 * 60_000,
  schedule: 5 * 60_000,
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
  /**
   * Largest `Retry-After` delay this request is willing to wait for. Longer
   * delays are surfaced to the caller immediately so a later request can
   * retry, instead of holding a server request open.
   */
  maxRetryAfterMs?: number;
  /** Total time this request may spend sleeping between attempts. */
  retryBudgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  circuitBreaker?: CircuitBreaker;
}

interface CallOptions {
  ttlMs?: number;
}

type AttemptResult =
  | { ok: true; data: unknown }
  | { ok: false; error: AniListError; retryable: boolean };

function isSuspensionMessage(msg?: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("temporarily disabled") ||
    lower.includes("severe stability issues") ||
    lower.includes("stability issues") ||
    lower.includes("service suspension") ||
    lower.includes("api has been disabled")
  );
}

function isRateLimitMessage(msg?: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("rate-limit") ||
    lower.includes("ratelimit")
  );
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

/**
 * Parses both `Retry-After` forms defined by RFC 9110: delay-seconds and an
 * HTTP-date. Returns milliseconds from `now`, or `null` when unusable.
 */
export function parseRetryAfter(
  header: string | null,
  now: number,
): number | null {
  if (!header) {
    return null;
  }
  const value = header.trim();
  if (value === "") {
    return null;
  }

  // delay-seconds (integers only; a date never parses cleanly as one).
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  const date = Date.parse(value);
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
  private readonly maxRetryAfterMs: number;
  private readonly retryBudgetMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  readonly circuitBreaker: CircuitBreaker;

  constructor(options: AniListClientOptions = {}) {
    this.endpoint = options.endpoint ?? ANILIST_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache =
      options.cache ?? new TtlCache<unknown>(options.cacheMaxEntries ?? 250);
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.maxRetries = Math.max(0, options.maxRetries ?? 2);
    this.baseBackoffMs = options.baseBackoffMs ?? 400;
    this.maxBackoffMs = options.maxBackoffMs ?? 8_000;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 5_000;
    this.retryBudgetMs = options.retryBudgetMs ?? 8_000;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random.bind(Math);
    this.now = options.now ?? Date.now.bind(Date);

    this.circuitBreaker =
      options.circuitBreaker ??
      new CircuitBreaker({
        serviceName: "AniList",
        failureThreshold: 3,
        cooldownMs: 30_000,
        tripImmediatelyOn: (err) =>
          err instanceof AniListSuspendedError ||
          (err instanceof AniListError &&
            (err.isSuspended || err.status === 403)),
      });
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

  /**
   * One upstream request lifecycle: acquire a circuit permit, run the bounded
   * retry loop, then record the outcome exactly once.
   */
  private async send(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.circuitBreaker.tryAcquire()) {
      throw new CircuitBreakerOpenError(
        this.circuitBreaker.serviceName,
        this.circuitBreaker.getState().nextProbeAt ?? this.now(),
      );
    }

    try {
      const data = await this.sendWithRetries(query, variables);
      this.circuitBreaker.recordSuccess();
      return data;
    } catch (error) {
      this.circuitBreaker.recordFailure(error);
      throw error;
    }
  }

  private async sendWithRetries(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    let lastError: AniListError | null = null;
    let sleptMs = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const result = await this.attempt(query, variables);
      if (result.ok) {
        return result.data;
      }

      lastError = result.error;

      if (!result.retryable || attempt >= this.maxRetries) {
        throw lastError;
      }

      const delay = this.retryDelay(lastError, attempt);
      if (delay === null) {
        // The server asked for a longer pause than this request can afford.
        // Surface the rate limit now and let a later request retry.
        throw lastError;
      }
      if (sleptMs + delay > this.retryBudgetMs) {
        throw lastError;
      }

      sleptMs += delay;
      await this.sleep(delay);
    }

    throw lastError ?? new AniListError("AniList request failed");
  }

  /**
   * Honours `Retry-After` exactly. Returns `null` when the requested delay is
   * beyond the practical waiting budget; callers must never shorten it.
   */
  private retryDelay(error: AniListError, attempt: number): number | null {
    if (error.retryAfterMs !== null) {
      return error.retryAfterMs > this.maxRetryAfterMs
        ? null
        : error.retryAfterMs;
    }
    return this.backoffDelay(attempt);
  }

  /** Performs one HTTP attempt and classifies the response. */
  private async attempt(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<AttemptResult> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch (cause) {
      // Network failure, DNS error or timeout: transient, bounded retries.
      return {
        ok: false,
        error: new AniListError("Could not reach AniList", { cause }),
        retryable: true,
      };
    }

    // A confirmed suspension: never retried in a tight loop.
    if (response.status === 403) {
      const message = await readErrorMessage(response);
      return {
        ok: false,
        error: new AniListSuspendedError(message),
        retryable: false,
      };
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after"),
        this.now(),
      );
      return {
        ok: false,
        error: new AniListError(
          response.status === 429
            ? "AniList rate limit reached"
            : "AniList is temporarily unavailable",
          { status: response.status, retryAfterMs },
        ),
        retryable: true,
      };
    }

    if (!response.ok) {
      const message = await readErrorMessage(response);
      // AniList reports API disablement as 403, but some proxies return a
      // GraphQL error with a different status; treat the message as canonical.
      if (isSuspensionMessage(message)) {
        return {
          ok: false,
          error: new AniListSuspendedError(message),
          retryable: false,
        };
      }
      return {
        ok: false,
        error: new AniListError(message, { status: response.status }),
        retryable: false,
      };
    }

    let payload: GraphQLPayload;
    try {
      payload = (await response.json()) as GraphQLPayload;
    } catch (cause) {
      return {
        ok: false,
        error: new AniListError("AniList returned invalid JSON", {
          status: response.status,
          cause,
        }),
        retryable: false,
      };
    }

    const errors = payload.errors ?? [];

    if (errors.length > 0 && payload.data == null) {
      const firstMsg = errors[0]?.message ?? "AniList rejected the request";

      if (isSuspensionMessage(firstMsg)) {
        return {
          ok: false,
          error: new AniListSuspendedError(firstMsg),
          retryable: false,
        };
      }

      if (isRateLimitMessage(firstMsg)) {
        return {
          ok: false,
          error: new AniListError(firstMsg, { status: 429 }),
          retryable: true,
        };
      }

      return {
        ok: false,
        error: new AniListError(firstMsg, { status: response.status }),
        retryable: false,
      };
    }

    if (payload.data == null) {
      return {
        ok: false,
        error: new AniListError("AniList returned no data", {
          status: response.status,
        }),
        retryable: false,
      };
    }

    return { ok: true, data: payload.data };
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

  /**
   * Fetches airing schedule entries in a timestamp window.
   * If mediaIds are supplied, filters specifically to those anime.
   */
  async getAiringSchedule(params: {
    airingAtGreater: number;
    airingAtLesser: number;
    mediaIds?: number[];
    perPage?: number;
    ttlMs?: number;
  }): Promise<AiringScheduleEntry[]> {
    const mediaIdIn =
      params.mediaIds && params.mediaIds.length > 0
        ? params.mediaIds.filter((id) => Number.isInteger(id) && id > 0)
        : undefined;

    const allEntries: AiringScheduleEntry[] = [];
    let page = 1;
    const perPage = params.perPage ?? 50;

    while (page <= 3) {
      const data = await this.execute<{ Page?: unknown }>(
        AIRING_SCHEDULE_QUERY,
        {
          airingAtGreater: params.airingAtGreater,
          airingAtLesser: params.airingAtLesser,
          mediaIdIn,
          page,
          perPage,
        },
        params.ttlMs ?? TTL.schedule,
      );

      const pageData = data.Page as
        | {
            pageInfo?: { hasNextPage?: boolean };
            airingSchedules?: unknown;
          }
        | undefined;

      const entries = mapAiringScheduleList(pageData?.airingSchedules ?? []);
      allEntries.push(...entries);

      if (!pageData?.pageInfo?.hasNextPage || entries.length === 0) {
        break;
      }
      page += 1;
    }

    return allEntries;
  }
}

let defaultClient: AniListClient | null = null;

/** Shared server-side client so cache and in-flight dedupe are reused. */
export function getAniListClient(): AniListClient {
  defaultClient ??= new AniListClient();
  return defaultClient;
}
