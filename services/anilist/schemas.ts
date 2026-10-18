import { z } from "zod";

import {
  ANIME_FORMATS,
  ANIME_RELEASE_STATUSES,
  ANIME_SEASONS,
} from "@/types/anime";

/**
 * Provider payloads are untrusted input. These schemas validate only the
 * fields the UI consumes and coerce unknown enum values to `null` rather
 * than crashing an entire page over one unexpected media entry.
 */

const stringOrNull = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

const intOrNull = z
  .number()
  .int()
  .nullish()
  .catch(null)
  .transform((value) => (typeof value === "number" ? value : null));

const scoreOrNull = z
  .number()
  .nullish()
  .catch(null)
  .transform((value) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : null,
  );

export const animeFormatSchema = z
  .enum(ANIME_FORMATS)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

export const animeSeasonSchema = z
  .enum(ANIME_SEASONS)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

export const animeReleaseStatusSchema = z
  .enum(ANIME_RELEASE_STATUSES)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

const titlesSchema = z
  .object({
    romaji: stringOrNull,
    english: stringOrNull,
    native: stringOrNull,
  })
  .catch({ romaji: null, english: null, native: null });

const coverImageSchema = z
  .object({
    extraLarge: stringOrNull,
    large: stringOrNull,
    color: stringOrNull,
  })
  .catch({ extraLarge: null, large: null, color: null });

const dateSchema = z
  .object({
    year: intOrNull,
    month: intOrNull,
    day: intOrNull,
  })
  .nullish()
  .catch(null);

export const animeSummarySchema = z.object({
  id: z.number().int().positive(),
  title: titlesSchema,
  coverImage: coverImageSchema,
  format: animeFormatSchema,
  episodes: intOrNull,
  averageScore: scoreOrNull,
  seasonYear: intOrNull,
  status: animeReleaseStatusSchema,
  genres: z
    .array(z.string())
    .nullish()
    .catch(null)
    .transform((value) => value ?? []),
});

const relationNodeSchema = animeSummarySchema.extend({
  type: z.string().nullish().catch(null),
});

const relationEdgeSchema = z.object({
  relationType: stringOrNull,
  node: relationNodeSchema,
});

export const animeSchema = animeSummarySchema.extend({
  bannerImage: stringOrNull,
  description: stringOrNull,
  season: animeSeasonSchema,
  duration: intOrNull,
  popularity: intOrNull,
  startDate: dateSchema,
  endDate: dateSchema,
  tags: z
    .array(
      z.object({
        name: z.string(),
        isMediaSpoiler: z.boolean().nullish().catch(null),
      }),
    )
    .nullish()
    .catch(null)
    .transform((value) => value ?? []),
  relations: z
    .object({
      edges: z
        .array(relationEdgeSchema)
        .nullish()
        .catch(null)
        .transform((value) => value ?? []),
    })
    .nullish()
    .catch(null),
});

export const pageInfoSchema = z.object({
  currentPage: intOrNull,
  lastPage: intOrNull,
  hasNextPage: z.boolean().nullish().catch(null),
  total: intOrNull,
});

export const mediaListPageSchema = z.object({
  pageInfo: pageInfoSchema,
  media: z.array(z.unknown()).nullish().catch(null),
});

export const mediaDetailsResponseSchema = z.object({
  Media: z.unknown(),
});

export type ValidatedAnime = z.infer<typeof animeSchema>;
export type ValidatedAnimeSummary = z.infer<typeof animeSummarySchema>;
