import { z } from "zod";

import {
  ANIME_FORMATS,
  ANIME_RELEASE_STATUSES,
  ANIME_SEASONS,
  MEDIA_FORMATS,
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

export const mediaFormatSchema = z
  .enum(MEDIA_FORMATS)
  .nullish()
  .catch(null)
  .transform((value) => value ?? null);

const rawMediaTypeSchema = z
  .enum(["ANIME", "MANGA"])
  .nullish()
  .catch(null);

const booleanOrFalse = z
  .boolean()
  .nullish()
  .catch(null)
  .transform((value) => value === true);

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
  type: rawMediaTypeSchema,
  title: titlesSchema,
  coverImage: coverImageSchema,
  bannerImage: stringOrNull.optional(),
  format: mediaFormatSchema,
  episodes: intOrNull,
  chapters: intOrNull,
  volumes: intOrNull,
  countryOfOrigin: stringOrNull,
  isAdult: booleanOrFalse,
  averageScore: scoreOrNull,
  seasonYear: intOrNull,
  status: animeReleaseStatusSchema,
  genres: z
    .array(z.string())
    .nullish()
    .catch(null)
    .transform((value) => value ?? []),
});

const relationNodeSchema = animeSummarySchema;

const relationEdgeSchema = z.object({
  relationType: stringOrNull,
  node: relationNodeSchema,
});

const voiceActorSchema = z.object({
  id: z.number().int(),
  name: z.object({
    full: z.string(),
    native: stringOrNull.optional(),
  }),
  image: z
    .object({
      medium: stringOrNull.optional(),
      large: stringOrNull.optional(),
    })
    .nullish()
    .catch(null),
  languageV2: stringOrNull.optional(),
});

const characterNodeSchema = z.object({
  id: z.number().int(),
  name: z.object({
    full: z.string(),
    native: stringOrNull.optional(),
  }),
  image: z
    .object({
      medium: stringOrNull.optional(),
      large: stringOrNull.optional(),
    })
    .nullish()
    .catch(null),
});

const characterEdgeSchema = z.object({
  role: z.string().nullish().catch(null),
  node: characterNodeSchema,
  voiceActors: z
    .array(voiceActorSchema)
    .nullish()
    .catch(null)
    .transform((value) => value ?? []),
});

const studioNodeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const recommendationNodeSchema = z.object({
  rating: z.number().int().nullish().catch(null),
  mediaRecommendation: animeSummarySchema.nullish().catch(null),
});

const trailerSchema = z
  .object({
    id: stringOrNull.optional(),
    site: stringOrNull.optional(),
    thumbnail: stringOrNull.optional(),
  })
  .nullish()
  .catch(null);

const externalLinkSchema = z.object({
  id: z.number().int(),
  url: z.string(),
  site: z.string(),
  type: stringOrNull.optional(),
  icon: stringOrNull.optional(),
  color: stringOrNull.optional(),
});

export const animeSchema = animeSummarySchema.extend({
  bannerImage: stringOrNull,
  description: stringOrNull,
  season: animeSeasonSchema,
  duration: intOrNull,
  popularity: intOrNull,
  startDate: dateSchema,
  endDate: dateSchema,
  studios: z
    .object({
      nodes: z
        .array(studioNodeSchema)
        .nullish()
        .catch(null)
        .transform((value) => value ?? []),
    })
    .nullish()
    .catch(null),
  trailer: trailerSchema,
  characters: z
    .object({
      edges: z
        .array(characterEdgeSchema)
        .nullish()
        .catch(null)
        .transform((value) => value ?? []),
    })
    .nullish()
    .catch(null),
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
  recommendations: z
    .object({
      nodes: z
        .array(recommendationNodeSchema)
        .nullish()
        .catch(null)
        .transform((value) => value ?? []),
    })
    .nullish()
    .catch(null),
  externalLinks: z
    .array(externalLinkSchema)
    .nullish()
    .catch(null)
    .transform((value) => value ?? []),
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

export const airingScheduleNodeSchema = z.object({
  id: z.number().int().positive(),
  airingAt: z.number().int(),
  timeUntilAiring: z.number().int(),
  episode: z.number().int().positive(),
  mediaId: z.number().int().positive(),
  media: z.unknown(),
});

export const airingSchedulePageSchema = z.object({
  pageInfo: pageInfoSchema,
  airingSchedules: z.array(z.unknown()).nullish().catch(null),
});

export type ValidatedAnime = z.infer<typeof animeSchema>;
export type ValidatedAnimeSummary = z.infer<typeof animeSummarySchema>;
export type ValidatedAiringScheduleNode = z.infer<
  typeof airingScheduleNodeSchema
>;
