"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
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
import type { AiringScheduleEntry, AnimeSummary } from "@/types/anime";

interface HomeScheduleProps {
  week: WeekRange;
  initialEntries: AiringScheduleEntry[] | null;
}

/** The dashboard shows the shape of a day and links out; the full page holds
 *  every release. Four rows keep the next content block above the fold. */
const VISIBLE_RELEASES = 4;

function formatDayHeading(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function HomeSchedule({ week, initialEntries }: HomeScheduleProps) {
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const {
    items,
    canWrite,
    entryFor,
    watchedEpisodesFor,
    toggleEpisode,
    pendingIds,
  } = useLibrary();

  const isError = initialEntries === null;

  const watchingIds = useMemo(() => {
    return items
      .filter((item) => item.entry.status === "watching")
      .map((item) => item.entry.anilistId);
  }, [items]);

  const watchingSet = useMemo(() => new Set(watchingIds), [watchingIds]);

  const days = useMemo(() => {
    if (!initialEntries) {
      return week.days.map((day) => ({
        ...day,
        entries: [],
      }));
    }
    return groupScheduleByDay(initialEntries, week.days, activeTimeZone);
  }, [initialEntries, week.days, activeTimeZone]);

  // Default active day is today in active timezone if within this week, otherwise first day
  const initialDate = useMemo(() => {
    const localTodayIso = toIsoDateString(new Date(), activeTimeZone);
    const match = days.find((d) => d.date === localTodayIso);
    return match ? match.date : (days[0]?.date ?? "");
  }, [days, activeTimeZone]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [filterMode, setFilterMode] = useState<"all" | "watching">("all");

  const activeDay = useMemo(() => {
    return days.find((d) => d.date === selectedDate) ?? days[0] ?? null;
  }, [days, selectedDate]);

  // Total watching anime releasing this week
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

  const filteredEntries = useMemo(() => {
    if (!activeDay) return [];
    if (filterMode === "watching") {
      return activeDay.entries.filter((entry) => watchingSet.has(entry.mediaId));
    }
    return activeDay.entries;
  }, [activeDay, filterMode, watchingSet]);

  const visibleEntries = filteredEntries.slice(0, VISIBLE_RELEASES);
  const hiddenCount = filteredEntries.length - visibleEntries.length;

  if (isError) {
    return (
      <section aria-label="Airing this week" className="space-y-4">
        <SectionHeader
          title="Airing this week"
          description={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span>Broadcast releases in</span>
              <TimezoneSelector />
              <span className="text-faint">·</span>
              <span>{week.weekLabel}</span>
            </span>
          }
          action="Full schedule"
          actionHref="/schedule"
        />
        <div className="rounded-2xl border border-border-subtle bg-surface p-6 text-center">
          <CalendarIcon className="mx-auto h-6 w-6 text-muted" />
          <h3 className="mt-2 text-sm font-semibold text-fg">
            Could not load this week&apos;s schedule
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            AniList schedule service could not be reached. The rest of your dashboard remains functional.
          </p>
          <div className="mt-3.5 flex justify-center">
            <Link
              href="/schedule"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold text-fg transition-colors hover:bg-surface-3"
            >
              Open schedule page
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Airing this week" className="space-y-4">
      <SectionHeader
        title="Airing this week"
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>Broadcast releases in</span>
            <TimezoneSelector />
            <span className="text-faint">·</span>
            <span>{week.weekLabel}</span>
          </span>
        }
        action="Full schedule"
        actionHref="/schedule"
      />

      {/* Week selector: 7 evenly sized day tiles */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:grid sm:grid-cols-7 sm:gap-2.5">
        {days.map((day) => {
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
                "group flex min-w-[70px] shrink-0 flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all sm:min-w-0 sm:shrink",
                day.isToday
                  ? isSelected
                    ? "border-accent bg-accent/15 text-fg ring-1 ring-accent/50"
                    : "border-accent/70 bg-accent/10 text-fg"
                  : isSelected
                    ? "border-border bg-surface-3 text-fg ring-1 ring-border"
                    : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium tracking-wide",
                  day.isToday
                    ? "font-semibold text-accent-strong"
                    : isSelected
                      ? "text-fg"
                      : "text-faint group-hover:text-muted",
                )}
              >
                {day.isToday ? "Today" : day.dayShort}
              </span>
              <span className="mt-1 font-display text-xl font-bold tabular-nums text-fg">
                {day.dayNumber}
              </span>
              <span className="mt-1 flex items-center justify-center gap-1 text-[11px] tabular-nums text-muted">
                <span>{day.entries.length} eps</span>
                {dayWatchingCount > 0 ? (
                  <span
                    title={`${dayWatchingCount} from your library`}
                    className="h-1.5 w-1.5 rounded-full bg-accent-strong"
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
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
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "all"
                ? "bg-surface-3 text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            All releases
            {activeDay ? (
              <span className="tabular-nums text-faint">
                {activeDay.entries.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            aria-pressed={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filterMode === "watching"
                ? "bg-surface-3 text-fg"
                : "text-muted hover:text-fg",
            )}
          >
            My anime
            <span className="tabular-nums text-faint">{totalWatchingInWeek}</span>
          </button>
        </div>

        <h3 className="font-display text-sm font-semibold text-fg">
          {activeDay ? formatDayHeading(activeDay.date) : null}
        </h3>
      </div>

      {/* Release Items */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          compact
          icon={<CalendarIcon className="h-5 w-5" />}
          title={
            filterMode === "watching"
              ? "No tracked anime air on this day"
              : "No releases scheduled for this day"
          }
          description={
            filterMode === "watching"
              ? "None of the anime currently in your Watching list have an episode broadcasting on this date."
              : "There are no anime broadcasts recorded for this date."
          }
          action={
            filterMode === "watching" ? (
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold text-fg transition-colors hover:bg-surface-3"
              >
                View all releases
              </button>
            ) : (
              <Link
                href="/schedule"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold text-fg transition-colors hover:bg-surface-3"
              >
                Open schedule
                <ChevronRightIcon className="h-3 w-3" />
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleEntries.map((entry) => (
              <HomeScheduleCard
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

          {hiddenCount > 0 && activeDay ? (
            <Link
              href={`/schedule?date=${activeDay.date}`}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              All {filteredEntries.length} releases on {activeDay.dayName}
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

interface HomeScheduleCardProps {
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

function HomeScheduleCard({
  entry,
  timeZone,
  titleLanguage,
  inWatching,
  canWrite,
  libraryEntry,
  watchedEpisodes,
  onToggleEpisode,
  isPending,
}: HomeScheduleCardProps) {
  const anime = entry.media;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;

  const airingTimeStr = formatAiringTime(entry.airingAt, timeZone);
  const tzAbbr = getTimeZoneAbbr(entry.airingAt, timeZone);
  const relative = formatAiringRelative(entry.airingAt);

  // Individual watched records are the source of truth when present.
  // Fall back to legacy progress only when no individual records exist.
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

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border p-3 transition-colors",
        inWatching
          ? "border-accent/45 bg-accent-soft hover:border-accent"
          : "border-border-subtle bg-surface hover:border-border",
      )}
    >
      {inWatching ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-accent-strong"
        />
      ) : null}

      {/* Poster */}
      <Link
        href={`/anime/${anime.id}`}
        className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 group/poster shadow-sm sm:w-16"
        aria-label={`Open ${title}`}
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="64px"
            className="object-cover transition-transform duration-200 group-hover/poster:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-surface-3" />
        )}
      </Link>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
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
            ) : null}
          </div>

          <Link
            href={`/anime/${anime.id}`}
            className="mt-1 line-clamp-1 font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
            title={title}
          >
            {title}
          </Link>

          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
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
            <span
              className={cn(
                relative.hasAired
                  ? "text-muted"
                  : "font-medium text-accent-strong",
              )}
            >
              {relative.label}
            </span>
          </div>
        </div>

        {/* One action. The poster and title already open the details page, so
            the card does not repeat that link. */}
        <div className="mt-2 flex items-center pt-1">
          {canWrite ? (
            isWatched ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2.5 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/20"
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
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
              >
                <PlusIcon className="h-3 w-3" />
                <span>{toggling ? "Saving…" : `Mark Ep ${entry.episode} watched`}</span>
              </button>
            ) : (
              <span suppressHydrationWarning className="text-xs text-faint">
                Airs {airingTimeStr} {tzAbbr}
              </span>
            )
          ) : (
            <Link
              href={`/anime/${anime.id}`}
              className="inline-flex h-8 items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
            >
              View details
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
