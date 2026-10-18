import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyLibraryEntryUpdate,
  type LibraryEntryPatch,
} from "@/lib/library-rules";
import { todayIsoDate } from "@/lib/utils";
import { computeStatusTransition } from "@/lib/validation/library";
import type { Database } from "@/types/database";
import type { LibraryEntry, WatchStatus, WatchedEpisode } from "@/types/library";

type UserAnimeRow = Database["public"]["Tables"]["user_anime"]["Row"];
type UserAnimeEpisodeRow =
  Database["public"]["Tables"]["user_anime_episodes"]["Row"];

export class LibraryDataError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "LibraryDataError";
  }
}

export class LibraryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryConflictError";
  }
}

export class LibraryEntryNotFoundError extends Error {
  constructor(anilistId: number) {
    super(`No library entry exists for anime ${anilistId}`);
    this.name = "LibraryEntryNotFoundError";
  }
}

export interface NewLibraryEntry {
  userId: string;
  anilistId: number;
  status: WatchStatus;
  progress: number;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
}

/**
 * Persistence boundary for personal library data. Keeping this narrow makes
 * the repository testable without a live database while still using the
 * Supabase client in production.
 */
export interface LibraryStore {
  list(userId: string): Promise<LibraryEntry[]>;
  find(userId: string, anilistId: number): Promise<LibraryEntry | null>;
  insert(entry: NewLibraryEntry): Promise<LibraryEntry>;
  update(
    userId: string,
    anilistId: number,
    patch: LibraryEntryPatch,
  ): Promise<LibraryEntry | null>;
  remove(userId: string, anilistId: number): Promise<boolean>;
  listEpisodes(
    userId: string,
    anilistId?: number,
  ): Promise<WatchedEpisode[]>;
  recordEpisode(
    userId: string,
    anilistId: number,
    episodeNumber: number,
  ): Promise<WatchedEpisode>;
  removeEpisode(
    userId: string,
    anilistId: number,
    episodeNumber: number,
  ): Promise<boolean>;
  bulkRecordEpisodes(
    userId: string,
    anilistId: number,
    episodeNumbers: number[],
  ): Promise<void>;
  removeAllEpisodes(userId: string, anilistId: number): Promise<void>;
}

export function toWatchedEpisode(row: UserAnimeEpisodeRow): WatchedEpisode {
  return {
    id: row.id,
    userId: row.user_id,
    anilistId: row.anilist_id,
    episodeNumber: row.episode_number,
    watchedAt: row.watched_at,
    createdAt: row.created_at,
  };
}

export function toLibraryEntry(row: UserAnimeRow): LibraryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    anilistId: row.anilist_id,
    status: row.status,
    progress: row.progress,
    score: row.score,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRowPatch(patch: LibraryEntryPatch) {
  return {
    status: patch.status,
    progress: patch.progress,
    score: patch.score,
    notes: patch.notes,
    started_at: patch.startedAt,
    completed_at: patch.completedAt,
  };
}

export function createSupabaseLibraryStore(
  client: SupabaseClient<Database>,
): LibraryStore {
  return {
    async list(userId) {
      const { data, error } = await client
        .from("user_anime")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new LibraryDataError("Could not load your library", {
          cause: error,
        });
      }
      return (data ?? []).map(toLibraryEntry);
    },

    async find(userId, anilistId) {
      const { data, error } = await client
        .from("user_anime")
        .select("*")
        .eq("user_id", userId)
        .eq("anilist_id", anilistId)
        .maybeSingle();

      if (error) {
        throw new LibraryDataError("Could not load this library entry", {
          cause: error,
        });
      }
      return data ? toLibraryEntry(data) : null;
    },

    async insert(entry) {
      const { data, error } = await client
        .from("user_anime")
        .insert({
          user_id: entry.userId,
          anilist_id: entry.anilistId,
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
          started_at: entry.startedAt,
          completed_at: entry.completedAt,
          notes: entry.notes,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new LibraryConflictError(
            "This anime is already in your library",
          );
        }
        throw new LibraryDataError("Could not add this anime to your library", {
          cause: error,
        });
      }
      return toLibraryEntry(data);
    },

    async update(userId, anilistId, patch) {
      const { data, error } = await client
        .from("user_anime")
        .update(toRowPatch(patch))
        .eq("user_id", userId)
        .eq("anilist_id", anilistId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new LibraryDataError("Could not update this library entry", {
          cause: error,
        });
      }
      return data ? toLibraryEntry(data) : null;
    },

    async remove(userId, anilistId) {
      const { data, error } = await client
        .from("user_anime")
        .delete()
        .eq("user_id", userId)
        .eq("anilist_id", anilistId)
        .select("id");

      if (error) {
        throw new LibraryDataError("Could not remove this library entry", {
          cause: error,
        });
      }
      return (data?.length ?? 0) > 0;
    },

    async listEpisodes(userId, anilistId) {
      let query = client
        .from("user_anime_episodes")
        .select("*")
        .eq("user_id", userId);

      if (anilistId !== undefined) {
        query = query.eq("anilist_id", anilistId);
      }

      const { data, error } = await query.order("episode_number", {
        ascending: true,
      });

      if (error) {
        throw new LibraryDataError("Could not load watched episodes", {
          cause: error,
        });
      }
      return (data ?? []).map(toWatchedEpisode);
    },

    async recordEpisode(userId, anilistId, episodeNumber) {
      const { data, error } = await client
        .from("user_anime_episodes")
        .upsert(
          {
            user_id: userId,
            anilist_id: anilistId,
            episode_number: episodeNumber,
            watched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,anilist_id,episode_number" },
        )
        .select("*")
        .single();

      if (error) {
        throw new LibraryDataError("Could not record watched episode", {
          cause: error,
        });
      }
      return toWatchedEpisode(data);
    },

    async removeEpisode(userId, anilistId, episodeNumber) {
      const { data, error } = await client
        .from("user_anime_episodes")
        .delete()
        .eq("user_id", userId)
        .eq("anilist_id", anilistId)
        .eq("episode_number", episodeNumber)
        .select("id");

      if (error) {
        throw new LibraryDataError("Could not unmark watched episode", {
          cause: error,
        });
      }
      return (data?.length ?? 0) > 0;
    },

    async bulkRecordEpisodes(userId, anilistId, episodeNumbers) {
      if (episodeNumbers.length === 0) return;
      const rows = episodeNumbers.map((num) => ({
        user_id: userId,
        anilist_id: anilistId,
        episode_number: num,
        watched_at: new Date().toISOString(),
      }));

      const { error } = await client
        .from("user_anime_episodes")
        .upsert(rows, { onConflict: "user_id,anilist_id,episode_number" });

      if (error) {
        throw new LibraryDataError("Could not bulk record episodes", {
          cause: error,
        });
      }
    },

    async removeAllEpisodes(userId, anilistId) {
      const { error } = await client
        .from("user_anime_episodes")
        .delete()
        .eq("user_id", userId)
        .eq("anilist_id", anilistId);

      if (error) {
        throw new LibraryDataError("Could not clear watched episodes", {
          cause: error,
        });
      }
    },
  };
}

/**
 * Personal-library operations. All writes are scoped to a user id, and the
 * database enforces the same boundary through row level security.
 */
export class LibraryRepository {
  constructor(private readonly store: LibraryStore) {}

  list(userId: string): Promise<LibraryEntry[]> {
    return this.store.list(userId);
  }

  find(userId: string, anilistId: number): Promise<LibraryEntry | null> {
    return this.store.find(userId, anilistId);
  }

  /**
   * Adds an anime at most once per user. A repeated request returns the
   * existing entry instead of creating a duplicate or losing its progress.
   */
  async add(
    userId: string,
    input: { anilistId: number; status: WatchStatus },
  ): Promise<{ entry: LibraryEntry; created: boolean }> {
    const existing = await this.store.find(userId, input.anilistId);
    if (existing) {
      return { entry: existing, created: false };
    }

    const transition = computeStatusTransition(
      { status: "planning", startedAt: null, completedAt: null },
      input.status,
    );

    try {
      const entry = await this.store.insert({
        userId,
        anilistId: input.anilistId,
        status: input.status,
        progress: 0,
        score: null,
        startedAt: transition.startedAt,
        completedAt: transition.completedAt,
        notes: null,
      });
      return { entry, created: true };
    } catch (error) {
      // A concurrent request may have inserted the same row between the
      // read above and this insert; the unique constraint is the source of
      // truth, so return the winner.
      if (error instanceof LibraryConflictError) {
        const concurrent = await this.store.find(userId, input.anilistId);
        if (concurrent) {
          return { entry: concurrent, created: false };
        }
      }
      throw error;
    }
  }

  async update(
    userId: string,
    anilistId: number,
    patch: LibraryEntryPatch,
    episodes: number | null,
  ): Promise<LibraryEntry> {
    const current = await this.store.find(userId, anilistId);
    if (!current) {
      throw new LibraryEntryNotFoundError(anilistId);
    }

    const applied = applyLibraryEntryUpdate(current, patch, episodes);
    const updated = await this.store.update(userId, anilistId, applied);
    if (!updated) {
      throw new LibraryEntryNotFoundError(anilistId);
    }
    return updated;
  }

  async remove(userId: string, anilistId: number): Promise<void> {
    const removed = await this.store.remove(userId, anilistId);
    if (!removed) {
      throw new LibraryEntryNotFoundError(anilistId);
    }
  }

  listEpisodes(userId: string, anilistId?: number): Promise<WatchedEpisode[]> {
    return this.store.listEpisodes(userId, anilistId);
  }

  async getWatchedEpisodes(
    userId: string,
    anilistId: number,
  ): Promise<number[]> {
    const list = await this.store.listEpisodes(userId, anilistId);
    return list.map((item) => item.episodeNumber).sort((a, b) => a - b);
  }

  async toggleEpisode(
    userId: string,
    anilistId: number,
    episodeNumber: number,
    watched: boolean,
    totalEpisodes: number | null,
  ): Promise<{ watchedEpisodes: number[]; entry: LibraryEntry }> {
    let current = await this.store.find(userId, anilistId);
    if (!current) {
      const created = await this.add(userId, { anilistId, status: "watching" });
      current = created.entry;
    }

    if (watched) {
      await this.store.recordEpisode(userId, anilistId, episodeNumber);
    } else {
      await this.store.removeEpisode(userId, anilistId, episodeNumber);
    }

    const remaining = await this.store.listEpisodes(userId, anilistId);
    const watchedEpisodes = remaining
      .map((item) => item.episodeNumber)
      .sort((a, b) => a - b);

    const newProgress =
      watchedEpisodes.length > 0 ? Math.max(...watchedEpisodes) : 0;

    const patch: LibraryEntryPatch = { progress: newProgress };

    if (
      watched &&
      totalEpisodes !== null &&
      totalEpisodes > 0 &&
      watchedEpisodes.length >= totalEpisodes
    ) {
      patch.status = "completed";
      patch.completedAt = current.completedAt ?? todayIsoDate();
    } else if (watched && current.status === "planning") {
      patch.status = "watching";
      patch.startedAt = current.startedAt ?? todayIsoDate();
    } else if (!watched && current.status === "completed") {
      patch.status = "watching";
      patch.completedAt = null;
    }

    const updatedEntry = await this.update(
      userId,
      anilistId,
      patch,
      totalEpisodes,
    );

    return { watchedEpisodes, entry: updatedEntry };
  }

  async markAllEpisodes(
    userId: string,
    anilistId: number,
    totalEpisodes: number,
  ): Promise<{ watchedEpisodes: number[]; entry: LibraryEntry }> {
    if (!Number.isInteger(totalEpisodes) || totalEpisodes <= 0) {
      throw new LibraryDataError("Total episodes must be a positive integer");
    }

    let current = await this.store.find(userId, anilistId);
    if (!current) {
      const created = await this.add(userId, { anilistId, status: "watching" });
      current = created.entry;
    }

    const episodeNumbers = Array.from(
      { length: totalEpisodes },
      (_, i) => i + 1,
    );
    await this.store.bulkRecordEpisodes(userId, anilistId, episodeNumbers);

    const updatedEntry = await this.update(
      userId,
      anilistId,
      {
        progress: totalEpisodes,
        status: "completed",
        completedAt: current.completedAt ?? todayIsoDate(),
      },
      totalEpisodes,
    );

    return { watchedEpisodes: episodeNumbers, entry: updatedEntry };
  }

  async clearAllEpisodes(
    userId: string,
    anilistId: number,
    totalEpisodes: number | null,
  ): Promise<{ watchedEpisodes: number[]; entry: LibraryEntry }> {
    const current = await this.store.find(userId, anilistId);
    if (!current) {
      throw new LibraryEntryNotFoundError(anilistId);
    }

    await this.store.removeAllEpisodes(userId, anilistId);

    const patch: LibraryEntryPatch = { progress: 0 };
    if (current.status === "completed") {
      patch.status = "watching";
      patch.completedAt = null;
    }

    const updatedEntry = await this.update(
      userId,
      anilistId,
      patch,
      totalEpisodes,
    );

    return { watchedEpisodes: [], entry: updatedEntry };
  }
}

export function createLibraryRepository(
  client: SupabaseClient<Database>,
): LibraryRepository {
  return new LibraryRepository(createSupabaseLibraryStore(client));
}
