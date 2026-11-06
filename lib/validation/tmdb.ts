import { z } from "zod";

import {
  MAX_NOTES_LENGTH,
  MAX_SCORE,
  MIN_SCORE,
  WATCH_STATUSES,
} from "@/types/library";
import {
  tmdbDiscoverCategoriesForKind,
  type TmdbDiscoverCategory,
} from "@/types/tmdb";

export const tmdbKindSchema = z.enum(["movie", "tv"]);

export const tmdbIdSchema = z
  .number()
  .int("TMDB ID must be a whole number")
  .positive("TMDB ID must be positive")
  .max(2_147_483_647, "TMDB ID is out of range");

export const tmdbSearchQuerySchema = z
  .string()
  .trim()
  .min(1, "Enter a title to search for")
  .max(100, "Search terms must be 100 characters or fewer");

export const tmdbSearchParamsSchema = z.object({
  kind: tmdbKindSchema.default("movie"),
  q: tmdbSearchQuerySchema,
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export const tmdbDiscoverCategorySchema = z.enum([
  "trending",
  "popular",
  "top_rated",
  "upcoming",
  "on_the_air",
]);

export const tmdbDiscoverParamsSchema = z
  .object({
    kind: tmdbKindSchema.default("movie"),
    category: tmdbDiscoverCategorySchema.default("trending"),
    page: z.coerce.number().int().min(1).max(500).default(1),
  })
  .superRefine((value, context) => {
    if (
      !tmdbDiscoverCategoriesForKind(value.kind).includes(
        value.category as TmdbDiscoverCategory,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["category"],
        message: `Unsupported discovery category for ${value.kind}`,
      });
    }
  });

export const tmdbStatusSchema = z.enum(WATCH_STATUSES);

export const addTmdbEntrySchema = z.object({
  kind: tmdbKindSchema,
  tmdbId: tmdbIdSchema,
  status: tmdbStatusSchema.default("planning"),
});

export const tmdbEntryPatchSchema = z
  .object({
    status: tmdbStatusSchema.optional(),
    score: z
      .number()
      .int("Rating must be a whole number")
      .min(MIN_SCORE)
      .max(MAX_SCORE)
      .nullable()
      .optional(),
    notes: z
      .string()
      .max(
        MAX_NOTES_LENGTH,
        `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`,
      )
      .nullable()
      .optional(),
    watched: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.score !== undefined ||
      value.notes !== undefined ||
      value.watched !== undefined,
    { message: "No changes were provided" },
  );

export const episodeRefSchema = z.object({
  seasonNumber: z.number().int().min(0).max(100),
  episodeNumber: z.number().int().positive().max(10_000),
});

export const setEpisodesSchema = z.object({
  episodes: z
    .array(episodeRefSchema)
    .min(1, "Choose at least one episode")
    .max(1_000, "Too many episodes in one request"),
  watched: z.boolean(),
});

export const clearEpisodesSchema = z.object({
  action: z.literal("clearAll"),
});

export const episodeActionSchema = z.union([
  setEpisodesSchema,
  clearEpisodesSchema,
]);

export type AddTmdbEntryInput = z.infer<typeof addTmdbEntrySchema>;
export type TmdbEntryPatch = z.infer<typeof tmdbEntryPatchSchema>;
export type EpisodeRef = z.infer<typeof episodeRefSchema>;
export type TmdbDiscoverParams = z.infer<typeof tmdbDiscoverParamsSchema>;
