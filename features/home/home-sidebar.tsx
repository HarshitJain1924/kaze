"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { calculateStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import { formatAiringTime, toIsoDateString } from "@/lib/schedule";
import { cn, formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
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
  featuredAnime,
  compact = false,
}: HomeSidebarProps) {
  const { items, canWrite } = useLibrary();
  const { preferences } = usePreferences();
  const stats = calculateStats(items);

  const isScheduleError = todayEntries === null;

  // Set of anime IDs in the user's library
  const librarySet = useMemo(() => {
    return new Set(items.map((i) => i.entry.anilistId));
  }, [items]);

  // Only the viewer's own titles: the main column already lists every release
  // airing today, so repeating them here would waste the rail.
  const libraryToday = useMemo(() => {
    if (!todayEntries) return [];
    const todayIso = toIsoDateString(new Date());
    return todayEntries
      .filter((entry) => {
        const entryIso = toIsoDateString(new Date(entry.airingAt * 1000));
        return entryIso === todayIso && librarySet.has(entry.mediaId);
      })
      .sort((a, b) => a.airingAt - b.airingAt)
      .slice(0, 5);
  }, [todayEntries, librarySet]);

  // Genuine recent library activity sorted by real updatedAt timestamp
  const recentActivity = useMemo(() => {
    return [...items]
      .filter((it) => it.anime !== null)
      .sort(
        (a, b) =>
          new Date(b.entry.updatedAt).getTime() -
          new Date(a.entry.updatedAt).getTime(),
      )
      .slice(0, 3);
  }, [items]);

  return (
    <aside className="space-y-5 lg:sticky lg:top-6" aria-label="Dashboard sidebar">
      {/* 1. Quick Stats */}
      {canWrite ? (
        <section
          aria-label="Quick statistics"
          className="rounded-xl border border-border-subtle bg-surface p-4"
        >
          <div className="flex items-center justify-between pb-3">
            <h2 className="text-[13px] font-semibold text-fg">Your library</h2>
            <Link
              href="/stats"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Full stats</span>
              <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border-subtle">
            <div className="bg-surface p-2.5">
              <p className="text-[11px] text-faint">Tracked</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-fg">
                {stats.total}
              </p>
            </div>
            <div className="bg-surface p-2.5">
              <p className="text-[11px] text-faint">Watching</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-fg">
                {stats.statusCounts.watching}
              </p>
            </div>
            <div className="bg-surface p-2.5">
              <p className="text-[11px] text-faint">Completed</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-fg">
                {stats.statusCounts.completed}
              </p>
            </div>
            <div className="bg-surface p-2.5">
              <p className="text-[11px] text-faint">Episodes</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-fg">
                {stats.episodesWatched}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* 2. Today from the viewer's own list. The main column already shows
             every release, so this rail only repeats what is theirs. */}
      {!compact && canWrite ? (
        <section
          aria-label="Today from your library"
          className="rounded-xl border border-border-subtle bg-surface p-4"
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted" />
              <h2 className="text-[13px] font-semibold text-fg">
                From your library today
              </h2>
            </div>
            <Link
              href="/schedule"
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-fg"
            >
              <span>Week</span>
              <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {isScheduleError ? (
            <p className="py-2 text-xs text-muted">
              Could not load today&apos;s releases.
            </p>
          ) : libraryToday.length === 0 ? (
            <p className="py-1 text-xs leading-relaxed text-muted">
              {items.length === 0
                ? "Add titles to see their airing episodes here."
                : "None of your titles air today."}
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

                return (
                  <Link
                    key={entry.id}
                    href={`/anime/${entry.mediaId}`}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-2/40 p-2 transition-colors hover:bg-surface-2/80",
                    )}
                  >
                    <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3">
                      {cover && isHttpUrl(cover) ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-accent-strong">
                          Episode {entry.episode}
                        </span>
                        <span className="text-[11px] tabular-nums text-muted">
                          {formatAiringTime(entry.airingAt)}
                        </span>
                      </div>
                      <p
                        className="line-clamp-1 text-[13px] font-medium text-fg"
                        title={title}
                      >
                        {title}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* 3. Recent Activity */}
      {recentActivity.length > 0 ? (
        <section
          aria-label="Recent activity"
          className="rounded-xl border border-border-subtle bg-surface p-4"
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-muted" />
              <h2 className="text-[13px] font-semibold text-fg">
                Recently updated
              </h2>
            </div>
            <Link
              href="/library"
              className="text-xs font-medium text-muted hover:text-accent-strong"
            >
              Library
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
                  className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-2/30 p-2 transition-all hover:border-border hover:bg-surface-2/60"
                >
                  <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3">
                    {cover && isHttpUrl(cover) ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-1 text-[13px] font-medium text-fg group-hover:text-accent-strong"
                      title={title}
                    >
                      {title}
                    </p>
                    <div className="mt-0.5 flex items-center justify-between gap-1 text-[11px] text-muted">
                      <span>
                        {entry.status === "completed"
                          ? "Completed"
                          : `Episode ${entry.progress}`}
                      </span>
                      <span className="text-faint">
                        {formatRelativeTime(entry.updatedAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. Decorative / Seasonal Spotlight Panel (desktop only) */}
      {!compact && featuredAnime ? (
        <section
          aria-label="Seasonal spotlight"
          className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface"
        >
          {(() => {
            const cover =
              featuredAnime.coverImage.extraLarge ??
              featuredAnime.coverImage.large;
            return (
              <div className="relative flex items-center gap-3 p-3.5">
                <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm">
                  {cover && isHttpUrl(cover) ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-surface-3" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium text-accent-strong">
                    This season&apos;s standout
                  </span>
                  <Link
                    href={`/anime/${featuredAnime.id}`}
                    className="mt-0.5 block font-display text-[13px] font-semibold text-fg transition-colors hover:text-accent-strong line-clamp-1"
                    title={getDisplayTitle(
                      featuredAnime.title,
                      preferences.titleLanguage === "english",
                    )}
                  >
                    {getDisplayTitle(
                      featuredAnime.title,
                      preferences.titleLanguage === "english",
                    )}
                  </Link>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    {featuredAnime.format ? (
                      <span className="uppercase">
                        {formatFormat(featuredAnime.format)}
                      </span>
                    ) : null}
                    {featuredAnime.genres.length > 0 ? (
                      <>
                        <span className="text-faint">·</span>
                        <span className="line-clamp-1">
                          {featuredAnime.genres.slice(0, 2).join(", ")}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <Link
                    href={`/anime/${featuredAnime.id}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
                  >
                    <span>View details</span>
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}
    </aside>
  );
}
