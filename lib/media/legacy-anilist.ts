import {
  isCanonicalMediaId,
  type CanonicalMediaId,
  type MediaIdentityMapping,
  type MediaProviderRef,
} from "@/types/media";

const MAX_ANILIST_ID = 2_147_483_647;

export type LegacyAniListResolution =
  | {
      kind: "resolved";
      anilistId: number;
      mediaId: CanonicalMediaId;
      providerRef: MediaProviderRef;
    }
  | { kind: "unmapped"; anilistId: number }
  | {
      kind: "ambiguous";
      anilistId: number;
      mediaIds: CanonicalMediaId[];
    }
  | { kind: "invalid"; value: string | number };

export type AniListMappingIssueReason =
  | "invalid-canonical-media-id"
  | "invalid-external-id";

export interface AniListMappingIssue {
  mapping: MediaIdentityMapping;
  reason: AniListMappingIssueReason;
}

export interface AniListCompatibilityResolver {
  resolve(anilistId: number): LegacyAniListResolution;
  /** Malformed AniList mappings that were not usable by the resolver. */
  invalidMappings: readonly AniListMappingIssue[];
}

export function isLegacyAniListId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_ANILIST_ID
  );
}

/**
 * Parses a route segment or form value only when it is a plain positive
 * AniList ID. Scientific notation, decimals and URL syntax are rejected.
 */
export function parseLegacyAniListId(
  value: string | number,
): number | null {
  if (typeof value === "number") {
    return isLegacyAniListId(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return isLegacyAniListId(parsed) ? parsed : null;
}

/**
 * Builds a resolver from provider mappings. The canonical UUID comes from the
 * mapping; the AniList ID is only the lookup key.
 *
 * Malformed AniList mappings are returned in `invalidMappings` instead of
 * being silently treated as an empty mapping. Migration loaders should call
 * `assertValidAniListMappings` before accepting a mapping set.
 */
export function createAniListCompatibilityResolver(
  mappings: readonly MediaIdentityMapping[],
): AniListCompatibilityResolver {
  const byAniListId = new Map<number, Set<CanonicalMediaId>>();
  const invalidMappings: AniListMappingIssue[] = [];

  for (const mapping of mappings) {
    if (mapping.provider !== "anilist") continue;

    if (!isCanonicalMediaId(mapping.mediaId)) {
      invalidMappings.push({
        mapping,
        reason: "invalid-canonical-media-id",
      });
      continue;
    }

    const anilistId = parseLegacyAniListId(mapping.externalId);
    if (anilistId === null) {
      invalidMappings.push({
        mapping,
        reason: "invalid-external-id",
      });
      continue;
    }

    const existing = byAniListId.get(anilistId) ?? new Set();
    existing.add(mapping.mediaId);
    byAniListId.set(anilistId, existing);
  }

  const resolve = (anilistId: number): LegacyAniListResolution => {
    if (!isLegacyAniListId(anilistId)) {
      return { kind: "invalid", value: anilistId };
    }

    const mediaIds = [...(byAniListId.get(anilistId) ?? [])].sort();
    if (mediaIds.length === 0) {
      return { kind: "unmapped", anilistId };
    }
    if (mediaIds.length > 1) {
      return { kind: "ambiguous", anilistId, mediaIds };
    }

    const mediaId = mediaIds[0];
    if (!mediaId) {
      return { kind: "unmapped", anilistId };
    }

    return {
      kind: "resolved",
      anilistId,
      mediaId,
      providerRef: {
        provider: "anilist",
        externalId: String(anilistId),
      },
    };
  };

  return { resolve, invalidMappings };
}

/**
 * Fails loudly when a mapping set contains malformed AniList rows. This is
 * intended for migration/backfill loaders, not request-time resolution.
 */
export function assertValidAniListMappings(
  mappings: readonly MediaIdentityMapping[],
): void {
  const { invalidMappings } = createAniListCompatibilityResolver(mappings);
  if (invalidMappings.length === 0) return;

  const details = invalidMappings
    .map(
      ({ mapping, reason }) =>
        `${reason} (provider=${mapping.provider}, externalId=${JSON.stringify(mapping.externalId)})`,
    )
    .join("; ");

  throw new Error(`Invalid AniList identity mappings: ${details}`);
}

/** One-shot resolver for callers that already have a small mapping set. */
export function resolveLegacyAniListId(
  anilistId: number,
  mappings: readonly MediaIdentityMapping[] = [],
): LegacyAniListResolution {
  return createAniListCompatibilityResolver(mappings).resolve(anilistId);
}

/** Route-friendly variant that validates the raw numeric segment first. */
export function resolveLegacyAniListValue(
  value: string | number,
  mappings: readonly MediaIdentityMapping[] = [],
): LegacyAniListResolution {
  const anilistId = parseLegacyAniListId(value);
  return anilistId === null
    ? { kind: "invalid", value }
    : resolveLegacyAniListId(anilistId, mappings);
}
