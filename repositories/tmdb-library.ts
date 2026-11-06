import type { SupabaseClient } from "@supabase/supabase-js";

import { todayIsoDate } from "@/lib/utils";
import type { EpisodeRef, TmdbEntryPatch } from "@/lib/validation/tmdb";
import { computeStatusTransition } from "@/lib/validation/library";
import type { Database } from "@/types/database";
import type { TmdbDetails, TmdbKind } from "@/types/tmdb";
import type { WatchStatus } from "@/types/library";
import type {
  TmdbLibraryEntry,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

type EntryRow = Database["public"]["Tables"]["user_tmdb_entries"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["user_tmdb_episodes"]["Row"];

export class TmdbLibraryDataError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = "TmdbLibraryDataError";
  }
}

export class TmdbLibraryConflictError extends Error {
  constructor(message = "This title is already in your library") {
    super(message);
    this.name = "TmdbLibraryConflictError";
  }
}

export class TmdbLibraryNotFoundError extends Error {
  constructor(kind: TmdbKind, tmdbId: number) {
    super(`No library entry exists for ${kind} ${tmdbId}`);
    this.name = "TmdbLibraryNotFoundError";
  }
}

export interface NewTmdbEntry {
  userId: string;
  tmdbId: number;
  mediaType: TmdbKind;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  status: WatchStatus;
  watched: boolean;
  totalEpisodes: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export type TmdbEntryRowPatch = Partial<
  Pick<
    EntryRow,
    | "status"
    | "score"
    | "notes"
    | "watched"
    | "started_at"
    | "completed_at"
    | "total_episodes"
  >
>;

export interface TmdbLibraryStore {
  list(userId: string): Promise<TmdbLibraryEntry[]>;
  find(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
  ): Promise<TmdbLibraryEntry | null>;
  insert(input: NewTmdbEntry): Promise<TmdbLibraryEntry>;
  update(
    userId: string,
    entryId: string,
    patch: TmdbEntryRowPatch,
  ): Promise<TmdbLibraryEntry | null>;
  remove(userId: string, entryId: string): Promise<boolean>;
  listEpisodes(
    userId: string,
    entryId?: string,
  ): Promise<TmdbWatchedEpisode[]>;
  upsertEpisodes(
    entryId: string,
    userId: string,
    episodes: EpisodeRef[],
  ): Promise<void>;
  deleteEpisodes(
    entryId: string,
    userId: string,
    episodes: EpisodeRef[],
  ): Promise<void>;
  deleteAllEpisodes(entryId: string, userId: string): Promise<void>;
}

export function toTmdbLibraryEntry(row: EntryRow): TmdbLibraryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    originalTitle: row.original_title,
    overview: row.overview,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    releaseDate: row.release_date,
    status: row.status,
    score: row.score,
    notes: row.notes,
    watched: row.watched,
    totalEpisodes: row.total_episodes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeNotes(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toWatchedEpisode(row: EpisodeRow): TmdbWatchedEpisode {
  return {
    id: row.id,
    entryId: row.entry_id,
    userId: row.user_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    watchedAt: row.watched_at,
  };
}

export function createSupabaseTmdbStore(
  client: SupabaseClient<Database>,
): TmdbLibraryStore {
  return {
    async list(userId) {
      const { data, error } = await client
        .from("user_tmdb_entries")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new TmdbLibraryDataError("Could not load your film library", {
          cause: error,
        });
      }
      return (data ?? []).map(toTmdbLibraryEntry);
    },

    async find(userId, kind, tmdbId) {
      const { data, error } = await client
        .from("user_tmdb_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("media_type", kind)
        .eq("tmdb_id", tmdbId)
        .maybeSingle();

      if (error) {
        throw new TmdbLibraryDataError("Could not load this library entry", {
          cause: error,
        });
      }
      return data ? toTmdbLibraryEntry(data) : null;
    },

    async insert(input) {
      const { data, error } = await client
        .from("user_tmdb_entries")
        .insert({
          user_id: input.userId,
          tmdb_id: input.tmdbId,
          media_type: input.mediaType,
          title: input.title,
          original_title: input.originalTitle,
          overview: input.overview,
          poster_path: input.posterPath,
          backdrop_path: input.backdropPath,
          release_date: input.releaseDate,
          status: input.status,
          watched: input.watched,
          total_episodes: input.totalEpisodes,
          started_at: input.startedAt,
          completed_at: input.completedAt,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new TmdbLibraryConflictError();
        }
        throw new TmdbLibraryDataError("Could not add this title", {
          cause: error,
        });
      }
      return toTmdbLibraryEntry(data);
    },

    async update(userId, entryId, patch) {
      const { data, error } = await client
        .from("user_tmdb_entries")
        .update(patch)
        .eq("user_id", userId)
        .eq("id", entryId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new TmdbLibraryDataError("Could not update this entry", {
          cause: error,
        });
      }
      return data ? toTmdbLibraryEntry(data) : null;
    },

    async remove(userId, entryId) {
      const { data, error } = await client
        .from("user_tmdb_entries")
        .delete()
        .eq("user_id", userId)
        .eq("id", entryId)
        .select("id");

      if (error) {
        throw new TmdbLibraryDataError("Could not remove this entry", {
          cause: error,
        });
      }
      return (data?.length ?? 0) > 0;
    },

    async listEpisodes(userId, entryId) {
      let query = client
        .from("user_tmdb_episodes")
        .select("*")
        .eq("user_id", userId);

      if (entryId) {
        query = query.eq("entry_id", entryId);
      }

      const { data, error } = await query
        .order("season_number", { ascending: true })
        .order("episode_number", { ascending: true });

      if (error) {
        throw new TmdbLibraryDataError("Could not load watched episodes", {
          cause: error,
        });
      }
      return (data ?? []).map(toWatchedEpisode);
    },

    async upsertEpisodes(entryId, userId, episodes) {
      if (episodes.length === 0) return;
      const watchedAt = new Date().toISOString();
      const rows = episodes.map((episode) => ({
        entry_id: entryId,
        user_id: userId,
        season_number: episode.seasonNumber,
        episode_number: episode.episodeNumber,
        watched_at: watchedAt,
      }));

      const { error } = await client
        .from("user_tmdb_episodes")
        .upsert(rows, {
          onConflict: "entry_id,season_number,episode_number",
        });

      if (error) {
        throw new TmdbLibraryDataError("Could not save watched episodes", {
          cause: error,
        });
      }
    },

    async deleteEpisodes(entryId, userId, episodes) {
      if (episodes.length === 0) return;
      const filter = episodes
        .map(
          (episode) =>
            `and(season_number.eq.${episode.seasonNumber},episode_number.eq.${episode.episodeNumber})`,
        )
        .join(",");

      const { error } = await client
        .from("user_tmdb_episodes")
        .delete()
        .eq("entry_id", entryId)
        .eq("user_id", userId)
        .or(filter);

      if (error) {
        throw new TmdbLibraryDataError("Could not update watched episodes", {
          cause: error,
        });
      }
    },

    async deleteAllEpisodes(entryId, userId) {
      const { error } = await client
        .from("user_tmdb_episodes")
        .delete()
        .eq("entry_id", entryId)
        .eq("user_id", userId);

      if (error) {
        throw new TmdbLibraryDataError("Could not clear watched episodes", {
          cause: error,
        });
      }
    },
  };
}

/**
 * Business rules for the movie/TV library. Progress for television is always
 * derived from explicit watched-episode rows, never from a toggle counter.
 */
export class TmdbLibraryRepository {
  constructor(private readonly store: TmdbLibraryStore) {}

  list(userId: string): Promise<TmdbLibraryEntry[]> {
    return this.store.list(userId);
  }

  find(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
  ): Promise<TmdbLibraryEntry | null> {
    return this.store.find(userId, kind, tmdbId);
  }

  listWatchedEpisodes(
    userId: string,
    entryId?: string,
  ): Promise<TmdbWatchedEpisode[]> {
    return this.store.listEpisodes(userId, entryId);
  }

  async add(
    userId: string,
    details: TmdbDetails,
    status: WatchStatus,
  ): Promise<{ entry: TmdbLibraryEntry; created: boolean }> {
    const existing = await this.store.find(
      userId,
      details.kind,
      details.tmdbId,
    );
    if (existing) return { entry: existing, created: false };

    const transition = computeStatusTransition(
      { status: "planning", startedAt: null, completedAt: null },
      status,
    );

    try {
      const entry = await this.store.insert({
        userId,
        tmdbId: details.tmdbId,
        mediaType: details.kind,
        title: details.title,
        originalTitle: details.originalTitle,
        overview: details.overview,
        posterPath: details.posterUrl,
        backdropPath: details.backdropUrl,
        releaseDate: details.releaseDate,
        status,
        watched: details.kind === "movie" && status === "completed",
        totalEpisodes:
          details.kind === "tv" ? details.numberOfEpisodes : null,
        startedAt: transition.startedAt,
        completedAt: transition.completedAt,
      });
      return { entry, created: true };
    } catch (error) {
      if (error instanceof TmdbLibraryConflictError) {
        const concurrent = await this.store.find(
          userId,
          details.kind,
          details.tmdbId,
        );
        if (concurrent) return { entry: concurrent, created: false };
      }
      throw error;
    }
  }

  async update(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
    patch: TmdbEntryPatch,
  ): Promise<TmdbLibraryEntry> {
    const current = await this.store.find(userId, kind, tmdbId);
    if (!current) throw new TmdbLibraryNotFoundError(kind, tmdbId);

    let status = current.status;
    let watched = current.watched;
    let startedAt = current.startedAt;
    let completedAt = current.completedAt;

    if (patch.status !== undefined) {
      const transition = computeStatusTransition(current, patch.status);
      status = patch.status;
      startedAt = transition.startedAt;
      completedAt = transition.completedAt;
      if (kind === "movie") watched = patch.status === "completed";
    }

    if (patch.watched !== undefined) {
      if (kind !== "movie") {
        throw new TmdbLibraryDataError(
          "TV progress is tracked per episode, not with a watched flag",
        );
      }
      watched = patch.watched;
      if (watched) {
        status = "completed";
        completedAt = completedAt ?? todayIsoDate();
      } else if (status === "completed") {
        status = "watching";
        completedAt = null;
      }
    }

    const updated = await this.store.update(userId, current.id, {
      ...(patch.status !== undefined || patch.watched !== undefined
        ? { status }
        : {}),
      ...(patch.score !== undefined ? { score: patch.score } : {}),
      ...(patch.notes !== undefined
        ? { notes: normalizeNotes(patch.notes) }
        : {}),
      ...(patch.watched !== undefined || patch.status !== undefined
        ? { watched }
        : {}),
      ...(patch.status !== undefined || patch.watched !== undefined
        ? { started_at: startedAt, completed_at: completedAt }
        : {}),
    });

    if (!updated) throw new TmdbLibraryNotFoundError(kind, tmdbId);
    return updated;
  }

  async remove(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
  ): Promise<void> {
    const current = await this.store.find(userId, kind, tmdbId);
    if (!current) throw new TmdbLibraryNotFoundError(kind, tmdbId);
    const removed = await this.store.remove(userId, current.id);
    if (!removed) throw new TmdbLibraryNotFoundError(kind, tmdbId);
  }

  async setEpisodes(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
    episodes: EpisodeRef[],
    watched: boolean,
  ): Promise<{ entry: TmdbLibraryEntry; watchedEpisodes: TmdbWatchedEpisode[] }> {
    if (kind !== "tv") {
      throw new TmdbLibraryDataError("Movie progress is a single watched flag");
    }

    const current = await this.store.find(userId, kind, tmdbId);
    if (!current) throw new TmdbLibraryNotFoundError(kind, tmdbId);

    if (watched) {
      await this.store.upsertEpisodes(current.id, userId, episodes);
    } else {
      await this.store.deleteEpisodes(current.id, userId, episodes);
    }

    const all = await this.store.listEpisodes(userId, current.id);
    const count = all.length;
    const total = current.totalEpisodes;

    let status = current.status;
    let startedAt = current.startedAt;
    let completedAt = current.completedAt;

    if (count > 0 && status === "planning") {
      status = "watching";
      startedAt = startedAt ?? todayIsoDate();
    }

    if (total !== null && total > 0 && count >= total) {
      status = "completed";
      completedAt = completedAt ?? todayIsoDate();
    } else if (status === "completed") {
      status = "watching";
      completedAt = null;
    }

    const updated = await this.store.update(userId, current.id, {
      status,
      started_at: startedAt,
      completed_at: completedAt,
    });

    if (!updated) throw new TmdbLibraryNotFoundError(kind, tmdbId);
    return { entry: updated, watchedEpisodes: all };
  }

  async clearEpisodes(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
  ): Promise<{ entry: TmdbLibraryEntry; watchedEpisodes: TmdbWatchedEpisode[] }> {
    if (kind !== "tv") {
      throw new TmdbLibraryDataError("Movie progress is a single watched flag");
    }

    const current = await this.store.find(userId, kind, tmdbId);
    if (!current) throw new TmdbLibraryNotFoundError(kind, tmdbId);

    await this.store.deleteAllEpisodes(current.id, userId);
    const updated = await this.store.update(userId, current.id, {
      status: current.status === "completed" ? "watching" : current.status,
      completed_at: current.status === "completed" ? null : current.completedAt,
    });

    if (!updated) throw new TmdbLibraryNotFoundError(kind, tmdbId);
    return { entry: updated, watchedEpisodes: [] };
  }
}

export function createTmdbLibraryRepository(
  client: SupabaseClient<Database>,
): TmdbLibraryRepository {
  return new TmdbLibraryRepository(createSupabaseTmdbStore(client));
}
