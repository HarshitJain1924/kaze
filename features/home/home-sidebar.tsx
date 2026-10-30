"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  LibraryIcon,
  ListIcon,
  PlayIcon,
} from "@/components/icons";
import { useActiveTimeZone, usePreferences } from "@/components/providers/preferences-provider";
import { calculateStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatAiringRelative,
  formatAiringTime,
  getTimeZoneAbbr,
  toIsoDateString,
} from "@/lib/schedule";
import { cn, getDisplayTitle, isHttpUrl } from "@/lib/utils";
import type { AiringScheduleEntry, AnimeSummary } from "@/types/anime";

interface HomeSidebarProps {
  todayEntries: AiringScheduleEntry[] | null;
  featuredAnime?: AnimeSummary | null;
  compact?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const timestamp = new Date(dateString).getTime();
  if (isNaN(timestamp)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.round(diffSec / 86400)}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

export function HomeSidebar({
  todayEntries,
  compact = false,
}: HomeSidebarProps) {
  const { items, canWrite } = useLibrary();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();
  const stats = calculateStats(items);

  const isScheduleError = todayEntries === null;

  // Set of anime IDs in the user's library
  const librarySet = useMemo(() => {
    return new Set(items.map((i) => i.entry.anilistId));
  }, [items]);

  // Only the viewer's own titles that air today in user's timezone
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
      .sort((a, b) => a.airingAt - b.airingAt)
      .slice(0, 5);
  }, [todayEntries, librarySet, activeTimeZone]);

  // Genuine recent library activity sorted by real updatedAt timestamp
  const recentActivity = useMemo(() => {
    return [...items]
      .filter((it) => it.anime !== null)
      .sort(
        (a, b) =>
          new Date(b.entry.updatedAt).getTime() -
          new Date(a.entry.updatedAt).getTime(),
      )
      .slice(0, 4);
  }, [items]);

  if (!canWrite && compact) {
    return null;
  }

  return (
    <aside
      className="space-y-4 lg:sticky lg:top-6"
      aria-label="Dashboard sidebar"
    >
      {/* 1. Your library (2x2 Stats Grid or Sign in prompt) */}
      <section
        aria-label="Your library statistics"
        className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm"
      >
        <div className="flex items-center justify-between pb-3">
          <h2 className="font-display text-sm font-bold text-fg">
            Your library
          </h2>
          {canWrite ? (
            <Link
              href="/stats"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Full stats</span>
              <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </div>

        {canWrite ? (
          <div className="grid grid-cols-2 gap-2">
            {/* Tracked */}
            <Link
              href="/library"
              className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 transition-colors hover:border-border hover:bg-surface-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong shadow-xs">
                  <LibraryIcon className="h-4 w-4" />
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-fg">
                  {stats.total}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted">Tracked</p>
            </Link>

            {/* Watching */}
            <Link
              href="/library?status=watching"
              className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 transition-colors hover:border-border hover:bg-surface-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent-strong shadow-xs">
                  <PlayIcon className="h-3.5 w-3.5 fill-current" />
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-fg">
                  {stats.statusCounts.watching}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted">Watching</p>
            </Link>

            {/* Completed */}
            <Link
              href="/library?status=completed"
              className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 transition-colors hover:border-border hover:bg-surface-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success shadow-xs">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-fg">
                  {stats.statusCounts.completed}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted">Completed</p>
            </Link>

            {/* Episodes */}
            <Link
              href="/stats"
              className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-2 p-3 transition-colors hover:border-border hover:bg-surface-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15 text-warning shadow-xs">
                  <ListIcon className="h-4 w-4" />
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-fg">
                  {stats.episodesWatched}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted">Episodes</p>
            </Link>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted leading-relaxed">
              Sign in to track what you watch, record episodes and view your library statistics.
            </p>
            <Link
              href="/login"
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-accent text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              Sign in to track
            </Link>
          </div>
        )}
      </section>

      {/* 2. From your library today */}
      {canWrite ? (
        <section
          aria-label="Today from your library"
          className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm"
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-accent-strong" />
              <h2 className="font-display text-sm font-bold text-fg">
                From your library today
              </h2>
            </div>
            <Link
              href="/schedule"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Week</span>
              <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {isScheduleError ? (
            <p className="py-2 text-xs text-muted">
              Could not load today&apos;s schedule.
            </p>
          ) : libraryToday.length === 0 ? (
            <p className="py-2 text-xs leading-relaxed text-muted">
              {items.length === 0
                ? "Add titles to see their airing episodes here."
                : "None of your tracked anime air today."}
            </p>
          ) : (
            <div className="space-y-2">
              {libraryToday.map((entry) => {
                const title = getDisplayTitle(
                  entry.media.title,
                  preferences.titleLanguage === "english",
                );
                const cover =
                  entry.media.coverImage.extraLarge ??
                  entry.media.coverImage.large;
                const relative = formatAiringRelative(entry.airingAt);

                return (
                  <Link
                    key={entry.id}
                    href={`/anime/${entry.mediaId}`}
                    className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-2 p-2 transition-all hover:border-accent/40 hover:bg-surface-3"
                  >
                    <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3 shadow-xs">
                      {cover && isHttpUrl(cover) ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-surface-3" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-accent-strong">
                          Episode {entry.episode}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            relative.hasAired ? "text-faint" : "text-accent-strong",
                          )}
                        >
                          · {relative.label}
                        </span>
                      </div>
                      <p
                        className="line-clamp-1 text-[13px] font-medium text-fg group-hover:text-accent-strong transition-colors"
                        title={title}
                      >
                        {title}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        suppressHydrationWarning
                        className="text-[11px] font-medium tabular-nums text-muted inline-flex items-baseline gap-1"
                      >
                        <span>{formatAiringTime(entry.airingAt, activeTimeZone)}</span>
                        <span className="text-[10px] text-faint">
                          {getTimeZoneAbbr(entry.airingAt, activeTimeZone)}
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* 3. Recently updated */}
      {recentActivity.length > 0 ? (
        <section
          aria-label="Recently updated"
          className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm"
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 text-muted" />
              <h2 className="font-display text-sm font-bold text-fg">
                Recently updated
              </h2>
            </div>
            <Link
              href="/library"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Library</span>
              <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {recentActivity.map(({ entry, anime }) => {
              if (!anime) return null;
              const title = getDisplayTitle(
                anime.title,
                preferences.titleLanguage === "english",
              );
              const cover =
                anime.coverImage.extraLarge ?? anime.coverImage.large;

              return (
                <Link
                  key={entry.id}
                  href={`/anime/${anime.id}`}
                  className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-2 p-2 transition-all hover:border-accent/40 hover:bg-surface-3"
                >
                  <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3 shadow-xs">
                    {cover && isHttpUrl(cover) ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        unoptimized
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-surface-3" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-1 text-[13px] font-medium text-fg group-hover:text-accent-strong transition-colors"
                      title={title}
                    >
                      {title}
                    </p>
                    <p className="text-[11px] text-muted">
                      {entry.status === "completed"
                        ? "Completed"
                        : `Episode ${entry.progress}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[11px] font-medium tabular-nums text-faint">
                      {formatRelativeTime(entry.updatedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
