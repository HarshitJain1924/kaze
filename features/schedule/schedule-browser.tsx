"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FilmIcon,
  FlameIcon,
  LoaderIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
} from "@/components/icons";
import {
  useActiveTimeZone,
  usePreferences,
} from "@/components/providers/preferences-provider";
import { TimezoneSelector } from "@/components/timezone-selector";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/features/library/library-provider";
import { useNow } from "@/lib/use-now";
import {
  formatAiringRelative,
  formatAiringTime,
  getTimeZoneAbbr,
  groupScheduleByDay,
  toIsoDateString,
  type WeekRange,
} from "@/lib/schedule";
import {
  cn,
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type {
  AiringScheduleEntry,
  AnimeSummary,
  WeeklyScheduleDay,
} from "@/types/anime";

function formatDayHeading(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function PosterFallback({ color }: { color: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: color
          ? `radial-gradient(120% 90% at 20% 0%, ${color}44 0%, var(--surface-3) 70%)`
          : "radial-gradient(120% 90% at 20% 0%, var(--surface-3) 0%, var(--surface-2) 70%)",
      }}
    >
      <FilmIcon className="h-6 w-6 text-faint/60" />
    </div>
  );
}

interface ScheduleBrowserProps {
  week: WeekRange;
  days: WeeklyScheduleDay[];
  entries?: AiringScheduleEntry[];
  watchingIds: number[];
  /** A `?date=` deep link selects that day, not just its week. */
  initialDate?: string;
  /** Server render time; keeps first client render identical. */
  initialNow: number;
}

export function ScheduleBrowser({
  week,
  days,
  entries,
  watchingIds,
  initialDate,
  initialNow,
}: ScheduleBrowserProps) {
  const nowMs = useNow(initialNow);
  const router = useRouter();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const {
    canWrite,
    entryFor,
    watchedEpisodesFor,
    toggleEpisode,
    pendingIds,
    requestAdd,
  } = useLibrary();

  const watchingSet = useMemo(() => new Set(watchingIds), [watchingIds]);

  // Flatten entries if provided or pull from initial days
  const allEntries = useMemo(() => {
    if (entries && entries.length > 0) return entries;
    return days.flatMap((d) => d.entries);
  }, [entries, days]);

  // Group entries dynamically according to active timezone
  const localDays = useMemo(() => {
    return groupScheduleByDay(allEntries, week.days, activeTimeZone);
  }, [allEntries, week.days, activeTimeZone]);

  // Default active day is today in the selected timezone if within this week
  const todayIso = useMemo(
    () => toIsoDateString(new Date(nowMs), activeTimeZone),
    [nowMs, activeTimeZone],
  );
  const initialDayDate = useMemo(() => {
    if (initialDate && week.days.some((day) => day.date === initialDate)) {
      return initialDate;
    }
    const todayMatch = localDays.find((d) => d.date === todayIso);
    return todayMatch ? todayMatch.date : (localDays[0]?.date ?? todayIso);
  }, [initialDate, todayIso, localDays, week.days]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDayDate);
  const [filterMode, setFilterMode] = useState<"all" | "watching">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const activeDay = useMemo(() => {
    return (
      localDays.find((d) => d.date === selectedDate) ?? localDays[0] ?? null
    );
  }, [localDays, selectedDate]);

  // Filter entries for the active day
  const filteredEntries = useMemo(() => {
    if (!activeDay) return [];
    let list = activeDay.entries;
    if (filterMode === "watching") {
      list = list.filter((entry) => watchingSet.has(entry.mediaId));
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((entry) => {
        const titleEng = entry.media.title.english?.toLowerCase() ?? "";
        const titleRom = entry.media.title.romaji?.toLowerCase() ?? "";
        const titleNat = entry.media.title.native?.toLowerCase() ?? "";
        return (
          titleEng.includes(query) ||
          titleRom.includes(query) ||
          titleNat.includes(query)
        );
      });
    }
    return list;
  }, [activeDay, filterMode, searchQuery, watchingSet]);

  // Total watching releases this entire week
  const totalWatchingInWeek = useMemo(() => {
    let count = 0;
    for (const d of localDays) {
      for (const entry of d.entries) {
        if (watchingSet.has(entry.mediaId)) {
          count += 1;
        }
      }
    }
    return count;
  }, [localDays, watchingSet]);

  // High-res backdrop from the most popular anime airing this week
  const heroBackdrop = useMemo(() => {
    // 1. Try to find one from user's watchlist that has a banner or large cover
    const activeWatching = allEntries.find(
      (e) =>
        watchingSet.has(e.mediaId) &&
        (e.media.bannerImage || e.media.coverImage.extraLarge),
    );
    if (activeWatching) {
      return (
        activeWatching.media.bannerImage ??
        activeWatching.media.coverImage.extraLarge ??
        null
      );
    }
    // 2. Highest score / popular anime with banner
    const withBanner = [...allEntries]
      .filter((e) => e.media.bannerImage)
      .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))[0];
    if (withBanner?.media.bannerImage) {
      return withBanner.media.bannerImage;
    }
    // 3. Fallback to any cover
    return allEntries[0]?.media.coverImage.extraLarge ?? null;
  }, [allEntries, watchingSet]);

  // Nearest future upcoming release
  const nextUpcomingEntry = useMemo(() => {
    const nowSec = Math.floor(nowMs / 1000);
    const future = allEntries
      .filter((e) => e.airingAt > nowSec)
      .sort((a, b) => a.airingAt - b.airingAt);
    return future[0] ?? null;
  }, [allEntries, nowMs]);

  const handlePrevWeek = () => {
    router.push(`/schedule?date=${week.prevWeekDate}`);
  };

  const handleNextWeek = () => {
    router.push(`/schedule?date=${week.nextWeekDate}`);
  };

  const handleToday = () => {
    setSelectedDate(todayIso);
    router.push(`/schedule?date=${todayIso}`);
  };

  return (
    <div className="space-y-6">
      {/* Cinematic Ambient Broadcast Center Hero Banner */}
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/85 p-6 sm:p-7 md:p-8 backdrop-blur-xl shadow-2xl">
        {/* Ambient high-res backdrop with dark multi-stop vignette */}
        {heroBackdrop && isHttpUrl(heroBackdrop) ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Image
              src={heroBackdrop}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover object-center opacity-20 blur-md scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
          </div>
        ) : (
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        )}

        <div className="relative z-10 space-y-5">
          {/* Top Row: Beacon Badge, Week Range & Week Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent-strong backdrop-blur-md shadow-xs">
              <span className="h-2 w-2 rounded-full bg-accent radar-live-dot" />
              <span>Broadcast Radar</span>
              <span className="text-white/30">/</span>
              <span className="text-muted">{week.weekLabel}</span>
            </div>

            {/* Week navigation buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrevWeek}
                aria-label="Previous week"
                className="h-8 rounded-xl border-white/10 bg-surface-2/80 px-2.5 text-xs text-muted hover:border-white/20 hover:text-fg"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Prev week</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-8 rounded-xl border border-accent/40 bg-accent/15 px-3 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/25"
              >
                Today
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleNextWeek}
                aria-label="Next week"
                className="h-8 rounded-xl border-white/10 bg-surface-2/80 px-2.5 text-xs text-muted hover:border-white/20 hover:text-fg"
              >
                <span className="hidden sm:inline">Next week</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Heading & Subtitle with Timezone Pill */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
                Weekly Broadcast Schedule
              </h1>
              <p className="mt-1.5 text-[13px] sm:text-sm text-muted">
                Tracking{" "}
                <span className="font-semibold text-fg tabular-nums">
                  {allEntries.length} releases
                </span>{" "}
                across global simulcasts this week ·{" "}
                <span className="font-semibold text-accent-strong tabular-nums">
                  {totalWatchingInWeek} episodes
                </span>{" "}
                in your watchlist.
              </p>
            </div>

            {/* Timezone pill container */}
            <div className="inline-flex max-w-full shrink-0 items-center gap-2 self-start rounded-2xl border border-white/[0.08] bg-surface-2/70 px-3.5 py-1.5 text-xs text-muted backdrop-blur-md md:self-auto">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 text-accent-strong" />
              <span className="whitespace-nowrap text-faint">Local Timezone:</span>
              <TimezoneSelector className="shrink-0" />
            </div>
          </div>

          {/* Bento Telemetry Strip */}
          <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4 sm:gap-3">
            {/* Bento Pod 1: Week Total */}
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-surface-2/50 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <CalendarIcon className="h-3 w-3 text-accent-strong" />
                <span>Week Airings</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                  {allEntries.length}
                </span>
                <span className="text-[11px] text-faint">episodes</span>
              </div>
            </div>

            {/* Bento Pod 2: Today's Releases */}
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-surface-2/50 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span>Today&apos;s Broadcasts</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                  {localDays.find((d) => d.isToday)?.entries.length ?? 0}
                </span>
                <span className="text-[11px] text-faint">airing today</span>
              </div>
            </div>

            {/* Bento Pod 3: Watchlist Episodes */}
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-surface-2/50 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
                <FlameIcon className="h-3 w-3 text-purple-400" />
                <span>Watchlist Queue</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                  {totalWatchingInWeek}
                </span>
                <span className="text-[11px] text-faint">tracked series</span>
              </div>
            </div>

            {/* Bento Pod 4: Next Airing Countdown */}
            <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-surface-2/50 p-3 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 radar-live-dot" />
                <span>Next Upcoming</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                {nextUpcomingEntry ? (
                  <span
                    className="truncate font-display text-xs font-semibold text-fg"
                    title={getDisplayTitle(nextUpcomingEntry.media.title, true)}
                  >
                    {formatAiringRelative(nextUpcomingEntry.airingAt, nowMs).label}
                  </span>
                ) : (
                  <span className="text-xs text-faint">None remaining</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 7-Day Studio Broadcast Dock (Mon - Sun) */}
      <div className="rounded-2xl border border-white/[0.08] bg-surface/70 p-2 backdrop-blur-md shadow-xs">
        <div
          role="group"
          aria-label="Filter by day of week"
          className="no-scrollbar flex gap-2 overflow-x-auto sm:grid sm:grid-cols-7"
        >
          {localDays.map((day) => {
            const isSelected = day.date === selectedDate;
            const dayWatchingCount = day.entries.filter((e) =>
              watchingSet.has(e.mediaId),
            ).length;

            return (
              <button
                key={day.date}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${day.dayName} ${day.dayNumber}, ${day.entries.length} releases`}
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  "group relative flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all duration-150 ease-out select-none sm:min-w-0 sm:shrink active:scale-[0.98]",
                  isSelected
                    ? "border-accent/60 bg-accent-soft shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                    : "border-transparent bg-transparent hover:bg-surface-2",
                )}
              >
                {/* Day Name or Today Badge */}
                {day.isToday ? (
                  <span className="rounded-md border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-strong">
                    Today
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[11px] font-semibold transition-colors",
                      isSelected
                        ? "text-fg"
                        : "text-muted group-hover:text-fg",
                    )}
                  >
                    {day.dayShort}
                  </span>
                )}

                {/* Day Number */}
                <span
                  className={cn(
                    "mt-1 font-display text-xl font-bold tabular-nums transition-colors",
                    isSelected ? "text-white" : "text-fg",
                  )}
                >
                  {day.dayNumber}
                </span>

                {/* Release Count and Watchlist Dot */}
                <div className="mt-1 flex items-center gap-1.5 text-[11px] tabular-nums">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      isSelected
                        ? "bg-accent/30 text-accent-strong"
                        : "bg-surface-3 text-faint",
                    )}
                  >
                    {day.entries.length} eps
                  </span>

                  {dayWatchingCount > 0 ? (
                    <span
                      title={`${dayWatchingCount} in your watchlist`}
                      className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.9)]"
                    />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Bar: Filter (All vs Watching) & Search Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* All vs Watching segmented filter */}
        <div
          role="group"
          aria-label="Filter schedule releases"
          className="flex rounded-xl border border-white/[0.08] bg-surface/70 p-1 backdrop-blur-md"
        >
          <button
            type="button"
            aria-pressed={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
              filterMode === "all"
                ? "border border-accent/40 bg-accent-soft text-accent-strong shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            <span>All Releases</span>
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-faint">
              {activeDay?.entries.length ?? 0}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95",
              filterMode === "watching"
                ? "border border-purple-500/50 bg-purple-500/20 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.25)]"
                : "text-muted hover:text-fg",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
            <span>My Watchlist</span>
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-purple-300">
              {activeDay?.entries.filter((e) => watchingSet.has(e.mediaId))
                .length ?? 0}
            </span>
          </button>
        </div>

        {/* Search input within the active day */}
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="schedule-day-search" className="sr-only">
            Filter today&apos;s releases
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
            <SearchIcon className="h-3.5 w-3.5" />
          </div>
          <input
            id="schedule-day-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title…"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-surface/70 pl-8 pr-3 text-xs text-fg placeholder:text-faint/70 transition-all focus:border-accent focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
        </div>
      </div>

      {/* Active Day Releases Header & Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-fg sm:text-lg">
            {activeDay ? formatDayHeading(activeDay.date) : ""}
          </h2>
          <span className="rounded-full border border-white/[0.08] bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1 ? "release" : "releases"}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-7 w-7 text-faint" />}
            title={
              filterMode === "watching"
                ? "No tracked anime air on this day"
                : searchQuery
                  ? "No matching releases found"
                  : "No scheduled releases on this day"
            }
            description={
              filterMode === "watching"
                ? "None of the anime currently in your Watching list have episodes scheduled for this date."
                : searchQuery
                  ? `No releases on this day match “${searchQuery}”.`
                  : "There are no anime episodes scheduled to broadcast on this day."
            }
            action={
              filterMode === "watching" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterMode("all")}
                  className="rounded-xl"
                >
                  View all releases
                </Button>
              ) : searchQuery ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl"
                >
                  Clear search
                </Button>
              ) : (
                <Link
                  href="/discover"
                  className="inline-flex h-9 items-center rounded-xl border border-white/10 bg-surface-2 px-4 text-xs font-semibold text-fg transition-colors hover:border-white/20 hover:bg-surface-3"
                >
                  Explore anime in Discover
                </Link>
              )
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map((entry) => (
              <ScheduleReleaseCard
                key={entry.id}
                entry={entry}
                timeZone={activeTimeZone}
                titleLanguage={preferences.titleLanguage}
                inWatching={watchingSet.has(entry.mediaId)}
                canWrite={canWrite}
                libraryEntry={entryFor(entry.mediaId)}
                watchedEpisodes={watchedEpisodesFor(entry.mediaId)}
                onToggleEpisode={toggleEpisode}
                isPending={pendingIds.has(entry.mediaId)}
                onRequestAdd={requestAdd}
                nowMs={nowMs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleReleaseCardProps {
  entry: AiringScheduleEntry;
  timeZone?: string;
  titleLanguage: "english" | "romaji";
  inWatching: boolean;
  canWrite: boolean;
  libraryEntry: ReturnType<ReturnType<typeof useLibrary>["entryFor"]>;
  watchedEpisodes: number[];
  onToggleEpisode: (
    anime: AnimeSummary,
    episodeNumber: number,
    watched?: boolean,
  ) => Promise<boolean>;
  isPending: boolean;
  onRequestAdd: (anime: AnimeSummary) => void;
  nowMs: number;
}

function ScheduleReleaseCard({
  entry,
  timeZone,
  titleLanguage,
  inWatching,
  canWrite,
  libraryEntry,
  watchedEpisodes,
  onToggleEpisode,
  isPending,
  onRequestAdd,
  nowMs,
}: ScheduleReleaseCardProps) {
  const anime = entry.media;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large ?? null;

  const airingTimeStr = formatAiringTime(entry.airingAt, timeZone);
  const tzAbbr = getTimeZoneAbbr(entry.airingAt, timeZone);
  const relative = formatAiringRelative(entry.airingAt, nowMs);

  // Check if this specific episode has been watched. Individual records are the source of truth when present.
  const isWatched =
    watchedEpisodes.length > 0
      ? watchedEpisodes.includes(entry.episode)
      : libraryEntry !== null && libraryEntry.progress >= entry.episode;

  const [toggling, setToggling] = useState(false);

  const handleMarkWatched = async () => {
    if (isPending || toggling) return;
    setToggling(true);
    await onToggleEpisode(anime, entry.episode, !isWatched);
    setToggling(false);
  };

  const score = anime.averageScore ? formatScore(anime.averageScore) : null;
  const formatText = formatFormat(anime.format);

  return (
    <article
      className={cn(
        "group relative flex gap-3.5 rounded-2xl border p-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        inWatching
          ? "border-purple-500/40 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.12)] hover:border-purple-500/60"
          : "border-white/[0.08] bg-surface/75 hover:border-white/[0.18] hover:bg-surface-2/80",
      )}
    >
      {/* Accent beacon rail on watchlist entries */}
      {inWatching ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3.5 left-0 w-1 rounded-r-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.9)]"
        />
      ) : null}

      {/* Poster Artwork with direct CDN delivery */}
      <Link
        href={`/anime/${anime.id}`}
        className="relative block h-[122px] w-[82px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-3 shadow-md"
        aria-label={`Open details for ${title}`}
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            unoptimized
            sizes="82px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <PosterFallback color={anime.coverImage.color} />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Episode badge overlay on artwork */}
        <span className="absolute bottom-1.5 inset-x-1.5 rounded-md border border-white/20 bg-black/85 px-1 py-0.5 text-center text-[10px] font-bold text-amber-300 backdrop-blur-md">
          Ep {entry.episode}
        </span>
      </Link>

      {/* Information & Actions Column */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Airing Timestamp & Countdown Header */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span
                suppressHydrationWarning
                className="font-mono font-semibold tabular-nums text-fg"
              >
                {airingTimeStr}{" "}
                <span className="text-[10px] font-medium text-faint">
                  {tzAbbr}
                </span>
              </span>
              <span className="text-faint">·</span>
              <span
                className={cn(
                  "font-medium",
                  relative.hasAired
                    ? "text-muted"
                    : "text-accent-strong font-semibold flex items-center gap-1",
                )}
              >
                {!relative.hasAired && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-strong radar-live-dot" />
                )}
                <span>{relative.label}</span>
              </span>
            </div>

            {/* In-Watchlist Badge or Status Badge */}
            {inWatching ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_4px_rgba(168,85,247,0.8)]"
                />
                Watching
              </span>
            ) : libraryEntry ? (
              <StatusBadge
                status={libraryEntry.status}
                className="text-[10px] px-2 py-0.5"
              />
            ) : null}
          </div>

          {/* Anime Title */}
          <Link
            href={`/anime/${anime.id}`}
            className="mt-1 line-clamp-2-safe font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
            title={title}
          >
            {title}
          </Link>

          {/* Subtitle Metadata */}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
            {formatText && <span>{formatText}</span>}
            {anime.seasonYear && <span>· {anime.seasonYear}</span>}
            {score && (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                · <StarIcon className="h-2.5 w-2.5 fill-current" />
                {score}
              </span>
            )}
          </div>
        </div>

        {/* Action Button Row */}
        <div className="mt-2.5 pt-1">
          {canWrite ? (
            isWatched ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/25 active:scale-95"
                aria-label={`Unmark Episode ${entry.episode}`}
              >
                <CheckIcon className="h-3.5 w-3.5" />
                <span>Watched</span>
              </button>
            ) : relative.hasAired ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 text-xs font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-white active:scale-95 disabled:opacity-50"
              >
                {toggling ? (
                  <span className="inline-flex items-center gap-1.5">
                    <LoaderIcon className="h-3 w-3 animate-spin" />
                    <span>Saving…</span>
                  </span>
                ) : (
                  <>
                    <PlusIcon className="h-3 w-3 text-accent-strong" />
                    <span>Mark Ep {entry.episode} Watched</span>
                  </>
                )}
              </button>
            ) : inWatching ? (
              <span
                suppressHydrationWarning
                className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-faint"
              >
                <ClockIcon className="h-3.5 w-3.5 text-muted" />
                <span>Airs {airingTimeStr}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRequestAdd(anime)}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-3 text-xs font-medium text-muted transition-all hover:border-accent/40 hover:bg-surface-3 hover:text-fg active:scale-95"
              >
                <PlusIcon className="h-3 w-3" />
                <span>Track Anime</span>
              </button>
            )
          ) : (
            <Link
              href={`/anime/${anime.id}`}
              className="inline-flex h-8 items-center gap-1 text-xs font-medium text-muted hover:text-fg"
            >
              View details →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
