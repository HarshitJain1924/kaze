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
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatAiringRelative,
  formatAiringTime,
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

export function HomeSchedule({ week, initialEntries }: HomeScheduleProps) {
  const { preferences } = usePreferences();
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

  // Default active day is today if within this week, otherwise first day
  const initialDate = useMemo(() => {
    const localTodayIso = toIsoDateString(new Date());
    const match = week.days.find((d) => d.date === localTodayIso);
    return match ? match.date : (week.days[0]?.date ?? "");
  }, [week.days]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [filterMode, setFilterMode] = useState<"all" | "watching">("all");

  const days = useMemo(() => {
    if (!initialEntries) {
      return week.days.map((day) => ({
        ...day,
        entries: [],
      }));
    }
    return groupScheduleByDay(initialEntries, week.days);
  }, [initialEntries, week.days]);

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

  if (isError) {
    return (
      <section aria-label="Airing this week" className="space-y-4">
        <SectionHeader
          title="Airing this week"
          description={`Broadcast releases in your local timezone · ${week.weekLabel}`}
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
        description={`Broadcast releases in your local timezone · ${week.weekLabel}`}
        action="Full schedule"
        actionHref="/schedule"
      />

      {/* Week Day Selector Tabs */}
      <div
        role="tablist"
        aria-label="Days of the week"
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1 sm:grid sm:grid-cols-7"
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
                "group relative flex min-w-[70px] shrink-0 flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all sm:min-w-0 sm:shrink",
                isSelected
                  ? "border-accent bg-accent-soft text-fg shadow-sm"
                  : "border-border-subtle bg-surface text-muted hover:border-border hover:text-fg",
              )}
            >
              {day.isToday ? (
                <span className="absolute -top-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-contrast">
                  Today
                </span>
              ) : null}

              <span className="text-[10px] font-semibold uppercase tracking-wider text-faint group-hover:text-muted">
                {day.dayShort}
              </span>
              <span
                className={cn(
                  "mt-0.5 font-display text-base font-bold tabular-nums sm:text-lg",
                  isSelected ? "text-accent-strong" : "text-fg",
                )}
              >
                {day.dayNumber}
              </span>

              {/* Release count & watchlist indicator */}
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-[10px] tabular-nums text-faint">
                  {day.entries.length}
                </span>
                {dayWatchingCount > 0 ? (
                  <span
                    title={`${dayWatchingCount} from your library`}
                    className="h-1.5 w-1.5 rounded-full bg-accent-strong"
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and day summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2">
        <div role="tablist" aria-label="Schedule filter" className="flex gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              filterMode === "all"
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:text-fg",
            )}
          >
            All releases
            {activeDay ? (
              <span className="text-[11px] tabular-nums opacity-75">
                ({activeDay.entries.length})
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === "watching"}
            onClick={() => setFilterMode("watching")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
              filterMode === "watching"
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:text-fg",
            )}
          >
            My anime
            <span className="rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] tabular-nums text-accent-strong">
              {totalWatchingInWeek}
            </span>
          </button>
        </div>

        <span className="text-xs text-muted">
          {activeDay?.dayName}, {activeDay?.date}
        </span>
      </div>

      {/* Release Items */}
      {filteredEntries.length === 0 ? (
        <EmptyState
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
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filteredEntries.map((entry) => (
            <HomeScheduleCard
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
    </section>
  );
}

interface HomeScheduleCardProps {
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

function HomeScheduleCard({
  entry,
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

  const airingTimeStr = formatAiringTime(entry.airingAt);
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
          ? "border-accent/40 bg-surface shadow-sm hover:border-accent"
          : "border-border-subtle bg-surface hover:border-border",
      )}
    >
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
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong">
              Ep {entry.episode}
            </span>
            {anime.format ? (
              <span className="text-[10px] uppercase text-muted">
                {formatFormat(anime.format)}
              </span>
            ) : null}
            {inWatching ? (
              <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-accent-strong">
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
            <span className="font-semibold tabular-nums text-fg">
              {airingTimeStr}
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

        {/* Action Button */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {canWrite ? (
            isWatched ? (
              <button
                type="button"
                disabled={isPending || toggling}
                onClick={handleMarkWatched}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-strong transition-colors hover:bg-accent/20"
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
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-accent/30 bg-accent-soft px-2.5 text-[11px] font-semibold text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
              >
                <PlusIcon className="h-3 w-3" />
                <span>{toggling ? "Saving…" : `Mark Ep ${entry.episode} watched`}</span>
              </button>
            ) : (
              <span className="text-[11px] text-faint">
                Airs {airingTimeStr}
              </span>
            )
          ) : (
            <Link
              href={`/anime/${anime.id}`}
              className="inline-flex h-7 items-center gap-1 text-[11px] font-medium text-muted transition-colors hover:text-fg"
            >
              View details →
            </Link>
          )}

          <Link
            href={`/anime/${anime.id}`}
            className="text-[11px] text-faint hover:text-muted"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
