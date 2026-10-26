import type {
  AnimeFormat,
  AnimeReleaseStatus,
  AnimeSummary,
} from "@/types/anime";

const KITSU_BASE = "https://kitsu.io/api/edge";
const ANILIST_SITE = "anilist/anime";

/**
 * Kitsu rejects `page[limit]` above 20 with HTTP 400 (verified against the
 * live API), so requests are always clamped to that hard ceiling.
 */
const MAX_SEARCH_LIMIT = 20;

interface KitsuResource {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

interface KitsuResponse {
  data?: KitsuResource | KitsuResource[] | null;
  included?: KitsuResource[];
  errors?: Array<{ detail?: string; title?: string }>;
  meta?: { count?: number };
}

export type KitsuErrorKind = "http" | "network" | "invalid_response";

/** Typed provider failure. Never converted into an empty "successful" list. */
export class KitsuError extends Error {
  readonly kind: KitsuErrorKind;
  readonly status: number | null;

  constructor(
    kind: KitsuErrorKind,
    message: string,
    options: { status?: number | null; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "KitsuError";
    this.kind = kind;
    this.status = options.status ?? null;
  }
}

/**
 * Result of resolving a canonical AniList ID through Kitsu.
 *
 * `not_mapped` and `ambiguous` are *data* outcomes (Kitsu answered, but no
 * single verified mapping exists). `error` is a provider failure. Callers must
 * not turn either into an invented AniList ID.
 */
export type KitsuLookupResult =
  | {
      kind: "found";
      summary: AnimeSummary;
      kitsuId: number;
      bannerImage: string | null;
    }
  | {
      kind: "not_mapped";
      reason: "no_mapping" | "incomplete_mapping";
    }
  | { kind: "ambiguous"; kitsuIds: number[] }
  | { kind: "error"; error: KitsuError };

export type KitsuSearchResult =
  | {
      kind: "ok";
      items: AnimeSummary[];
      skipped: number;
      /** Total matches reported by Kitsu, when available. */
      total: number | null;
    }
  | { kind: "error"; error: KitsuError };

export interface KitsuClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Kitsu dates are `YYYY-MM-DD`; anything else yields an unknown year. */
function parseStartYear(value: unknown): number | null {
  const raw = readString(value);
  if (!raw) return null;
  const match = /^(\d{4})-\d{2}-\d{2}/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null;
}

/** Kitsu ratings are 0–100 strings. Anything non-finite is unknown. */
function parseScore(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed);
}

function parseEpisodeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function mapKitsuFormat(subtype: unknown): AnimeFormat | null {
  const raw = readString(subtype)?.toUpperCase();
  if (!raw) return null;
  switch (raw) {
    case "TV":
    case "TV_SHORT":
      return "TV";
    case "MOVIE":
      return "MOVIE";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "SPECIAL";
    case "MUSIC":
      return "MUSIC";
    default:
      // Unknown subtypes stay unknown instead of being labelled "TV".
      return null;
  }
}

function mapKitsuStatus(status: unknown): AnimeReleaseStatus | null {
  const raw = readString(status)?.toLowerCase();
  if (!raw) return null;
  switch (raw) {
    case "current":
      return "RELEASING";
    case "finished":
      return "FINISHED";
    case "unreleased":
    case "upcoming":
      return "NOT_YET_RELEASED";
    case "tba":
      return "NOT_YET_RELEASED";
    default:
      return null;
  }
}

function relationshipRefs(
  resource: KitsuResource,
  name: string,
): Array<{ type?: string; id?: string }> {
  const relationships = resource.relationships;
  if (!isRecord(relationships)) return [];
  const relationship = relationships[name];
  if (!isRecord(relationship)) return [];
  const data = relationship.data;
  if (Array.isArray(data)) {
    return data.filter(isRecord).map((entry) => ({
      type: readString(entry.type) ?? undefined,
      id: readString(entry.id) ?? undefined,
    }));
  }
  if (isRecord(data)) {
    return [
      {
        type: readString(data.type) ?? undefined,
        id: readString(data.id) ?? undefined,
      },
    ];
  }
  return [];
}

function attributesOf(resource: KitsuResource): Record<string, unknown> {
  return isRecord(resource.attributes) ? resource.attributes : {};
}

function isAniListSite(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().toLowerCase() === ANILIST_SITE
  );
}

/**
 * Converts a Kitsu anime resource into Kaze's provider-independent summary.
 * The supplied `anilistId` is the canonical AniList ID — a Kitsu ID is never
 * used as a substitute.
 */
export function mapKitsuAnime(
  resource: KitsuResource,
  anilistId: number,
): AnimeSummary | null {
  if (!Number.isInteger(anilistId) || anilistId <= 0) return null;

  const attrs = attributesOf(resource);
  const titles = isRecord(attrs.titles) ? attrs.titles : {};
  const poster = isRecord(attrs.posterImage) ? attrs.posterImage : {};

  const canonical = readString(attrs.canonicalTitle);
  const english = readString(titles.en) ?? canonical;
  const romaji = readString(titles.en_jp) ?? canonical;
  const native = readString(titles.ja_jp);

  if (!english && !romaji && !native) {
    return null;
  }

  return {
    id: anilistId,
    title: { english, romaji, native },
    coverImage: {
      extraLarge:
        readString(poster.original) ??
        readString(poster.large) ??
        readString(poster.medium) ??
        null,
      large:
        readString(poster.large) ??
        readString(poster.medium) ??
        readString(poster.small) ??
        null,
      color: null,
    },
    format: mapKitsuFormat(attrs.subtype),
    episodes: parseEpisodeCount(attrs.episodeCount),
    averageScore: parseScore(attrs.averageRating),
    seasonYear: parseStartYear(attrs.startDate),
    status: mapKitsuStatus(attrs.status),
    genres: [],
  };
}

function toKitsuError(error: unknown): KitsuError {
  if (error instanceof KitsuError) return error;
  return new KitsuError("network", "Kitsu request failed", { cause: error });
}

/**
 * Secondary metadata provider.
 *
 * Kitsu is only used when a verified AniList mapping exists, and it always
 * reports provider failures explicitly so the catalogue can distinguish "this
 * provider is down" from "this provider returned no matches".
 */
export class KitsuClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: KitsuClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? KITSU_BASE;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  private async fetchJson(path: string): Promise<KitsuResponse> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { accept: "application/vnd.api+json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch (cause) {
      throw new KitsuError("network", "Could not reach Kitsu", { cause });
    }

    if (!response.ok) {
      throw new KitsuError(
        "http",
        `Kitsu request failed with status ${response.status}`,
        { status: response.status },
      );
    }

    let payload: KitsuResponse;
    try {
      payload = (await response.json()) as KitsuResponse;
    } catch (cause) {
      throw new KitsuError(
        "invalid_response",
        "Kitsu returned an unreadable response",
        { cause },
      );
    }

    if (!payload || typeof payload !== "object") {
      throw new KitsuError(
        "invalid_response",
        "Kitsu returned an unreadable response",
      );
    }

    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    if (errors.length > 0) {
      throw new KitsuError(
        "invalid_response",
        errors[0]?.detail ?? "Kitsu returned an error payload",
      );
    }

    return payload;
  }

  private listData(payload: KitsuResponse): KitsuResource[] {
    if (Array.isArray(payload.data)) return payload.data;
    if (isRecord(payload.data)) return [payload.data];
    return [];
  }

  private async fetchAnimeResource(
    kitsuId: number,
  ): Promise<KitsuResource | null> {
    try {
      const payload = await this.fetchJson(`/anime/${kitsuId}`);
      const data = payload.data;
      return isRecord(data) ? data : null;
    } catch (error) {
      if (error instanceof KitsuError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Resolves an anime by its canonical AniList ID through Kitsu's external
   * mapping table. Returns a discriminated outcome instead of `null` so that
   * "no mapping" is distinguishable from "provider down".
   */
  async getAnimeByAnilistId(
    anilistId: number,
  ): Promise<KitsuLookupResult> {
    if (!Number.isInteger(anilistId) || anilistId <= 0) {
      return { kind: "not_mapped", reason: "incomplete_mapping" };
    }

    try {
      const params = new URLSearchParams({
        "filter[externalSite]": ANILIST_SITE,
        "filter[externalId]": String(anilistId),
        include: "item",
        "page[limit]": "10",
      });

      const payload = await this.fetchJson(`/mappings?${params.toString()}`);
      const mappings = this.listData(payload).filter((resource) => {
        const attrs = attributesOf(resource);
        return (
          isAniListSite(attrs.externalSite) &&
          String(attrs.externalId ?? "") === String(anilistId)
        );
      });

      if (mappings.length === 0) {
        return { kind: "not_mapped", reason: "no_mapping" };
      }

      const kitsuIds = new Set<number>();
      for (const mapping of mappings) {
        for (const ref of relationshipRefs(mapping, "item")) {
          if (ref.type !== "anime") continue;
          const id = Number(ref.id);
          if (Number.isInteger(id) && id > 0) {
            kitsuIds.add(id);
          }
        }
      }

      if (kitsuIds.size === 0) {
        return { kind: "not_mapped", reason: "incomplete_mapping" };
      }

      if (kitsuIds.size > 1) {
        // Never guess which Kitsu entry belongs to this AniList ID.
        return { kind: "ambiguous", kitsuIds: [...kitsuIds].sort() };
      }

      const kitsuId = [...kitsuIds][0] as number;
      const included = (payload.included ?? []).find(
        (resource) =>
          resource.type === "anime" && resource.id === String(kitsuId),
      );
      const resource = included ?? (await this.fetchAnimeResource(kitsuId));
      if (!resource) {
        return { kind: "not_mapped", reason: "incomplete_mapping" };
      }

      const summary = mapKitsuAnime(resource, anilistId);
      if (!summary) {
        return { kind: "not_mapped", reason: "incomplete_mapping" };
      }

      const attrs = attributesOf(resource);
      const cover = isRecord(attrs.coverImage) ? attrs.coverImage : {};
      const bannerImage =
        readString(cover.original) ??
        readString(cover.large) ??
        readString(cover.small) ??
        null;

      return { kind: "found", summary, kitsuId, bannerImage };
    } catch (error) {
      return { kind: "error", error: toKitsuError(error) };
    }
  }

  /** First verified AniList mapping for a Kitsu search result, if unambiguous. */
  private anilistIdFor(
    resource: KitsuResource,
    included: KitsuResource[],
  ): number | null {
    const ids = new Set<number>();

    for (const ref of relationshipRefs(resource, "mappings")) {
      if (ref.type !== "mappings" || !ref.id) continue;
      const mapping = included.find(
        (candidate) =>
          candidate.type === "mappings" && candidate.id === ref.id,
      );
      if (!mapping) continue;
      const attrs = attributesOf(mapping);
      if (!isAniListSite(attrs.externalSite)) continue;
      const id = Number(attrs.externalId);
      if (Number.isInteger(id) && id > 0) {
        ids.add(id);
      }
    }

    // Ambiguous cross-mappings are skipped rather than guessed.
    return ids.size === 1 ? ([...ids][0] as number) : null;
  }

  /**
   * Searches Kitsu and keeps only entries with a verified AniList mapping.
   * Provider failures return `{ kind: "error" }`, never an empty list.
   */
  async searchAnime(
    query: string,
    limit = 20,
    offset = 0,
  ): Promise<KitsuSearchResult> {
    const clean = query.trim();
    if (!clean) {
      return { kind: "ok", items: [], skipped: 0, total: 0 };
    }

    const pageLimit = Math.min(
      MAX_SEARCH_LIMIT,
      Math.max(1, Math.trunc(limit)),
    );
    const pageOffset = Math.max(0, Math.trunc(offset));

    try {
      const params = new URLSearchParams({
        "filter[text]": clean,
        "page[limit]": String(pageLimit),
        "page[offset]": String(pageOffset),
        include: "mappings",
      });

      const payload = await this.fetchJson(`/anime?${params.toString()}`);
      const included = payload.included ?? [];
      const items: AnimeSummary[] = [];
      const seen = new Set<number>();
      let skipped = 0;

      for (const resource of this.listData(payload)) {
        const anilistId = this.anilistIdFor(resource, included);
        if (anilistId === null) {
          skipped += 1;
          continue;
        }
        if (seen.has(anilistId)) continue;

        const summary = mapKitsuAnime(resource, anilistId);
        if (!summary) {
          skipped += 1;
          continue;
        }

        seen.add(anilistId);
        items.push(summary);
      }

      const total =
        typeof payload.meta?.count === "number" &&
        Number.isFinite(payload.meta.count)
          ? payload.meta.count
          : null;

      return { kind: "ok", items, skipped, total };
    } catch (error) {
      return { kind: "error", error: toKitsuError(error) };
    }
  }
}

let defaultKitsuClient: KitsuClient | null = null;

export function getKitsuClient(): KitsuClient {
  defaultKitsuClient ??= new KitsuClient();
  return defaultKitsuClient;
}
