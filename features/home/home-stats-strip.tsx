"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  LibraryIcon,
  ListIcon,
  PlayIcon,
} from "@/components/icons";
import {
  useActiveTimeZone,
  usePreferences,
} from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { calculateStats } from "@/features/stats/calculate-stats";
import { toIsoDateString } from "@/lib/schedule";
import { getDisplayTitle } from "@/lib/utils";
import type { AiringScheduleEntry } from "@/types/anime";

export function HomeStatsStrip({
  todayEntries,
}: {
  todayEntries: AiringScheduleEntry[] | null;
}) {
  const { items, canWrite } = useLibrary();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const stats = calculateStats(items);

  const librarySet = useMemo(
    () => new Set(items.map((i) => i.entry.anilistId)),
    [items],
  );

  const libraryToday = useMemo(() => {
    if (!todayEntries) return [];
    const todayIso = toIsoDateString(new Date(), activeTimeZone);
    return todayEntries
      .filter((entry) => {
        const entryIso = toIsoDateString(
          new Date(entry.airingAt * 1000),
          activeTimeZone,
        );
        return entryIso === todayIso && librarySet.has(entry.mediaId);
      })
      .sort((a, b) => a.airingAt - b.airingAt);
  }, [todayEntries, librarySet, activeTimeZone]);

  if (!canWrite) return null;

  return (
    <section aria-label="Library Overview and Telemetry" className="space-y-3">
      {/* 4 Interactive Executive Telemetry Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {/* Tracked */}
        <Link
          href="/library"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/75 p-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-surface-2/85 hover:shadow-lg"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              In Vault
            </p>
            <p className="font-display text-2xl font-bold tracking-tight text-fg group-hover:text-white tabular-nums">
              {stats.total}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent-strong shadow-xs">
            <LibraryIcon className="h-5 w-5" />
          </span>
        </Link>

        {/* Currently Watching */}
        <Link
          href="/library?status=watching"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/75 p-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-500/30 hover:bg-surface-2/85 hover:shadow-lg"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Watching
            </p>
            <p className="font-display text-2xl font-bold tracking-tight text-fg group-hover:text-white tabular-nums">
              {stats.statusCounts.watching}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-400 shadow-xs">
            <PlayIcon className="h-4 w-4 fill-current" />
          </span>
        </Link>

        {/* Completed */}
        <Link
          href="/library?status=completed"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/75 p-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-surface-2/85 hover:shadow-lg"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Completed
            </p>
            <p className="font-display text-2xl font-bold tracking-tight text-fg group-hover:text-white tabular-nums">
              {stats.statusCounts.completed}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-xs">
            <CheckIcon className="h-5 w-5" />
          </span>
        </Link>

        {/* Total Episodes */}
        <Link
          href="/stats"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/75 p-3.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/30 hover:bg-surface-2/85 hover:shadow-lg"
        >
          <div className="space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Episodes Logged
            </p>
            <p className="font-display text-2xl font-bold tracking-tight text-fg group-hover:text-white tabular-nums">
              {stats.episodesWatched.toLocaleString()}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-xs">
            <ListIcon className="h-5 w-5" />
          </span>
        </Link>
      </div>

      {/* Airing Today Alert Banner (if user has active releases today) */}
      {libraryToday.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft/50 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-contrast">
              <CalendarIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-semibold text-fg truncate">
              <span className="text-accent-strong">
                {libraryToday.length} of your tracked anime air today:
              </span>{" "}
              <span className="text-muted font-normal">
                {libraryToday
                  .map((e) =>
                    getDisplayTitle(
                      e.media.title,
                      preferences.titleLanguage === "english",
                    ),
                  )
                  .join(" · ")}
              </span>
            </p>
          </div>
          <Link
            href="/schedule"
            className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
          >
            <span>View Airing Times</span>
            <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}

