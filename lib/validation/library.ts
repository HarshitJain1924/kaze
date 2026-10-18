import { z } from "zod";

import { todayIsoDate } from "@/lib/utils";
import {
  MAX_NOTES_LENGTH,
  MAX_SCORE,
  MIN_SCORE,
  WATCH_STATUSES,
  type LibraryEntry,
  type WatchStatus,
} from "@/types/library";

export const watchStatusSchema = z.enum(WATCH_STATUSES);

export const anilistIdSchema = z
  .number()
  .int("Anime ID must be a whole number")
  .positive("Anime ID must be positive")
  .max(2_147_483_647, "Anime ID is out of range");

export const progressSchema = z
  .number()
  .int("Progress must be a whole number")
  .min(0, "Progress cannot be negative")
  .max(100_000, "Progress is unrealistically high");

export const scoreSchema = z
  .number()
  .int("Rating must be a whole number")
  .min(MIN_SCORE, `Rating must be at least ${MIN_SCORE}`)
  .max(MAX_SCORE, `Rating must be at most ${MAX_SCORE}`)
  .nullable();

export const notesSchema = z
  .string()
  .max(MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`)
  .nullable()
  .transform((value) => {
    if (value === null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const addToLibrarySchema = z.object({
  anilistId: anilistIdSchema,
  status: watchStatusSchema.default("planning"),
});

export const entryFieldsSchema = z.object({
  status: watchStatusSchema.optional(),
  progress: progressSchema.optional(),
  score: scoreSchema.optional(),
  notes: notesSchema.optional(),
});

const hasEntryChange = (value: z.infer<typeof entryFieldsSchema>) =>
  value.status !== undefined ||
  value.progress !== undefined ||
  value.score !== undefined ||
  value.notes !== undefined;

export const entryPatchSchema = entryFieldsSchema.refine(hasEntryChange, {
  message: "No changes were provided",
});

export const updateEntrySchema = entryFieldsSchema
  .extend({ anilistId: anilistIdSchema })
  .refine(hasEntryChange, { message: "No changes were provided" });

export const progressUpdateSchema = z.object({
  anilistId: anilistIdSchema,
  progress: progressSchema,
});

export const statusUpdateSchema = z.object({
  anilistId: anilistIdSchema,
  status: watchStatusSchema,
});

export const scoreUpdateSchema = z.object({
  anilistId: anilistIdSchema,
  score: scoreSchema,
});

export const notesUpdateSchema = z.object({
  anilistId: anilistIdSchema,
  notes: notesSchema,
});

export type AddToLibraryInput = z.infer<typeof addToLibrarySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export interface ProgressValidation {
  ok: boolean;
  message?: string;
}

/**
 * Progress can only be bounded when the provider reports a real episode
 * count. Unknown counts must remain editable.
 */
export function validateProgressAgainstEpisodes(
  progress: number,
  episodes: number | null,
): ProgressValidation {
  if (!Number.isInteger(progress) || progress < 0) {
    return { ok: false, message: "Progress must be a non-negative whole number" };
  }
  if (episodes !== null && episodes > 0 && progress > episodes) {
    return {
      ok: false,
      message: `Progress cannot exceed the known episode count (${episodes})`,
    };
  }
  return { ok: true };
}

export function isFiniteEpisodeCount(
  episodes: number | null,
): episodes is number {
  return episodes !== null && Number.isInteger(episodes) && episodes > 0;
}

export interface StatusTransition {
  status: WatchStatus;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Status changes preserve user data (rating, notes, progress).
 * Completing sets a completion date; reversing completion clears it.
 * Starting to watch records a start date only if one does not exist.
 */
export function computeStatusTransition(
  current: Pick<LibraryEntry, "status" | "startedAt" | "completedAt">,
  nextStatus: WatchStatus,
  today: string = todayIsoDate(),
): StatusTransition {
  const startedAt =
    nextStatus === "watching" && !current.startedAt
      ? today
      : current.startedAt;

  let completedAt = current.completedAt;
  if (nextStatus === "completed") {
    completedAt = current.completedAt ?? today;
  } else if (current.status === "completed") {
    completedAt = null;
  }

  return { status: nextStatus, startedAt, completedAt };
}

export const episodeNumberSchema = z
  .number()
  .int("Episode number must be an integer")
  .positive("Episode number must be greater than 0")
  .max(10_000, "Episode number is unrealistically high");

export const toggleEpisodeSchema = z.object({
  episodeNumber: episodeNumberSchema,
  watched: z.boolean(),
  totalEpisodes: z.number().int().positive().nullable().optional(),
});

export const bulkEpisodeSchema = z.object({
  action: z.enum(["markAll", "clearAll"]),
  totalEpisodes: z.number().int().positive().optional(),
});
