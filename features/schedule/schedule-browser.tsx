"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { useActiveTimeZone, usePreferences } from "@/components/providers/preferences-provider";
import { TimezoneSelector } from "@/components/timezone-selector";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatAiringRelative,
  formatAiringTime,
  getTimeZoneAbbr,
  groupScheduleByDay,
  toIsoDateString,
  type WeekRange,
} from "@/lib/schedule";
import { cn, formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
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

interface ScheduleBrowserProps {
  week: WeekRange;
  days: WeeklyScheduleDay[];
  entries?: AiringScheduleEntry[];
  watchingIds: number[];
  /** A `?date=` deep link selects that day, not just its week. */
  initialDate?: string;
}

export function ScheduleBrowser({
  week,
  days,
  entries,
  watchingIds,
  initialDate,
}: ScheduleBrowserProps) {
  const router = useRouter();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const {
    canWrite,
    entryFor,
    watchedEpisodesFor,
    toggleEpisode,
    pendingIds,
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
  const todayIso = useMemo(() => toIsoDateString(new Date(), activeTimeZone), [activeTimeZone]);
  const initialDayDate = useMemo(() => {
    if (initialDate && week.days.some((day) => day.date === initialDate)) {
      return initialDate;
    }
    const todayMatch = localDays.find((d) => d.date === todayIso);
    return todayMatch ? todayMatch.date : (localDays[0]?.date ?? todayIso);
  }, [initialDate, todayIso, localDays, week.days]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDayDate);
  const [filterMode, setFilterMode] = useState<"all" | "watching">("all");

  const activeDay = useMemo(() => {
    return localDays.find((d) => d.date === selectedDate) ?? localDays[0] ?? null;
  }, [localDays, selectedDate]);

  // Filter entries for the active day
  const filteredEntries = useMemo(() => {
    if (!activeDay) return [];
    if (filterMode === "watching") {
      return activeDay.entries.filter((entry) => watchingSet.has(entry.mediaId));
    }
    return activeDay.entries;
  }, [activeDay, filterMode, watchingSet]);

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
      {/* Top Header & Week Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
            Weekly schedule
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>Releases in</span>
            <TimezoneSelector />
            <span className="text-faint">·</span>
            <span>{week.weekLabel}</span>
          </div>
        </div>

        {/* Week navigation buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrevWeek}
            aria-label="Previous week"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Prev week</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleToday}
            className="text-xs font-medium text-fg"
          >
            Today
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleNextWeek}
            aria-label="Next week"
          >
            <span className="hidden sm:inline">Next week</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Tabs: All vs My Watching */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div
          role="group"
          aria-label="Schedule filter"
          className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-0.5"
        >
          <button
            type="button"
            aria-pressed={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filterMode === "all"
                ? "bg-surface-3 text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            All releases
          </button>
          <button
            type="button"
            aria-pressed={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              filterMode === "watching"
                ? "bg-surface-3 text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            <span>My watching</span>
            <span className="tabular-nums text-faint">{totalWatchingInWeek}</span>
          </button>
        </div>

      </div>

      {/* Horizontal Day Selector (Mon - Sun) */}
      <div className="no-scrollbar -mx-2 flex gap-1.5 overflow-x-auto px-2 py-0.5 sm:grid sm:grid-cols-7">
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
                "group flex min-w-[64px] shrink-0 flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition-colors sm:min-w-0 sm:shrink",
                isSelected
                  ? "border-accent/60 bg-accent-soft"
                  : "border-border-subtle bg-surface hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium",
                  day.isToday
                    ? "text-accent-strong"
                    : isSelected
                      ? "text-fg"
                      : "text-faint group-hover:text-muted",
                )}
              >
                {day.isToday ? "Today" : day.dayShort}
              </span>
              <span className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">
                {day.dayNumber}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] tabular-nums text-faint">
                {day.entries.length > 0 ? (
                  <span>
                    {day.entries.length}{" "}
                    {day.entries.length === 1 ? "ep" : "eps"}
                  </span>
                ) : (
                  <span>No eps</span>
                )}
                {dayWatchingCount > 0 ? (
                  <span
                    title={`${dayWatchingCount} from your watchlist`}
                    className="h-1.5 w-1.5 rounded-full bg-accent-strong"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Day Release Timeline / List */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-fg">
            {activeDay ? formatDayHeading(activeDay.date) : ""}
          </h2>
          <span className="text-xs text-muted tabular-nums">
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1 ? "release" : "releases"}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={
              filterMode === "watching"
                ? "No watching anime air on this day"
                : "No scheduled releases on this day"
            }
            description={
              filterMode === "watching"
                ? "None of the anime currently in your Watching list have episodes scheduled for this date."
                : "There are no anime episodes scheduled to broadcast on this day."
            }
            action={
              filterMode === "watching" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFilterMode("all")}
                >
                  View all releases
                </Button>
              ) : (
                <Link
                  href="/discover"
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-3"
                >
                  Discover anime
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
}: ScheduleReleaseCardProps) {
  const anime = entry.media;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;

  const airingTimeStr = formatAiringTime(entry.airingAt, timeZone);
  const tzAbbr = getTimeZoneAbbr(entry.airingAt, timeZone);
  const relative = formatAiringRelative(entry.airingAt);

  // Check if this specific episode has been watched. Individual records are the source of truth when present.
  const isWatched =
    watchedEpisodes.length > 0
      ? watchedEpisodes.includes(entry.episode)
      : (libraryEntry !== null && libraryEntry.progress >= entry.episode);

  const [toggling, setToggling] = useState(false);

  const handleMarkWatched = async () => {
    if (isPending || toggling) return;
    setToggling(true);
    await onToggleEpisode(anime, entry.episode, !isWatched);
    setToggling(false);
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-2xl border p-3 transition-colors",
        inWatching
          ? "border-accent/45 bg-accent-soft shadow-sm hover:border-accent"
          : "border-border-subtle bg-surface hover:border-border",
      )}
    >
      {/* Accent rail: makes watchlist releases scannable in a long list. */}
      {inWatching ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-accent-strong"
        />
      ) : null}
      {/* Poster */}
      <Link
        href={`/anime/${anime.id}`}
        className="relative block h-[110px] w-[74px] shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2"
        aria-label={`Open ${title}`}
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="74px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
      </Link>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          <span className="font-semibold text-accent-strong">
            Episode {entry.episode}
          </span>
          {anime.format ? <span>{formatFormat(anime.format)}</span> : null}
          {inWatching ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-strong">
              <span
                aria-hidden="true"
                className="h-1 w-1 rounded-full bg-accent-strong"
              />
              Watching
            </span>
          ) : libraryEntry ? (
            <span className="ml-auto">
              <StatusBadge status={libraryEntry.status} />
            </span>
          ) : null}
        </div>

        <Link
          href={`/anime/${anime.id}`}
          className="mt-1 line-clamp-2-safe text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
        >
          {title}
        </Link>

        {/* Airing Timestamp & Countdown */}
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <span
            suppressHydrationWarning
            className="font-mono font-semibold tabular-nums text-fg inline-flex items-baseline gap-1"
          >
            <span>{airingTimeStr}</span>
            <span className="text-[10px] font-sans font-medium text-muted">
              {tzAbbr}
            </span>
          </span>
          <span className="text-faint">·</span>
          <span className={cn(relative.hasAired ? "text-muted" : "font-medium text-accent-strong")}>
            {relative.label}
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-auto pt-2.5">
          {canWrite ? (
            isWatched ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/20"
                aria-label={`Unmark Episode ${entry.episode}`}
              >
                <CheckIcon className="h-3 w-3" />
                Watched
              </button>
            ) : relative.hasAired ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
              >
                {toggling ? "Saving…" : `Mark Ep ${entry.episode} watched`}
              </Button>
            ) : (
              <span suppressHydrationWarning className="text-xs text-faint">
                Airs {airingTimeStr} {tzAbbr}
              </span>
            )
          ) : (
            <Link
              href={`/anime/${anime.id}`}
              className="inline-flex h-8 items-center gap-1 text-xs font-medium text-muted hover:text-fg"
            >
              View details
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
