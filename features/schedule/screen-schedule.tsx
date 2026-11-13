"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  StarIcon,
} from "@/components/icons";
import { useActiveTimeZone } from "@/components/providers/preferences-provider";
import { toIsoDateString, type ScreenScheduleDay, type WeekRange } from "@/lib/schedule";
import { useMinuteClock } from "@/lib/use-now";
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

const NAV_BTN_CLASS =
  "inline-flex h-7 items-center gap-1 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg";

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
  const { activeTimeZone } = useActiveTimeZone();
  const clockMs = useMinuteClock();

  // TMDB rows are already dated, but "today" still belongs to the viewer's own
  // calendar day, so the marker settles on their timezone after hydration.
  const todayIso = useMemo(() => {
    if (clockMs === null) {
      return days.find((day) => day.isToday)?.date ?? days[0]?.date ?? "";
    }
    return toIsoDateString(new Date(clockMs), activeTimeZone);
  }, [activeTimeZone, clockMs, days]);

  const initialSelection =
    initialDate && days.some((day) => day.date === initialDate)
      ? initialDate
      : null;
  const [pickedDate, setPickedDate] = useState<string | null>(
    initialSelection,
  );
  const selectedDate =
    pickedDate ?? (todayIso || (days[0]?.date ?? ""));

  const activeDay =
    days.find((day) => day.date === selectedDate) ?? days[0] ?? null;
  const isMovie = kind === "movie";
  const labels = isMovie
    ? {
        eyebrow: "TMDB Release Calendar · Cinema",
        title: "Movie Releases",
        plural: "releases",
        emptyTitle: "No film releases on this day",
        emptyBody: "TMDB has no film releases dated for this day.",
      }
    : {
        eyebrow: "TMDB Airing Calendar · Television",
        title: "TV Airings",
        plural: "airings",
        emptyTitle: "No series airing on this day",
        emptyBody: "TMDB has no series with an episode dated for this day.",
      };

  const base = `/schedule?type=${kind}`;
  const thisWeekDate =
    todayIso || (days[0]?.date ?? week.days[0]?.date ?? "");

  const totalEntries = days.reduce(
    (acc, day) => acc + (day.entries?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* Editorial Masthead */}
      <header className="border-b border-border pb-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              {labels.eyebrow}
            </span>
            <span className="text-faint">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {week.weekLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`${base}&date=${week.prevWeekDate}`}
              aria-label="Previous week"
              className={NAV_BTN_CLASS}
            >
              <ChevronLeftIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Prev</span>
            </Link>
            <Link
              href={`${base}&date=${thisWeekDate}`}
              className="inline-flex h-7 items-center border border-accent bg-accent/15 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              This week
            </Link>
            <Link
              href={`${base}&date=${week.nextWeekDate}`}
              aria-label="Next week"
              className={NAV_BTN_CLASS}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-fg">
            {labels.title}
          </h1>
          <p className="mt-3 max-w-[34rem] text-[13px] leading-relaxed text-muted">
            Tracking{" "}
            <span className="font-mono font-medium text-fg tabular-nums">
              {totalEntries} {labels.plural}
            </span>{" "}
            for the week of {week.weekLabel} · release dates published via TMDB.
          </p>
        </div>
      </header>

      {/* 7-Day Ruled Segmented Broadcast Dock */}
      <div
        role="group"
        aria-label="Filter by day of week"
        className="no-scrollbar flex gap-1.5 overflow-x-auto border-y border-border py-2.5 sm:grid sm:grid-cols-7 sm:gap-2"
      >
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${day.dayName} ${day.dayNumber}, ${day.entries.length} ${labels.plural}`}
              onClick={() => setPickedDate(day.date)}
              className={cn(
                "group relative flex min-w-[76px] shrink-0 flex-col items-center justify-center border p-2 text-center transition-colors select-none sm:min-w-0 sm:shrink",
                isSelected
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface/40 hover:border-accent/40 hover:bg-surface",
              )}
            >
              {day.date === todayIso ? (
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

              <span
                className={cn(
                  "mt-1 font-mono text-xl font-bold tabular-nums transition-colors",
                  isSelected ? "text-accent-strong" : "text-fg",
                )}
              >
                {day.dayNumber}
              </span>

              <span
                className={cn(
                  "mt-1 font-mono text-[10px] tabular-nums",
                  isSelected ? "text-accent-strong" : "text-faint",
                )}
              >
                {day.entries.length} {labels.plural.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Day Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-fg sm:text-base">
            {activeDay ? dayHeading(activeDay.date) : ""}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-faint">
            {activeDay?.entries.length ?? 0}{" "}
            {(activeDay?.entries.length ?? 0) === 1
              ? labels.plural.slice(0, -1)
              : labels.plural}
          </span>
        </div>

        {activeDay && activeDay.entries.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="group flex gap-3 border border-border bg-surface/60 p-3 transition-colors hover:border-accent/40 hover:bg-surface"
                  >
                    <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-16">
                      {poster ? (
                        <Image
                          src={poster}
                          alt=""
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <FilmIcon className="h-5 w-5 text-faint/60" />
                        </span>
                      )}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <span className="line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong">
                          {entry.title}
                        </span>
                        <div className="mt-1 flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                          <span>{entry.year ?? "Year unknown"}</span>
                          {rating ? (
                            <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold text-amber-400 tabular-nums">
                              · <StarIcon className="h-2.5 w-2.5 fill-current" />
                              {rating}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <span className="mt-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong group-hover:underline">
                        View details &rarr;
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6 text-faint" />}
            title={labels.emptyTitle}
            description={labels.emptyBody}
          />
        )}
      </div>
    </div>
  );
}
