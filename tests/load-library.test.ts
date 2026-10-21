import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { LibraryEntry, WatchedEpisode } from "@/types/library";

const mockList = vi.fn<() => Promise<LibraryEntry[]>>();
const mockListEpisodes = vi.fn<() => Promise<WatchedEpisode[]>>();
const mockGetAnimeByIds = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/repositories/library", () => ({
  createLibraryRepository: vi.fn().mockReturnValue({
    list: () => mockList(),
    listEpisodes: () => mockListEpisodes(),
  }),
}));

vi.mock("@/services/catalog/catalog-service", () => ({
  getCatalogService: vi.fn().mockReturnValue({
    getAnimeByIds: (ids: number[]) => mockGetAnimeByIds(ids),
  }),
}));

import { loadLibraryItems } from "@/features/library/load-library";

describe("loadLibraryItems error resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches watchedEpisodes when listEpisodes succeeds", async () => {
    const entry: LibraryEntry = {
      id: "e1",
      userId: "u1",
      anilistId: 100,
      status: "watching",
      progress: 3,
      score: null,
      startedAt: null,
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockList.mockResolvedValue([entry]);
    mockListEpisodes.mockResolvedValue([
      {
        id: "w1",
        userId: "u1",
        anilistId: 100,
        episodeNumber: 1,
        watchedAt: "2026-01-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "w2",
        userId: "u1",
        anilistId: 100,
        episodeNumber: 3,
        watchedAt: "2026-01-01T00:00:00Z",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]);
    mockGetAnimeByIds.mockResolvedValue(new Map());

    const items = await loadLibraryItems("u1");
    expect(items).toHaveLength(1);
    expect(items[0]!.watchedEpisodes).toEqual([1, 3]);
  });

  it("keeps entries visible and editable when catalogue metadata is unavailable", async () => {
    const entry: LibraryEntry = {
      id: "e2",
      userId: "u1",
      anilistId: 300,
      status: "completed",
      progress: 24,
      score: 8,
      startedAt: "2025-12-01",
      completedAt: "2026-02-01",
      notes: "Great finale",
      createdAt: "2025-12-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
    };
    mockList.mockResolvedValue([entry]);
    mockListEpisodes.mockResolvedValue([]);
    // Catalogue outage: no summaries resolve at all.
    mockGetAnimeByIds.mockResolvedValue(new Map());

    const items = await loadLibraryItems("u1");

    expect(items).toHaveLength(1);
    expect(items[0]!.anime).toBeNull();
    expect(items[0]!.entry).toEqual(entry);
    expect(items[0]!.entry.score).toBe(8);
    expect(items[0]!.entry.notes).toBe("Great finale");
    expect(items[0]!.entry.completedAt).toBe("2026-02-01");
    expect(items[0]!.watchedEpisodes).toEqual([]);
  });

  it("preserves entries when metadata hydration throws", async () => {
    const entry: LibraryEntry = {
      id: "e3",
      userId: "u1",
      anilistId: 400,
      status: "watching",
      progress: 5,
      score: null,
      startedAt: null,
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockList.mockResolvedValue([entry]);
    mockListEpisodes.mockResolvedValue([]);
    mockGetAnimeByIds.mockRejectedValue(new Error("catalogue unavailable"));

    const items = await loadLibraryItems("u1");

    expect(items).toHaveLength(1);
    expect(items[0]!.anime).toBeNull();
    expect(items[0]!.entry.progress).toBe(5);
  });

  it("preserves entry progress without falsifying empty watched history if listEpisodes fails", async () => {
    const entry: LibraryEntry = {
      id: "e1",
      userId: "u1",
      anilistId: 200,
      status: "watching",
      progress: 8,
      score: 9,
      startedAt: null,
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    mockList.mockResolvedValue([entry]);
    // Simulate database query failure when loading episode history
    mockListEpisodes.mockRejectedValue(new Error("Supabase connection timeout"));
    mockGetAnimeByIds.mockResolvedValue(new Map());

    const items = await loadLibraryItems("u1");
    expect(items).toHaveLength(1);
    // Entry progress remains intact
    expect(items[0]!.entry.progress).toBe(8);
    // watchedEpisodes must NOT be falsely set to [] (which would overwrite/misrepresent user progress)
    expect(items[0]!.watchedEpisodes).toBeUndefined();
  });
});
