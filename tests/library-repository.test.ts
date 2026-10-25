import { describe, expect, it } from "vitest";

import { LibraryProgressError, type LibraryEntryPatch } from "@/lib/library-rules";
import {
  LibraryConflictError,
  LibraryEntryNotFoundError,
  LibraryRepository,
  type LibraryStore,
  type NewLibraryEntry,
} from "@/repositories/library";
import type { LibraryEntry, WatchedEpisode } from "@/types/library";

function key(userId: string, anilistId: number) {
  return `${userId}:${anilistId}`;
}

class MemoryStore implements LibraryStore {
  protected rows = new Map<string, LibraryEntry>();
  protected episodes = new Map<string, WatchedEpisode>();
  private counter = 0;

  constructor(seed: LibraryEntry[] = []) {
    for (const entry of seed) {
      this.rows.set(key(entry.userId, entry.anilistId), entry);
    }
  }

  async list(userId: string): Promise<LibraryEntry[]> {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async find(userId: string, anilistId: number): Promise<LibraryEntry | null> {
    return this.rows.get(key(userId, anilistId)) ?? null;
  }

  async insert(entry: NewLibraryEntry): Promise<LibraryEntry> {
    const rowKey = key(entry.userId, entry.anilistId);
    if (this.rows.has(rowKey)) {
      throw new LibraryConflictError("duplicate");
    }
    this.counter += 1;
    const now = new Date().toISOString();
    const row: LibraryEntry = {
      ...entry,
      id: `row-${this.counter}`,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(rowKey, row);
    return row;
  }

  async update(
    userId: string,
    anilistId: number,
    patch: LibraryEntryPatch,
  ): Promise<LibraryEntry | null> {
    const rowKey = key(userId, anilistId);
    const existing = this.rows.get(rowKey);
    if (!existing) {
      return null;
    }
    const next: LibraryEntry = { ...existing };
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.progress !== undefined) next.progress = patch.progress;
    if (patch.score !== undefined) next.score = patch.score;
    if (patch.notes !== undefined) next.notes = patch.notes;
    if (patch.startedAt !== undefined) next.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) next.completedAt = patch.completedAt;
    next.updatedAt = new Date().toISOString();
    this.rows.set(rowKey, next);
    return next;
  }

  async remove(userId: string, anilistId: number): Promise<boolean> {
    await this.removeAllEpisodes(userId, anilistId);
    return this.rows.delete(key(userId, anilistId));
  }

  async listEpisodes(
    userId: string,
    anilistId?: number,
  ): Promise<WatchedEpisode[]> {
    return [...this.episodes.values()]
      .filter(
        (e) =>
          e.userId === userId &&
          (anilistId === undefined || e.anilistId === anilistId),
      )
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  async recordEpisode(
    userId: string,
    anilistId: number,
    episodeNumber: number,
  ): Promise<WatchedEpisode> {
    const epKey = `${userId}:${anilistId}:${episodeNumber}`;
    const row: WatchedEpisode = {
      id: `ep-${epKey}`,
      userId,
      anilistId,
      episodeNumber,
      watchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.episodes.set(epKey, row);
    return row;
  }

  async removeEpisode(
    userId: string,
    anilistId: number,
    episodeNumber: number,
  ): Promise<boolean> {
    return this.episodes.delete(`${userId}:${anilistId}:${episodeNumber}`);
  }

  async bulkRecordEpisodes(
    userId: string,
    anilistId: number,
    episodeNumbers: number[],
  ): Promise<void> {
    for (const num of episodeNumbers) {
      await this.recordEpisode(userId, anilistId, num);
    }
  }

  async removeAllEpisodes(userId: string, anilistId: number): Promise<void> {
    for (const [k, e] of this.episodes) {
      if (e.userId === userId && e.anilistId === anilistId) {
        this.episodes.delete(k);
      }
    }
  }
}

class CountingStore extends MemoryStore {
  findCalls = 0;

  override async find(
    userId: string,
    anilistId: number,
  ): Promise<LibraryEntry | null> {
    this.findCalls += 1;
    return super.find(userId, anilistId);
  }
}

class RacingStore extends MemoryStore {
  private findCalls = 0;

  override async find(
    userId: string,
    anilistId: number,
  ): Promise<LibraryEntry | null> {
    this.findCalls += 1;
    if (this.findCalls === 1) {
      return null;
    }
    return super.find(userId, anilistId);
  }

  override async insert(): Promise<LibraryEntry> {
    throw new LibraryConflictError("concurrent insert");
  }
}

describe("LibraryRepository", () => {
  it("creates an entry once and returns it", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    const result = await repository.add("user-1", {
      anilistId: 101,
      status: "planning",
    });

    expect(result.created).toBe(true);
    expect(result.entry).toMatchObject({
      userId: "user-1",
      anilistId: 101,
      status: "planning",
      progress: 0,
      score: null,
    });
    expect(await repository.list("user-1")).toHaveLength(1);
  });

  it("prevents duplicates and preserves existing progress", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 101, status: "watching" });
    await repository.update("user-1", 101, { progress: 4, score: 8 }, 12);

    const duplicate = await repository.add("user-1", {
      anilistId: 101,
      status: "completed",
    });

    expect(duplicate.created).toBe(false);
    expect(duplicate.entry.progress).toBe(4);
    expect(duplicate.entry.score).toBe(8);
    expect(duplicate.entry.status).toBe("watching");
    expect(await repository.list("user-1")).toHaveLength(1);
  });

  it("returns the winner when a concurrent insert hits the unique constraint", async () => {
    const existing: LibraryEntry = {
      id: "row-existing",
      userId: "user-1",
      anilistId: 202,
      status: "planning",
      progress: 0,
      score: null,
      startedAt: null,
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const repository = new LibraryRepository(new RacingStore([existing]));

    const result = await repository.add("user-1", {
      anilistId: 202,
      status: "watching",
    });

    expect(result.created).toBe(false);
    expect(result.entry.id).toBe("row-existing");
  });

  it("applies status transitions and fills completion progress", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 303, status: "watching" });
    await repository.update("user-1", 303, { score: 9, notes: "Solid" }, 12);

    const completed = await repository.update(
      "user-1",
      303,
      { status: "completed" },
      12,
    );

    expect(completed.status).toBe("completed");
    expect(completed.progress).toBe(12);
    expect(completed.score).toBe(9);
    expect(completed.notes).toBe("Solid");
    expect(completed.completedAt).not.toBeNull();
  });

  it("validates progress against known episode counts", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 404, status: "watching" });

    await expect(
      repository.update("user-1", 404, { progress: 13 }, 12),
    ).rejects.toBeInstanceOf(LibraryProgressError);
  });

  it("allows unbounded progress for unknown episode counts", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 505, status: "watching" });

    const updated = await repository.update(
      "user-1",
      505,
      { progress: 999 },
      null,
    );
    expect(updated.progress).toBe(999);
  });

  it("throws when updating or removing a missing entry", async () => {
    const repository = new LibraryRepository(new MemoryStore());

    await expect(
      repository.update("user-1", 606, { progress: 1 }, 12),
    ).rejects.toBeInstanceOf(LibraryEntryNotFoundError);
    await expect(repository.remove("user-1", 606)).rejects.toBeInstanceOf(
      LibraryEntryNotFoundError,
    );
  });

  it("scopes entries per user", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 707, status: "watching" });

    expect(await repository.list("user-2")).toHaveLength(0);
    expect(await repository.find("user-2", 707)).toBeNull();
  });

  it("removes an entry", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 808, status: "planning" });
    await repository.remove("user-1", 808);

    expect(await repository.list("user-1")).toHaveLength(0);
  });

  it("reads the entry once per episode toggle", async () => {
    const store = new CountingStore();
    const repository = new LibraryRepository(store);
    await repository.add("user-1", { anilistId: 906, status: "watching" });
    store.findCalls = 0;

    await repository.toggleEpisode("user-1", 906, 1, true, 12);

    expect(store.findCalls).toBe(1);
  });

  it("tracks individual watched episodes with non-sequential support", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 901, status: "watching" });

    // Mark episode 1, 2, and 4 (skipping 3)
    await repository.toggleEpisode("user-1", 901, 1, true, 12);
    await repository.toggleEpisode("user-1", 901, 2, true, 12);
    const step3 = await repository.toggleEpisode("user-1", 901, 4, true, 12);

    expect(step3.watchedEpisodes).toEqual([1, 2, 4]);
    // Progress reflects the highest episode watched
    expect(step3.entry.progress).toBe(4);
    expect(step3.entry.status).toBe("watching");

    // Unmark episode 4
    const unmarkResult = await repository.toggleEpisode(
      "user-1",
      901,
      4,
      false,
      12,
    );
    expect(unmarkResult.watchedEpisodes).toEqual([1, 2]);
    expect(unmarkResult.entry.progress).toBe(2);
  });

  it("transitions status to completed when all episodes are watched", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 902, status: "watching" });

    await repository.toggleEpisode("user-1", 902, 1, true, 2);
    const completedResult = await repository.toggleEpisode(
      "user-1",
      902,
      2,
      true,
      2,
    );

    expect(completedResult.entry.status).toBe("completed");
    expect(completedResult.entry.completedAt).not.toBeNull();
    expect(completedResult.watchedEpisodes).toEqual([1, 2]);

    // Unmarking episode 2 reverts status to watching
    const revertedResult = await repository.toggleEpisode(
      "user-1",
      902,
      2,
      false,
      2,
    );
    expect(revertedResult.entry.status).toBe("watching");
    expect(revertedResult.entry.completedAt).toBeNull();
  });

  it("never completes an entry when the episode total is unknown", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 905, status: "watching" });

    await repository.toggleEpisode("user-1", 905, 1, true, null);
    const result = await repository.toggleEpisode("user-1", 905, 2, true, null);

    // A missing catalogue total must not imply a false completion.
    expect(result.entry.status).toBe("watching");
    expect(result.entry.completedAt).toBeNull();
    expect(result.entry.progress).toBe(2);
    expect(result.watchedEpisodes).toEqual([1, 2]);
  });

  it("marks all episodes and clears all episodes", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.add("user-1", { anilistId: 903, status: "watching" });

    const all = await repository.markAllEpisodes("user-1", 903, 3);
    expect(all.watchedEpisodes).toEqual([1, 2, 3]);
    expect(all.entry.progress).toBe(3);
    expect(all.entry.status).toBe("completed");

    const cleared = await repository.clearAllEpisodes("user-1", 903, 3);
    expect(cleared.watchedEpisodes).toEqual([]);
    expect(cleared.entry.progress).toBe(0);
    expect(cleared.entry.status).toBe("watching");
  });

  it("isolates episode records between users", async () => {
    const repository = new LibraryRepository(new MemoryStore());
    await repository.toggleEpisode("user-1", 904, 1, true, 12);

    expect(await repository.getWatchedEpisodes("user-2", 904)).toHaveLength(0);
    expect(await repository.getWatchedEpisodes("user-1", 904)).toEqual([1]);
  });
});
