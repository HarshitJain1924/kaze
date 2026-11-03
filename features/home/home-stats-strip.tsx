"use client";

import Link from "next/link";
import { useMemo } from "react";

import { CalendarIcon, ChevronRightIcon } from "@/components/icons";
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
    () => new Set(items.map((item) => item.entry.anilistId)),
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

  const metrics = [
    { label: "In the archive", value: stats.total, href: "/library" },
    {
      label: "In progress",
      value: stats.statusCounts.watching,
      href: "/library?status=watching",
    },
    {
      label: "Completed",
      value: stats.statusCounts.completed,
      href: "/library?status=completed",
    },
    {
      label: "Episodes logged",
      value: stats.episodesWatched,
      href: "/stats",
    },
  ];

  return (
    <section aria-label="Library overview" className="border-y border-border">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {metrics.map((metric, index) => (
          <Link
            key={metric.label}
            href={metric.href}
            className={`group py-4 pr-4 transition-colors hover:bg-surface/40 ${
              index > 0 ? "border-l border-border pl-4 sm:pl-5" : ""
            } ${index >= 2 ? "border-t sm:border-t-0" : ""}`}
          >
            <dt className="text-[9px] font-semibold uppercase tracking-[0.18em] text-faint">
              {metric.label}
            </dt>
            <dd className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.04em] text-fg tabular-nums transition-colors group-hover:text-accent-strong">
              {metric.value.toLocaleString()}
            </dd>
          </Link>
        ))}
      </dl>

      {libraryToday.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-accent-strong" />
            <p className="truncate text-[11px] text-muted">
              <span className="font-medium text-fg">
                {libraryToday.length} tracked{" "}
                {libraryToday.length === 1 ? "title airs" : "titles air"} today
              </span>
              <span className="mx-2 text-border">/</span>
              {libraryToday
                .map((entry) =>
                  getDisplayTitle(
                    entry.media.title,
                    preferences.titleLanguage === "english",
                  ),
                )
                .join(" · ")}
            </p>
          </div>
          <Link
            href="/schedule"
            className="group inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong"
          >
            Broadcast week
            <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
