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
import { OpticalGlass } from "@/components/ui/optical-glass";
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
    const withBanner = [...allEntries]
      .filter((e) => e.media.bannerImage)
      .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))[0];
    if (withBanner?.media.bannerImage) {
      return withBanner.media.bannerImage;
    }
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

  const nextUpcomingTitle = nextUpcomingEntry
    ? getDisplayTitle(nextUpcomingEntry.media.title, preferences.titleLanguage === "english")
    : null;

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* Editorial Brutalist Masthead */}
      <header className="border-b border-border pb-7">
        {/* Top Eyebrow Row with Week Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Broadcast Radar · Weekly Simulcast Index
            </span>
            <span className="text-faint">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {week.weekLabel}
            </span>
          </div>

          {/* Week navigation buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevWeek}
              aria-label="Previous week"
              className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg"
            >
              <ChevronLeftIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="inline-flex h-7 items-center border border-accent bg-accent/15 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleNextWeek}
              aria-label="Next week"
              className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Main Title & Spotlight Deck */}
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-fg">
              Weekly Broadcast Schedule
            </h1>
            <p className="mt-3 max-w-[34rem] text-[13px] leading-relaxed text-muted">
              Tracking{" "}
              <span className="font-mono font-medium text-fg tabular-nums">
                {allEntries.length} releases
              </span>{" "}
              across global simulcasts this week ·{" "}
              <span className="font-mono font-medium text-accent-strong tabular-nums">
                {totalWatchingInWeek} episodes
              </span>{" "}
              in your active watchlist.
            </p>

            {/* Timezone readout pill */}
            <div className="mt-4 inline-flex max-w-full items-center gap-2 border border-border bg-surface/60 px-2.5 py-1 text-[10px] text-muted">
              <ClockIcon className="h-3 w-3 shrink-0 text-accent-strong" />
              <span className="uppercase tracking-[0.1em] text-faint">Local Timezone:</span>
              <TimezoneSelector className="shrink-0 font-mono text-[11px]" />
            </div>
          </div>

          {/* Spotlight Frame: Next Upcoming Airing */}
          {nextUpcomingEntry ? (
            <div className="relative aspect-[16/10] overflow-hidden border border-border bg-surface-2">
              {heroBackdrop && isHttpUrl(heroBackdrop) ? (
                <Image
                  src={heroBackdrop}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 380px"
                  className="object-cover object-top opacity-55 transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-3" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

              <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 border border-accent/40 bg-black/80 px-2 py-0.5 font-mono text-[9px] font-semibold text-accent-strong backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong radar-live-dot" />
                <span>Next Upcoming</span>
              </span>

              <OpticalGlass
                variant="card"
                className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-2.5 p-2 sm:gap-3 sm:p-2.5"
              >
                <Link
                  href={`/media/${nextUpcomingEntry.media.id}`}
                  className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-white/20 sm:w-11"
                >
                  {nextUpcomingEntry.media.coverImage?.extraLarge ||
                  nextUpcomingEntry.media.coverImage?.large ? (
                    <Image
                      src={
                        nextUpcomingEntry.media.coverImage.extraLarge ??
                        nextUpcomingEntry.media.coverImage.large ??
                        ""
                      }
                      alt=""
                      fill
                      unoptimized
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-white/10" />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                    Episode {nextUpcomingEntry.episode}
                  </p>
                  <Link
                    href={`/media/${nextUpcomingEntry.media.id}`}
                    className="mt-0.5 block truncate font-display text-[13px] font-medium leading-tight text-white transition-colors hover:text-accent-strong"
                    title={nextUpcomingTitle ?? ""}
                  >
                    {nextUpcomingTitle}
                  </Link>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-white/70 tabular-nums">
                    {formatAiringRelative(nextUpcomingEntry.airingAt, nowMs).label}
                  </p>
                </div>

                <Link
                  href={`/media/${nextUpcomingEntry.media.id}`}
                  aria-label={`Open ${nextUpcomingTitle}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/25 text-white/85 transition-colors hover:border-accent hover:text-accent-strong"
                >
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </OpticalGlass>
            </div>
          ) : null}
        </div>

        {/* Telemetry Strip / Metric Pods */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:grid-cols-4 sm:gap-3">
          <div className="flex flex-col border border-border bg-surface/40 p-3">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
              <CalendarIcon className="h-2.5 w-2.5 text-accent-strong" />
              Week Airings
            </span>
            <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
              {allEntries.length}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
              total broadcasts
            </span>
          </div>

          <div className="flex flex-col border border-border bg-surface/40 p-3">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              Today&apos;s Airings
            </span>
            <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
              {localDays.find((d) => d.date === todayIso)?.entries.length ?? 0}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
              episodes today
            </span>
          </div>

          <div className="flex flex-col border border-border bg-surface/40 p-3">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
              <FlameIcon className="h-2.5 w-2.5" />
              Watchlist Queue
            </span>
            <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
              {totalWatchingInWeek}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
              tracked series
            </span>
          </div>

          <div className="flex flex-col border border-border bg-surface/40 p-3">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-400">
              <ClockIcon className="h-2.5 w-2.5 text-amber-400" />
              Next Airing
            </span>
            <span className="mt-1 truncate font-mono text-xs font-semibold tabular-nums text-fg sm:text-sm">
              {nextUpcomingEntry
                ? formatAiringRelative(nextUpcomingEntry.airingAt, nowMs).label
                : "None"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
              countdown
            </span>
          </div>
        </div>
      </header>

      {/* 7-Day Ruled Segmented Broadcast Dock */}
      <div
        role="group"
        aria-label="Filter by day of week"
        className="no-scrollbar flex gap-1.5 overflow-x-auto border-y border-border py-2.5 sm:grid sm:grid-cols-7 sm:gap-2"
      >
        {localDays.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === todayIso;
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
                "group relative flex min-w-[76px] shrink-0 flex-col items-center justify-center border p-2 text-center transition-colors select-none sm:min-w-0 sm:shrink",
                isSelected
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface/40 hover:border-accent/40 hover:bg-surface",
              )}
            >
              {/* Day Name or Today Badge */}
              {isToday ? (
                <span className="border border-accent/40 bg-accent/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-accent-strong">
                  Today
                </span>
              ) : (
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-[0.14em] transition-colors",
                    isSelected ? "text-fg" : "text-muted group-hover:text-fg",
                  )}
                >
                  {day.dayShort}
                </span>
              )}

              {/* Day Number */}
              <span
                className={cn(
                  "mt-1 font-mono text-xl font-bold tabular-nums transition-colors",
                  isSelected ? "text-accent-strong" : "text-fg",
                )}
              >
                {day.dayNumber}
              </span>

              {/* Release Count and Watchlist Dot */}
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                <span className={isSelected ? "text-accent-strong" : "text-faint"}>
                  {day.entries.length} eps
                </span>

                {dayWatchingCount > 0 ? (
                  <span
                    title={`${dayWatchingCount} in your watchlist`}
                    className="h-1.5 w-1.5 rounded-full bg-accent-strong radar-live-dot"
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Control Bar: Filter Mode (All vs Watching) & Search Input */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* All vs Watching segmented filter */}
        <div
          role="group"
          aria-label="Filter schedule releases"
          className="inline-flex border border-border bg-surface/40 p-0.5"
        >
          <button
            type="button"
            aria-pressed={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={cn(
              "h-8 border-r border-border px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors inline-flex items-center gap-1.5",
              filterMode === "all"
                ? "bg-accent text-accent-contrast"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span>All Releases</span>
            <span className="font-mono text-[9px] font-bold tabular-nums opacity-80">
              ({activeDay?.entries.length ?? 0})
            </span>
          </button>

          <button
            type="button"
            aria-pressed={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "h-8 px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors inline-flex items-center gap-1.5",
              filterMode === "watching"
                ? "bg-accent text-accent-contrast"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
            <span>My Watchlist</span>
            <span className="font-mono text-[9px] font-bold tabular-nums opacity-80">
              (
              {activeDay?.entries.filter((e) => watchingSet.has(e.mediaId))
                .length ?? 0}
              )
            </span>
          </button>
        </div>

        {/* Search input within the active day */}
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor="schedule-day-search" className="sr-only">
            Filter today&apos;s releases
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-faint">
            <SearchIcon className="h-3.5 w-3.5" />
          </div>
          <input
            id="schedule-day-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles airing on this day…"
            className="h-8 w-full border border-border bg-bg/60 pl-8 pr-3 text-[13px] text-fg placeholder:text-faint/70 transition-colors focus:border-accent focus:bg-surface focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
        </div>
      </div>

      {/* Active Day Releases Header & Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-fg sm:text-base">
            {activeDay ? formatDayHeading(activeDay.date) : ""}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-faint">
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1 ? "release" : "releases"}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6 text-faint" />}
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
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
                >
                  View all releases
                </button>
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
                >
                  Clear search
                </button>
              ) : (
                <Link
                  href="/discover"
                  className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
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
        "group relative flex gap-3 border p-3 transition-colors",
        inWatching
          ? "border-accent/50 bg-accent-soft/20"
          : "border-border bg-surface/60 hover:border-accent/40 hover:bg-surface",
      )}
    >
      {/* Accent left indicator rail on watchlist entries */}
      {inWatching ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px] bg-accent"
        />
      ) : null}

      {/* Poster Artwork Container */}
      <Link
        href={`/media/${anime.id}`}
        className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-24"
        aria-label={`Open details for ${title}`}
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            unoptimized
            sizes="96px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PosterFallback color={anime.coverImage.color} />
        )}

        {/* Flush Episode chip at bottom of artwork */}
        <span className="absolute inset-x-0 bottom-0 bg-bg/90 py-0.5 text-center font-mono text-[9px] font-semibold text-fg tabular-nums">
          Ep {entry.episode}
        </span>
      </Link>

      {/* Information & Actions Column */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Airing Timestamp & Countdown Header */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span
                suppressHydrationWarning
                className="font-semibold tabular-nums text-fg"
              >
                {airingTimeStr}{" "}
                <span className="text-[9px] font-normal text-faint">
                  {tzAbbr}
                </span>
              </span>
              <span className="text-faint">·</span>
              <span
                className={cn(
                  "font-medium",
                  relative.hasAired
                    ? "text-faint"
                    : "text-accent-strong font-semibold flex items-center gap-1",
                )}
              >
                {!relative.hasAired && (
                  <span className="h-1 w-1 rounded-full bg-accent-strong radar-live-dot" />
                )}
                <span>{relative.label}</span>
              </span>
            </div>

            {/* In-Watchlist Badge or Status Badge */}
            {inWatching ? (
              <span className="inline-flex items-center gap-1 border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                Watching
              </span>
            ) : libraryEntry ? (
              <StatusBadge
                status={libraryEntry.status}
                className="text-[8px] px-1.5 py-0.5 uppercase tracking-[0.1em]"
              />
            ) : null}
          </div>

          {/* Anime Title */}
          <h3 className="mt-1 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong" title={title}>
            <Link href={`/media/${anime.id}`}>{title}</Link>
          </h3>

          {/* Subtitle Metadata */}
          <div className="mt-1 flex items-center gap-2 text-[8px] font-medium uppercase tracking-[0.14em] text-faint">
            {formatText && <span>{formatText}</span>}
            {anime.seasonYear && <span>· {anime.seasonYear}</span>}
            {score && (
              <span className="inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold text-amber-400 tabular-nums">
                · <StarIcon className="h-2 w-2 fill-current" />
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
                className="inline-flex h-7 items-center gap-1 border border-success/30 bg-success-soft/20 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-success transition-colors hover:bg-success-soft/40"
                aria-label={`Unmark Episode ${entry.episode}`}
              >
                <CheckIcon className="h-3 w-3" />
                <span>Watched</span>
              </button>
            ) : relative.hasAired ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-50"
              >
                {toggling ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderIcon className="h-2.5 w-2.5 animate-spin" />
                    <span>Saving…</span>
                  </span>
                ) : (
                  <>
                    <PlusIcon className="h-2.5 w-2.5" />
                    <span>Mark Ep {entry.episode} Watched</span>
                  </>
                )}
              </button>
            ) : inWatching ? (
              <span
                suppressHydrationWarning
                className="inline-flex h-7 items-center gap-1 text-[10px] font-medium text-faint"
              >
                <ClockIcon className="h-3 w-3 text-muted" />
                <span>Airs {airingTimeStr}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onRequestAdd(anime)}
                className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                <PlusIcon className="h-2.5 w-2.5" />
                <span>Track Anime</span>
              </button>
            )
          ) : (
            <Link
              href={`/media/${anime.id}`}
              className="inline-flex h-7 items-center text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong hover:underline"
            >
              View details &rarr;
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
