import type { TmdbLibraryItem } from "@/types/tmdb";

export type ScreenInsightKind = "movie" | "tv";

export interface ScreenActivity {
  /** Distinct days with a recorded episode or a completed film. */
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  busiestMonth: { label: string; count: number } | null;
  /** Sunday-first activity counts. */
  weekdayCounts: number[];
  /** Episodes recorded in the last four weeks. */
  recentEpisodes: number;
  /** Episodes per week over the last four weeks, null when there is no pace. */
  weeklyPace: number | null;
}

export interface ScreenBacklog {
  films: number;
  episodes: number;
  hours: number;
  /** Weeks needed to clear the backlog at the current pace. */
  weeksToClear: number | null;
  /** Month label for the projected finish date. */
  clearBy: string | null;
}

export interface ScreenInsights {
  kind: ScreenInsightKind;
  count: number;
  ratedCount: number;
  meanScore: number | null;
  /** Rating histogram, highest score first. */
  scoreBuckets: Array<{ label: string; count: number }>;
  /** Release decades present in the archive, newest first. */
  decades: Array<{ label: string; count: number }>;
  topRated: Array<{
    key: string;
    tmdbId: number;
    title: string;
    score: number;
    poster: string | null;
  }>;
  recent: Array<{ key: string; title: string; updatedAt: string }>;
  /** TV only: recorded episodes against the known episode totals. */
  episodesWatched: number;
  episodesAvailable: number;
  episodeCompletion: number | null;
  /** TV only: the series with the most recorded episodes. */
  seriesProgress: Array<{
    key: string;
    title: string;
    watched: number;
    total: number | null;
  }>;
  /** Films only. */
  watchedFilms: number;
  watchRate: number;
  queuedFilms: number;
  activity: ScreenActivity;
  backlog: ScreenBacklog;
}

const SCORE_BUCKETS = [
  { label: "10", min: 10, max: 10 },
  { label: "9", min: 9, max: 9 },
  { label: "8", min: 8, max: 8 },
  { label: "7", min: 7, max: 7 },
  { label: "≤6", min: 0, max: 6 },
] as const;

const FILM_RUNTIME_HOURS = 2;
const TV_EPISODE_RUNTIME_MINUTES = 45;
const DAY_MS = 86_400_000;
const PACE_WINDOW_DAYS = 28;

function releaseYear(entry: TmdbLibraryItem["entry"]): number | null {
  if (!entry.releaseDate) return null;
  const year = Number(entry.releaseDate.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildActivity(
  timestamps: number[],
  recentEpisodeTimestamps: number[],
  now: Date,
): ScreenActivity {
  const days = new Map<string, number>();
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const months = new Map<string, number>();

  for (const stamp of timestamps) {
    if (!Number.isFinite(stamp)) continue;
    const date = new Date(stamp);
    const key = dayKey(date);
    days.set(key, (days.get(key) ?? 0) + 1);
    weekdays[date.getDay()] = (weekdays[date.getDay()] ?? 0) + 1;
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(month, (months.get(month) ?? 0) + 1);
  }

  const sortedDays = [...days.keys()].sort();
  let longestStreak = sortedDays.length > 0 ? 1 : 0;
  let run = 1;
  for (let index = 1; index < sortedDays.length; index += 1) {
    const previous = new Date(`${sortedDays[index - 1]}T12:00:00`).getTime();
    const current = new Date(`${sortedDays[index]}T12:00:00`).getTime();
    if (current - previous === DAY_MS) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 1;
    }
  }

  let currentStreak = 0;
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - DAY_MS);
  if (days.has(dayKey(today)) || days.has(dayKey(yesterday))) {
    let cursor = days.has(dayKey(today)) ? today : yesterday;
    while (days.has(dayKey(cursor))) {
      currentStreak += 1;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
  }

  let busiestMonth: ScreenActivity["busiestMonth"] = null;
  for (const [month, count] of months) {
    if (!busiestMonth || count > busiestMonth.count) {
      busiestMonth = {
        label: monthLabel(new Date(`${month}-01T12:00:00`)),
        count,
      };
    }
  }

  const paceStart = now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
  const recentCount = recentEpisodeTimestamps.filter(
    (stamp) => stamp >= paceStart && stamp <= now.getTime(),
  ).length;
  const weeklyPace =
    recentCount > 0
      ? Math.round((recentCount / (PACE_WINDOW_DAYS / 7)) * 10) / 10
      : null;

  return {
    activeDays: days.size,
    currentStreak,
    longestStreak,
    busiestMonth,
    weekdayCounts: weekdays,
    recentEpisodes: recentCount,
    weeklyPace,
  };
}

/**
 * Film and TV analytics for the stats page: rating shape, release history,
 * episode coverage, viewing rhythm from real watch timestamps, and the remaining
 * runway. Only the runtime estimate is an assumption.
 */
export function calculateScreenInsights(
  items: TmdbLibraryItem[],
  kind: ScreenInsightKind,
  now: Date = new Date(),
): ScreenInsights {
  const scoped = items.filter((item) => item.entry.mediaType === kind);

  const scoreBuckets = SCORE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: scoped.filter(
      (item) =>
        item.entry.score !== null &&
        item.entry.score >= bucket.min &&
        item.entry.score <= bucket.max,
    ).length,
  }));

  const decadeMap = new Map<number, number>();
  for (const item of scoped) {
    const year = releaseYear(item.entry);
    if (year === null) continue;
    const decade = Math.floor(year / 10) * 10;
    decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
  }
  const decades = [...decadeMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decade, count]) => ({ label: `${decade}s`, count }));

  const topRated = scoped
    .filter((item) => item.entry.score !== null && item.entry.score >= 8)
    .sort((a, b) => (b.entry.score ?? 0) - (a.entry.score ?? 0))
    .slice(0, 4)
    .map((item) => ({
      key: item.entry.id,
      tmdbId: item.entry.tmdbId,
      title: item.entry.title,
      score: item.entry.score ?? 0,
      poster: item.entry.posterPath,
    }));

  const recent = [...scoped]
    .sort(
      (a, b) =>
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime(),
    )
    .slice(0, 3)
    .map((item) => ({
      key: item.entry.id,
      title: item.entry.title,
      updatedAt: item.entry.updatedAt,
    }));

  const scored = scoped.filter((item) => item.entry.score !== null);
  const meanScore =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, item) => sum + (item.entry.score ?? 0), 0) /
            scored.length) *
            10,
        ) / 10
      : null;

  const episodesWatched = scoped.reduce(
    (sum, item) => sum + item.watchedCount,
    0,
  );
  const episodesAvailable = scoped.reduce(
    (sum, item) => sum + (item.entry.totalEpisodes ?? 0),
    0,
  );

  const seriesProgress = scoped
    .filter((item) => item.watchedCount > 0 || item.entry.status === "watching")
    .sort((a, b) => b.watchedCount - a.watchedCount)
    .slice(0, 5)
    .map((item) => ({
      key: item.entry.id,
      title: item.entry.title,
      watched: item.watchedCount,
      total: item.entry.totalEpisodes,
    }));

  // Film-only metrics must not pick up completed series when the scope is TV.
  const watchedFilms =
    kind === "movie"
      ? scoped.filter(
          (item) => item.entry.watched || item.entry.status === "completed",
        ).length
      : 0;

  // Activity comes from recorded episode timestamps, plus the completion or
  // last-touch date of a watched film.
  const activityTimestamps: number[] = [];
  const episodeTimestamps: number[] = [];
  for (const item of scoped) {
    for (const episode of item.watchedEpisodes) {
      const stamp = new Date(episode.watchedAt).getTime();
      if (!Number.isFinite(stamp)) continue;
      activityTimestamps.push(stamp);
      episodeTimestamps.push(stamp);
    }
    if (kind === "movie" && (item.entry.watched || item.entry.status === "completed")) {
      const stamp = new Date(
        item.entry.completedAt ?? item.entry.updatedAt,
      ).getTime();
      if (Number.isFinite(stamp)) activityTimestamps.push(stamp);
    }
  }

  const activity = buildActivity(activityTimestamps, episodeTimestamps, now);

  const backlogFilms =
    kind === "movie"
      ? scoped.filter(
          (item) =>
            !item.entry.watched &&
            (item.entry.status === "planning" ||
              item.entry.status === "on_hold" ||
              item.entry.status === "watching"),
        ).length
      : 0;
  const backlogEpisodes =
    kind === "tv"
      ? scoped.reduce((sum, item) => {
          if (item.entry.status === "completed" || item.entry.status === "dropped") {
            return sum;
          }
          if (item.entry.totalEpisodes === null) return sum;
          return sum + Math.max(0, item.entry.totalEpisodes - item.watchedCount);
        }, 0)
      : 0;

  const backlogHours = Math.round(
    backlogFilms * FILM_RUNTIME_HOURS +
      (backlogEpisodes * TV_EPISODE_RUNTIME_MINUTES) / 60,
  );
  const hoursPerWeek =
    activity.weeklyPace !== null
      ? activity.weeklyPace * (TV_EPISODE_RUNTIME_MINUTES / 60)
      : 0;
  const weeksToClear =
    backlogHours > 0 && hoursPerWeek > 0
      ? Math.ceil(backlogHours / hoursPerWeek)
      : null;
  const clearBy =
    weeksToClear !== null
      ? monthLabel(new Date(now.getTime() + weeksToClear * 7 * DAY_MS))
      : null;

  return {
    kind,
    count: scoped.length,
    ratedCount: scored.length,
    meanScore,
    scoreBuckets,
    decades,
    topRated,
    recent,
    episodesWatched,
    episodesAvailable,
    episodeCompletion:
      episodesAvailable > 0
        ? Math.min(100, Math.round((episodesWatched / episodesAvailable) * 100))
        : null,
    seriesProgress,
    watchedFilms,
    watchRate:
      scoped.length > 0
        ? Math.round((watchedFilms / scoped.length) * 100)
        : 0,
    queuedFilms:
      kind === "movie"
        ? scoped.filter((item) => item.entry.status === "planning").length
        : 0,
    activity,
    backlog: {
      films: backlogFilms,
      episodes: backlogEpisodes,
      hours: backlogHours,
      weeksToClear,
      clearBy,
    },
  };
}
