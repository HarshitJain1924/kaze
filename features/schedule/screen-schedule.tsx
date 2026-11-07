"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  StarIcon,
} from "@/components/icons";
import type { ScreenScheduleDay, WeekRange } from "@/lib/schedule";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbKind } from "@/types/tmdb";

function dayHeading(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

const NAV_CLASS =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-3 text-xs font-semibold text-fg transition-colors hover:border-border hover:bg-surface-3";

export function ScreenScheduleBrowser({
  kind,
  week,
  days,
  initialDate,
}: {
  kind: TmdbKind;
  week: WeekRange;
  days: ScreenScheduleDay[];
  initialDate?: string;
}) {
  const fallbackDate =
    days.find((day) => day.isToday)?.date ?? days[0]?.date ?? "";
  const [selectedDate, setSelectedDate] = useState(() =>
    initialDate && days.some((day) => day.date === initialDate)
      ? initialDate
      : fallbackDate,
  );

  const activeDay = days.find((day) => day.date === selectedDate) ?? days[0] ?? null;
  const isMovie = kind === "movie";
  const labels = isMovie
    ? {
        eyebrow: "TMDB release calendar",
        title: "Movie releases",
        plural: "releases",
        emptyTitle: "No film releases on this day",
        emptyBody: "TMDB has no film release dated this day.",
      }
    : {
        eyebrow: "TMDB airing calendar",
        title: "TV airings",
        plural: "airings",
        emptyTitle: "No series airing on this day",
        emptyBody: "TMDB has no series with an episode dated this day.",
      };

  const base = `/schedule?type=${kind}`;
  const thisWeekDate =
    days.find((day) => day.isToday)?.date ??
    days[0]?.date ??
    week.days[0]?.date ??
    "";

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface/70 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-strong">
            {labels.eyebrow}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold text-fg sm:text-2xl">
            {labels.title}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {week.weekLabel} · dates only, TMDB publishes no broadcast times
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href={`${base}&date=${week.prevWeekDate}`}
            aria-label="Previous week"
            className={NAV_CLASS}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Link>
          <Link href={`${base}&date=${thisWeekDate}`} className={NAV_CLASS}>
            This week
          </Link>
          <Link
            href={`${base}&date=${week.nextWeekDate}`}
            aria-label="Next week"
            className={NAV_CLASS}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="rounded-2xl border border-border-subtle bg-surface/70 p-2 backdrop-blur-md shadow-xs">
        <div
          role="group"
          aria-label="Filter by day of week"
          className="no-scrollbar flex gap-2 overflow-x-auto sm:grid sm:grid-cols-7"
        >
          {days.map((day) => {
            const isSelected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${day.dayName} ${day.dayNumber}, ${day.entries.length} ${labels.plural}`}
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  "group relative flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all duration-150 ease-out select-none sm:min-w-0 sm:shrink active:scale-[0.98]",
                  isSelected
                    ? "border-accent/60 bg-accent-soft shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                    : "border-transparent bg-transparent hover:bg-surface-2",
                )}
              >
                {day.isToday ? (
                  <span className="rounded-md border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-strong">
                    Today
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[11px] font-semibold transition-colors",
                      isSelected ? "text-fg" : "text-muted group-hover:text-fg",
                    )}
                  >
                    {day.dayShort}
                  </span>
                )}

                <span
                  className={cn(
                    "mt-1 font-display text-xl font-bold tabular-nums transition-colors",
                    isSelected ? "text-accent-strong" : "text-fg",
                  )}
                >
                  {day.dayNumber}
                </span>

                <span
                  className={cn(
                    "mt-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    isSelected
                      ? "bg-accent/30 text-accent-strong"
                      : "bg-surface-3 text-muted",
                  )}
                >
                  {day.entries.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-fg sm:text-lg">
            {activeDay ? dayHeading(activeDay.date) : ""}
          </h2>
          <span className="rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums text-muted">
            {activeDay?.entries.length ?? 0}{" "}
            {(activeDay?.entries.length ?? 0) === 1
              ? labels.plural.slice(0, -1)
              : labels.plural}
          </span>
        </div>

        {activeDay && activeDay.entries.length > 0 ? (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {activeDay.entries.map((entry) => {
              const poster =
                entry.posterUrl && isHttpUrl(entry.posterUrl)
                  ? entry.posterUrl
                  : null;
              const rating =
                entry.voteAverage && entry.voteAverage > 0
                  ? entry.voteAverage.toFixed(1)
                  : null;

              return (
                <li key={`${entry.date}-${entry.tmdbId}`}>
                  <Link
                    href={`/screen/${entry.kind}/${entry.tmdbId}`}
                    className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-2 p-2.5 transition-all duration-200 hover:border-border hover:bg-surface-3"
                  >
                    <span className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-3">
                      {poster ? (
                        <Image
                          src={poster}
                          alt=""
                          fill
                          unoptimized
                          sizes="44px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <FilmIcon className="h-4 w-4 text-faint/60" />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 block text-xs font-semibold text-fg transition-colors group-hover:text-accent-strong sm:text-[13px]">
                        {entry.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className="text-faint">
                          {entry.year ?? "Year unknown"}
                        </span>
                        {rating ? (
                          <span className="flex items-center gap-0.5 font-medium text-warning">
                            <StarIcon className="h-3 w-3 fill-warning text-warning" />
                            {rating}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarIcon className="h-7 w-7 text-faint" />}
            title={labels.emptyTitle}
            description={labels.emptyBody}
          />
        )}
      </div>
    </div>
  );
}
