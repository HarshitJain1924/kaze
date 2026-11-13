import { describe, expect, it } from "vitest";

import {
  buildActivityEvents,
  formatActivityDay,
  groupActivityByMonth,
  monthSummary,
} from "@/lib/activity";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryEntry, TmdbWatchedEpisode } from "@/types/tmdb";

const animeLibrary: LibraryItem[] = [
  {
    entry: {
      id: "entry-1",
      userId: "user",
      anilistId: 1,
      mediaType: "anime",
      status: "completed",
      progress: 12,
      score: 9,
      startedAt: "2026-10-02",
      completedAt: "2026-10-20T18:00:00.000Z",
      notes: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-20T18:00:00.000Z",
    },
    anime: {
      id: 1,
      title: { romaji: "Cowboy Bebop", english: "Cowboy Bebop", native: null },
      coverImage: { extraLarge: null, large: null, color: null },
      format: "TV",
      episodes: 12,
      averageScore: 86,
      genres: [],
      seasonYear: 1998,
      status: "FINISHED",
    },
  },
];

const screenEntry: TmdbLibraryEntry = {
  id: "screen-entry-1",
  userId: "user",
  tmdbId: 603,
  mediaType: "movie",
  title: "The Matrix",
  originalTitle: null,
  overview: null,
  posterPath: null,
  backdropPath: null,
  releaseDate: "1999-03-31",
  status: "completed",
  score: 9,
  notes: null,
  watched: true,
  totalEpisodes: null,
  startedAt: "2026-09-01",
  completedAt: "2026-09-02T20:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T20:00:00.000Z",
};

const screenEpisode: TmdbWatchedEpisode = {
  id: "screen-episode-1",
  entryId: "series-entry-1",
  userId: "user",
  seasonNumber: 1,
  episodeNumber: 4,
  watchedAt: "2026-10-05T21:00:00.000Z",
};

const seriesEntry: TmdbLibraryEntry = {
  ...screenEntry,
  id: "series-entry-1",
  tmdbId: 1396,
  mediaType: "tv",
  title: "Breaking Bad",
  releaseDate: "2008-01-20",
  totalEpisodes: 62,
  completedAt: null,
};

describe("activity log", () => {
  const events = buildActivityEvents({
    libraryItems: animeLibrary,
    animeEpisodes: [
      {
        id: "ep-1",
        userId: "user",
        anilistId: 1,
        episodeNumber: 5,
        watchedAt: "2026-10-20T17:00:00.000Z",
        createdAt: "2026-10-20T17:00:00.000Z",
      },
    ],
    screenEntries: [screenEntry, seriesEntry],
    screenEpisodes: [screenEpisode],
  });

  it("turns episodes and completions into one reverse-chronological feed", () => {
    expect(events.map((event) => event.detail)).toEqual([
      "Marked as completed",
      "Episode 5",
      "Season 1 · Episode 4",
      "Film logged",
    ]);
    const times = events.map((event) => event.at);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("keeps undo data for episodes and no undo for completions", () => {
    const episode = events.find((event) => event.kind === "anime_episode");
    const completion = events.find((event) => event.kind === "completed");
    expect(episode?.undo).toMatchObject({ type: "anime_episode", episodeNumber: 5 });
    expect(episode?.href).toBe("/media/1");
    expect(completion?.undo).toBeNull();
  });

  it("links screen events to the TMDB detail page", () => {
    const seriesEpisode = events.find((event) => event.kind === "screen_episode");
    expect(seriesEpisode?.href).toBe("/screen/tv/1396");
    expect(seriesEpisode?.detail).toBe("Season 1 · Episode 4");
    expect(seriesEpisode?.undo).toMatchObject({
      type: "screen_episode",
      kind: "tv",
      tmdbId: 1396,
    });
  });

  it("groups by month and tallies episodes against completions", () => {
    const months = groupActivityByMonth(events);
    expect(months.map((month) => month.key)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]?.label).toBe("October 2026");
    expect(months[0]?.episodeCount).toBe(2);
    expect(months[0]?.completionCount).toBe(1);
    expect(monthSummary(months[0]!)).toBe("2 episodes · 1 completion");
  });

  it("formats UTC days so the grouping never shifts across timezones", () => {
    expect(formatActivityDay("2026-10-05T23:30:00.000Z")).toContain("5");
    expect(formatActivityDay("not-a-date")).toBe("not-a-date");
  });
});
