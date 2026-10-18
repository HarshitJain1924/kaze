import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyLibraryEntryUpdate,
  type LibraryEntryPatch,
} from "@/lib/library-rules";
import { computeStatusTransition } from "@/lib/validation/library";
import type { Database } from "@/types/database";
import type { LibraryEntry, WatchStatus } from "@/types/library";

type UserAnimeRow = Database["public"]["Tables"]["user_anime"]["Row"];

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
}

export function createLibraryRepository(
  client: SupabaseClient<Database>,
): LibraryRepository {
  return new LibraryRepository(createSupabaseLibraryStore(client));
}
