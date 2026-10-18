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
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatAiringRelative,
  formatAiringTime,
  toIsoDateString,
  type WeekRange,
} from "@/lib/schedule";
import { cn, formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
import type {
  AiringScheduleEntry,
  AnimeSummary,
  WeeklyScheduleDay,
} from "@/types/anime";

interface ScheduleBrowserProps {
  week: WeekRange;
  days: WeeklyScheduleDay[];
  watchingIds: number[];
}

export function ScheduleBrowser({
  week,
  days,
  watchingIds,
}: ScheduleBrowserProps) {
  const router = useRouter();
  const { preferences } = usePreferences();
  const {
    canWrite,
    entryFor,
    watchedEpisodesFor,
    toggleEpisode,
    pendingIds,
  } = useLibrary();

  const watchingSet = useMemo(() => new Set(watchingIds), [watchingIds]);

  // Default active day is today if within this week, otherwise Monday (first day)
  const todayIso = useMemo(() => toIsoDateString(new Date()), []);
  const initialDayDate = useMemo(() => {
    const todayMatch = week.days.find((d) => d.date === todayIso);
    return todayMatch ? todayMatch.date : (week.days[0]?.date ?? todayIso);
  }, [todayIso, week.days]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDayDate);
  const [filterMode, setFilterMode] = useState<"all" | "watching">("all");

  const activeDay = useMemo(() => {
    return days.find((d) => d.date === selectedDate) ?? days[0] ?? null;
  }, [days, selectedDate]);

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
    for (const d of days) {
      for (const entry of d.entries) {
        if (watchingSet.has(entry.mediaId)) {
          count += 1;
        }
      }
    }
    return count;
  }, [days, watchingSet]);

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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
              Airing calendar
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Weekly Schedule
          </h1>
          <p className="mt-1 text-sm text-muted">
            Expected releases in your local timezone · {week.weekLabel}
          </p>
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
        <div role="tablist" aria-label="Schedule filter" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
              filterMode === "all"
                ? "bg-accent-soft text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            All releases
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
              filterMode === "watching"
                ? "bg-accent-soft text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span>My watching</span>
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] tabular-nums text-accent-strong">
              {totalWatchingInWeek}
            </span>
          </button>
        </div>

        <span className="text-xs text-faint">
          {filteredEntries.length} {filteredEntries.length === 1 ? "release" : "releases"} on{" "}
          {activeDay?.dayName}
        </span>
      </div>

      {/* Horizontal Day Selector (Mon - Sun) */}
      <div
        role="tablist"
        aria-label="Days of the week"
        className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 py-1 sm:grid sm:grid-cols-7"
      >
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const dayWatchingCount = day.entries.filter((e) =>
            watchingSet.has(e.mediaId),
          ).length;

          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedDate(day.date)}
              className={cn(
                "group relative flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all sm:min-w-0 sm:shrink",
                isSelected
                  ? "border-accent/50 bg-accent-soft text-fg shadow-sm shadow-accent/10"
                  : "border-border-subtle bg-surface/70 text-muted hover:border-border hover:bg-surface hover:text-fg",
              )}
            >
              {day.isToday ? (
                <span className="absolute -top-1.5 rounded-full bg-accent px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-accent-contrast shadow-sm">
                  Today
                </span>
              ) : null}

              <span className="text-[11px] font-medium uppercase tracking-wider text-faint group-hover:text-muted">
                {day.dayShort}
              </span>
              <span
                className={cn(
                  "mt-1 font-display text-lg font-bold tabular-nums",
                  isSelected ? "text-accent-strong" : "text-fg",
                )}
              >
                {day.dayNumber}
              </span>

              {/* Dot Indicators */}
              <div className="mt-1 flex items-center gap-1">
                {day.entries.length > 0 ? (
                  <span className="text-[10px] tabular-nums text-faint">
                    {day.entries.length}
                  </span>
                ) : (
                  <span className="text-[10px] text-faint/60">—</span>
                )}
                {dayWatchingCount > 0 ? (
                  <span
                    title={`${dayWatchingCount} from your watchlist`}
                    className="h-1.5 w-1.5 rounded-full bg-accent-strong"
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Day Release Timeline / List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-fg">
            {activeDay?.dayName}, {activeDay?.date}
          </h2>
          {activeDay?.isToday ? (
            <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent-strong">
              Today&apos;s releases
            </span>
          ) : null}
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

  const airingTimeStr = formatAiringTime(entry.airingAt);
  const relative = formatAiringRelative(entry.airingAt);

  // Check if this specific episode has been watched
  const isWatched =
    watchedEpisodes.includes(entry.episode) ||
    (libraryEntry !== null && libraryEntry.progress >= entry.episode);

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
          ? "border-accent/40 bg-surface/90 hover:border-accent"
          : "border-border-subtle bg-surface hover:border-border",
      )}
    >
      {/* Poster */}
      <Link
        href={`/anime/${anime.id}`}
        className="relative block h-[110px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-surface-2"
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
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong">
            Ep {entry.episode}
          </span>
          {anime.format ? (
            <span className="text-[10px] uppercase text-faint">
              {formatFormat(anime.format)}
            </span>
          ) : null}
          {inWatching ? (
            <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-strong">
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
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-fg">{airingTimeStr}</span>
          <span className="text-faint">·</span>
          <span className={cn(relative.hasAired ? "text-faint" : "text-accent-strong")}>
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
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-strong transition-colors hover:bg-accent/20"
                aria-label={`Unmark Episode ${entry.episode}`}
              >
                <CheckIcon className="h-3 w-3" />
                Watched
              </button>
            ) : relative.hasAired ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-[11px]"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
              >
                {toggling ? "Saving…" : `Mark Ep ${entry.episode} watched`}
              </Button>
            ) : (
              <span className="text-[11px] text-faint">
                Airs {airingTimeStr}
              </span>
            )
          ) : (
            <Link
              href={`/anime/${anime.id}`}
              className="inline-flex h-7 items-center gap-1 text-[11px] text-muted hover:text-fg"
            >
              Details →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
