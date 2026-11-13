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
import { useMinuteClock } from "@/lib/use-now";
import { getDisplayTitle } from "@/lib/utils";
import type { AiringScheduleEntry } from "@/types/anime";

export function HomeStatsStrip({
  todayEntries,
  todayLabel,
  seasonLabelText,
}: {
  todayEntries: AiringScheduleEntry[] | null;
  todayLabel: string;
  seasonLabelText: string;
}) {
  const { items, canWrite } = useLibrary();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const clockMs = useMinuteClock();
  const stats = calculateStats(items);

  // The server renders its own calendar day; once the client takes over, the
  // header date follows the viewer's active timezone instead.
  const headerLabel = useMemo(() => {
    if (clockMs === null) return todayLabel;
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: activeTimeZone,
    }).format(new Date(clockMs));
  }, [activeTimeZone, clockMs, todayLabel]);

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

  const nickname = preferences.nickname?.trim();

  return (
    <header className="border-b border-border pb-3.5 sm:pb-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Personal archive · {headerLabel}
          </p>
          <h1 className="mt-2 text-balance font-display text-[32px] font-semibold leading-[1.02] tracking-[-0.045em] text-fg sm:text-[42px]">
            {canWrite ? (
              <>
                Your archive
                {nickname ? (
                  <span className="text-muted">, {nickname}</span>
                ) : null}
                .
              </>
            ) : (
              "A place for everything you watch and read."
            )}
          </h1>
          <p className="mt-3 max-w-xl text-[12px] leading-relaxed text-muted sm:text-[13px]">
            {canWrite
              ? `${seasonLabelText} is in motion. Pick up where you left off, then look beyond your shelf.`
              : "Sign in to keep your progress, reading list and weekly broadcasts together in one place."}
          </p>
        </div>

        {canWrite ? (
          <dl className="flex flex-wrap items-end gap-x-7 gap-y-3 lg:justify-end">
            {[
              { label: "Titles", value: stats.total, href: "/library" },
              {
                label: "In progress",
                value: stats.statusCounts.watching,
                href: "/library?status=watching",
              },
              {
                label: "Episodes",
                value: stats.episodesWatched,
                href: "/stats",
              },
            ].map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className="group min-w-16 border-l border-border pl-3 first:border-l-0 first:pl-0"
              >
                <dt className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">
                  {metric.label}
                </dt>
                <dd className="mt-1 font-display text-2xl font-semibold leading-none tracking-[-0.03em] text-fg tabular-nums transition-colors group-hover:text-accent-strong">
                  {metric.value.toLocaleString()}
                </dd>
              </Link>
            ))}
          </dl>
        ) : (
          <Link
            href="/login?next=%2Fdashboard"
            className="inline-flex h-10 w-fit items-center gap-2 bg-accent px-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            Open your archive
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {canWrite && libraryToday.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-accent-strong" />
          <p className="text-[11px] text-muted">
            <span className="font-medium text-fg">
              {libraryToday.length} tracked{" "}
              {libraryToday.length === 1 ? "title airs" : "titles air"} today
            </span>
            <span className="mx-1.5 text-border">/</span>
            {libraryToday
              .map((entry) =>
                getDisplayTitle(
                  entry.media.title,
                  preferences.titleLanguage === "english",
                ),
              )
              .join(" · ")}
          </p>
          <Link
            href="/schedule"
            className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong hover:underline"
          >
            Broadcast week
          </Link>
        </div>
      ) : null}
    </header>
  );
}
