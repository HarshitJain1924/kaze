import { describe, expect, it } from "vitest";

import { tmdbEntryPatchSchema } from "@/lib/validation/tmdb";
import {
  TmdbLibraryRepository,
  type NewTmdbEntry,
  type TmdbEntryRowPatch,
  type TmdbLibraryStore,
} from "@/repositories/tmdb-library";
import type { EpisodeRef } from "@/lib/validation/tmdb";
import type {
  TmdbDetails,
  TmdbKind,
  TmdbLibraryEntry,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

class MemoryStore implements TmdbLibraryStore {
  entries: TmdbLibraryEntry[] = [];
  episodes: TmdbWatchedEpisode[] = [];
  private sequence = 0;

  async list(userId: string): Promise<TmdbLibraryEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId);
  }

  async find(
    userId: string,
    kind: TmdbKind,
    tmdbId: number,
  ): Promise<TmdbLibraryEntry | null> {
    return (
      this.entries.find(
        (entry) =>
          entry.userId === userId &&
          entry.mediaType === kind &&
          entry.tmdbId === tmdbId,
      ) ?? null
    );
  }

  async insert(input: NewTmdbEntry): Promise<TmdbLibraryEntry> {
    const now = new Date().toISOString();
    const entry: TmdbLibraryEntry = {
      id: `entry-${++this.sequence}`,
      userId: input.userId,
      tmdbId: input.tmdbId,
      mediaType: input.mediaType,
      title: input.title,
      originalTitle: input.originalTitle,
      overview: input.overview,
      posterPath: input.posterPath,
      backdropPath: input.backdropPath,
      releaseDate: input.releaseDate,
      status: input.status,
      score: null,
      notes: null,
      watched: input.watched,
      totalEpisodes: input.totalEpisodes,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      createdAt: now,
      updatedAt: now,
    };
    this.entries.push(entry);
    return entry;
  }

  async update(
    userId: string,
    entryId: string,
    patch: TmdbEntryRowPatch,
  ): Promise<TmdbLibraryEntry | null> {
    const entry = this.entries.find(
      (candidate) => candidate.id === entryId && candidate.userId === userId,
    );
    if (!entry) return null;

    if (patch.status !== undefined) entry.status = patch.status;
    if (patch.score !== undefined) entry.score = patch.score;
    if (patch.notes !== undefined) entry.notes = patch.notes;
    if (patch.watched !== undefined) entry.watched = patch.watched;
    if (patch.started_at !== undefined) entry.startedAt = patch.started_at;
    if (patch.completed_at !== undefined) {
      entry.completedAt = patch.completed_at;
    }
    if (patch.total_episodes !== undefined) {
      entry.totalEpisodes = patch.total_episodes;
    }
    entry.updatedAt = new Date().toISOString();
    return entry;
  }

  async remove(userId: string, entryId: string): Promise<boolean> {
    const index = this.entries.findIndex(
      (entry) => entry.id === entryId && entry.userId === userId,
    );
    if (index < 0) return false;
    this.entries.splice(index, 1);
    this.episodes = this.episodes.filter((episode) => episode.entryId !== entryId);
    return true;
  }

  async listEpisodes(
    userId: string,
    entryId?: string,
  ): Promise<TmdbWatchedEpisode[]> {
    return this.episodes.filter(
      (episode) =>
        episode.userId === userId &&
        (entryId === undefined || episode.entryId === entryId),
    );
  }

  async upsertEpisodes(
    entryId: string,
    userId: string,
    episodes: EpisodeRef[],
  ): Promise<void> {
    for (const episode of episodes) {
      const exists = this.episodes.some(
        (candidate) =>
          candidate.entryId === entryId &&
          candidate.seasonNumber === episode.seasonNumber &&
          candidate.episodeNumber === episode.episodeNumber,
      );
      if (!exists) {
        this.episodes.push({
          id: `episode-${this.episodes.length + 1}`,
          entryId,
          userId,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          watchedAt: new Date().toISOString(),
        });
      }
    }
  }

  async deleteEpisodes(
    entryId: string,
    userId: string,
    episodes: EpisodeRef[],
  ): Promise<void> {
    this.episodes = this.episodes.filter(
      (candidate) =>
        !(
          candidate.entryId === entryId &&
          candidate.userId === userId &&
          episodes.some(
            (episode) =>
              episode.seasonNumber === candidate.seasonNumber &&
              episode.episodeNumber === candidate.episodeNumber,
          )
        ),
    );
  }

  async deleteAllEpisodes(entryId: string, userId: string): Promise<void> {
    this.episodes = this.episodes.filter(
      (episode) =>
        !(episode.entryId === entryId && episode.userId === userId),
    );
  }
}

function details(kind: TmdbKind, tmdbId: number): TmdbDetails {
  return {
    tmdbId,
    kind,
    title: kind === "movie" ? "Arrival" : "Severance",
    originalTitle: null,
    overview: null,
    tagline: null,
    posterUrl: null,
    backdropUrl: null,
    releaseDate: kind === "movie" ? "2016-11-11" : "2022-02-18",
    year: kind === "movie" ? 2016 : 2022,
    genres: [],
    runtime: kind === "movie" ? 116 : null,
    episodeRuntime: [],
    numberOfSeasons: kind === "tv" ? 2 : null,
    numberOfEpisodes: kind === "tv" ? 3 : null,
    status: null,
    voteAverage: null,
    voteCount: null,
    seasons: [],
  };
}

describe("TMDB library repository", () => {
  it("prevents duplicate adds and returns the existing entry", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);

    const first = await repository.add("user-1", details("movie", 329865), "planning");
    const second = await repository.add("user-1", details("movie", 329865), "watching");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(store.entries).toHaveLength(1);
  });

  it("keeps movie watched state and completion date in sync", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);
    await repository.add("user-1", details("movie", 329865), "planning");

    const watched = await repository.update("user-1", "movie", 329865, {
      watched: true,
    });
    expect(watched.watched).toBe(true);
    expect(watched.status).toBe("completed");
    expect(watched.completedAt).not.toBeNull();

    const unwatched = await repository.update("user-1", "movie", 329865, {
      watched: false,
    });
    expect(unwatched.watched).toBe(false);
    expect(unwatched.status).toBe("watching");
    expect(unwatched.completedAt).toBeNull();
  });

  it("derives TV progress from the watched-episode set", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);
    await repository.add("user-1", details("tv", 95396), "planning");

    const first = await repository.setEpisodes(
      "user-1",
      "tv",
      95396,
      [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ],
      true,
    );
    expect(first.watchedEpisodes).toHaveLength(2);
    expect(first.entry.status).toBe("watching");

    const completed = await repository.setEpisodes(
      "user-1",
      "tv",
      95396,
      [{ seasonNumber: 2, episodeNumber: 1 }],
      true,
    );
    expect(completed.watchedEpisodes).toHaveLength(3);
    expect(completed.entry.status).toBe("completed");

    const unwatched = await repository.setEpisodes(
      "user-1",
      "tv",
      95396,
      [{ seasonNumber: 1, episodeNumber: 2 }],
      false,
    );
    expect(unwatched.watchedEpisodes).toHaveLength(2);
    expect(unwatched.entry.status).toBe("watching");
  });

  it("clears TV history and leaves other fields intact", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);
    await repository.add("user-1", details("tv", 95396), "watching");
    await repository.update("user-1", "tv", 95396, {
      score: 9,
      notes: "Slow start, brilliant finish.",
    });
    await repository.setEpisodes(
      "user-1",
      "tv",
      95396,
      [{ seasonNumber: 1, episodeNumber: 1 }],
      true,
    );

    const cleared = await repository.clearEpisodes("user-1", "tv", 95396);
    expect(cleared.watchedEpisodes).toHaveLength(0);
    expect(cleared.entry.score).toBe(9);
    expect(cleared.entry.notes).toBe("Slow start, brilliant finish.");
    expect(cleared.entry.status).toBe("watching");
  });

  it("does not let a score-only patch erase notes or progress", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);
    await repository.add("user-1", details("tv", 95396), "watching");
    await repository.update("user-1", "tv", 95396, { notes: "Keep me" });

    const parsed = tmdbEntryPatchSchema.parse({ score: 8 });
    await repository.update("user-1", "tv", 95396, parsed);

    const entry = await repository.find("user-1", "tv", 95396);
    expect(entry?.score).toBe(8);
    expect(entry?.notes).toBe("Keep me");
  });

  it("normalizes blank notes to null but leaves omitted notes untouched", async () => {
    const store = new MemoryStore();
    const repository = new TmdbLibraryRepository(store);
    await repository.add("user-1", details("tv", 95396), "watching");

    const blank = await repository.update("user-1", "tv", 95396, {
      notes: "   ",
    });
    expect(blank.notes).toBeNull();

    const scoreOnly = tmdbEntryPatchSchema.parse({ score: 7 });
    expect(scoreOnly.notes).toBeUndefined();
  });
});
