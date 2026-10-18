import { describe, expect, it } from "vitest";

import { LibraryProgressError, type LibraryEntryPatch } from "@/lib/library-rules";
import {
  LibraryConflictError,
  LibraryEntryNotFoundError,
  LibraryRepository,
  type LibraryStore,
  type NewLibraryEntry,
} from "@/repositories/library";
import type { LibraryEntry } from "@/types/library";

function key(userId: string, anilistId: number) {
  return `${userId}:${anilistId}`;
}

class MemoryStore implements LibraryStore {
  protected rows = new Map<string, LibraryEntry>();
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
    return this.rows.delete(key(userId, anilistId));
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
});
