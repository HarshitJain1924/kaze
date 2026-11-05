import { describe, expect, it } from "vitest";

import {
  assertValidAniListMappings,
  createAniListCompatibilityResolver,
  isLegacyAniListId,
  parseLegacyAniListId,
  resolveLegacyAniListId,
  resolveLegacyAniListValue,
} from "@/lib/media/legacy-anilist";
import {
  toCanonicalMediaId,
  type CanonicalMediaId,
  type MediaIdentityMapping,
} from "@/types/media";

const FIRST_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECOND_ID = "223e4567-e89b-42d3-a456-426614174000";

function mediaId(value: string): CanonicalMediaId {
  const id = toCanonicalMediaId(value);
  if (!id) throw new Error(`Invalid test media id: ${value}`);
  return id;
}

function mapping(
  mediaIdValue: string,
  externalId: string,
  provider: MediaIdentityMapping["provider"] = "anilist",
): MediaIdentityMapping {
  return {
    mediaId: mediaId(mediaIdValue),
    provider,
    externalId,
  };
}

describe("legacy AniList ID parsing", () => {
  it("accepts only plain positive integer IDs", () => {
    expect(parseLegacyAniListId("16498")).toBe(16498);
    expect(parseLegacyAniListId(16498)).toBe(16498);
    expect(parseLegacyAniListId(" 0016498 ")).toBe(16498);
    expect(parseLegacyAniListId("12.5")).toBeNull();
    expect(parseLegacyAniListId("1e3")).toBeNull();
    expect(parseLegacyAniListId("-1")).toBeNull();
    expect(parseLegacyAniListId("0")).toBeNull();
    expect(parseLegacyAniListId("abc")).toBeNull();
    expect(parseLegacyAniListId(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it("guards the legacy ID range", () => {
    expect(isLegacyAniListId(1)).toBe(true);
    expect(isLegacyAniListId(2_147_483_647)).toBe(true);
    expect(isLegacyAniListId(2_147_483_648)).toBe(false);
    expect(isLegacyAniListId(1.2)).toBe(false);
  });
});

describe("AniList compatibility resolver", () => {
  it("resolves a mapping to a canonical UUID rather than the external ID", () => {
    const result = resolveLegacyAniListId(16498, [
      mapping(FIRST_ID, "16498"),
    ]);

    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") throw new Error("expected resolution");
    expect(result.mediaId).toBe(FIRST_ID);
    expect(result.providerRef).toMatchObject({
      provider: "anilist",
      externalId: "16498",
    });
  });

  it("returns unmapped when no canonical mapping exists yet", () => {
    expect(resolveLegacyAniListId(16498)).toEqual({
      kind: "unmapped",
      anilistId: 16498,
    });
  });

  it("does not guess when one AniList ID has ambiguous mappings", () => {
    const result = resolveLegacyAniListId(16498, [
      mapping(FIRST_ID, "16498"),
      mapping(SECOND_ID, "16498"),
    ]);

    expect(result.kind).toBe("ambiguous");
    if (result.kind !== "ambiguous") throw new Error("expected ambiguity");
    expect(result.mediaIds).toEqual([FIRST_ID, SECOND_ID]);
  });

  it("deduplicates repeated mappings to the same canonical record", () => {
    const resolver = createAniListCompatibilityResolver([
      mapping(FIRST_ID, "16498"),
      mapping(FIRST_ID, "16498"),
    ]);

    expect(resolver.resolve(16498).kind).toBe("resolved");
  });

  it("ignores non-AniList providers during AniList lookup", () => {
    const resolver = createAniListCompatibilityResolver([
      mapping(FIRST_ID, "16498", "tmdb"),
    ]);

    expect(resolver.resolve(16498).kind).toBe("unmapped");
    expect(resolver.invalidMappings).toEqual([]);
  });

  it("reports malformed AniList mappings instead of silently dropping them", () => {
    const resolver = createAniListCompatibilityResolver([
      mapping(FIRST_ID, "16498"),
      {
        mediaId: "not-a-uuid" as CanonicalMediaId,
        provider: "anilist",
        externalId: "16498",
      },
      {
        mediaId: mediaId(FIRST_ID),
        provider: "anilist",
        externalId: "not-an-id",
      },
    ]);

    expect(resolver.resolve(16498).kind).toBe("resolved");
    expect(resolver.invalidMappings.map((issue) => issue.reason)).toEqual([
      "invalid-canonical-media-id",
      "invalid-external-id",
    ]);
  });

  it("fails loudly when a migration loader receives malformed mappings", () => {
    expect(() =>
      assertValidAniListMappings([mapping(FIRST_ID, "16498")]),
    ).not.toThrow();

    expect(() =>
      assertValidAniListMappings([
        {
          mediaId: "not-a-uuid" as CanonicalMediaId,
          provider: "anilist",
          externalId: "16498",
        },
      ]),
    ).toThrow(/Invalid AniList identity mappings/);
  });

  it("resolves the upper AniList ID boundary", () => {
    const result = resolveLegacyAniListId(2_147_483_647, [
      mapping(FIRST_ID, "2147483647"),
    ]);

    expect(result.kind).toBe("resolved");
  });

  it("rejects invalid resolver values at the lower boundary and beyond", () => {
    for (const value of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      2_147_483_648,
    ]) {
      const result = resolveLegacyAniListId(value);
      expect(result.kind).toBe("invalid");
      if (result.kind === "invalid") {
        expect(result.value).toBe(value);
      }
    }
  });

  it("resolves route-friendly values and rejects invalid segments", () => {
    const mappings = [mapping(FIRST_ID, "16498")];

    const resolved = resolveLegacyAniListValue("16498", mappings);
    expect(resolved.kind).toBe("resolved");
    expect(resolveLegacyAniListValue(16498, mappings).kind).toBe("resolved");
    expect(resolveLegacyAniListValue("12.5", mappings)).toEqual({
      kind: "invalid",
      value: "12.5",
    });
  });
});
