"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AnimePosterCard } from "@/components/anime-poster-card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  ChartIcon,
  ChevronRightIcon,
  ClockIcon,
  LibraryIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import {
  LibraryToolbar,
  type LibraryStatusFilter,
} from "@/components/library-toolbar";
import { usePreferences } from "@/components/providers/preferences-provider";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { LibraryItemCard } from "@/features/library/library-item-card";
import { LibraryList } from "@/features/library/library-list";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META } from "@/lib/library-meta";
import { cn, getDisplayTitle, isHttpUrl } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { LibrarySort } from "@/types/library";

export function LibraryBrowser({
  initialStatus,
  suggestions = [],
}: {
  initialStatus: LibraryStatusFilter;
  /** This season's most-watched titles, shown only on a first run. */
  suggestions?: AnimeSummary[];
}) {
  const { items, loadError, pendingIds } = useLibrary();
  const { preferences, setPreference } = usePreferences();

  const [status, setStatus] = useState<LibraryStatusFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");

  const view = preferences.libraryView;

  const statusCounts = useMemo(() => {
    const counts: Record<LibraryStatusFilter, number> = {
      all: items.length,
      watching: 0,
      completed: 0,
      planning: 0,
      on_hold: 0,
      dropped: 0,
    };
    for (const item of items) {
      counts[item.entry.status] += 1;
    }
    return counts;
  }, [items]);

  // Overall library telemetry for the ambient hero
  const libraryTelemetry = useMemo(() => {
    let totalEpisodesLogged = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const item of items) {
      totalEpisodesLogged += item.entry.progress || 0;
      if (typeof item.entry.score === "number" && item.entry.score > 0) {
        scoreSum += item.entry.score;
        scoreCount += 1;
      }
    }

    const avgScore =
      scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : null;

    // Pick high-resolution backdrop from active or top completed anime
    const activeWithBanner = items.find(
      (it) => it.entry.status === "watching" && it.anime?.bannerImage,
    );
    const activeWithCover = items.find(
      (it) =>
        it.entry.status === "watching" && it.anime?.coverImage?.extraLarge,
    );
    const anyBanner = items.find((it) => it.anime?.bannerImage);
    const anyCover = items.find((it) => it.anime?.coverImage?.extraLarge);

    const backdropUrl =
      activeWithBanner?.anime?.bannerImage ??
      activeWithCover?.anime?.coverImage?.extraLarge ??
      anyBanner?.anime?.bannerImage ??
      anyCover?.anime?.coverImage?.extraLarge ??
      null;

    return {
      totalEpisodesLogged,
      avgScore,
      scoreCount,
      backdropUrl,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (status !== "all" && item.entry.status !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      if (!item.anime) {
        return String(item.entry.anilistId).includes(needle);
      }
      const haystack = [
        item.anime.title.english,
        item.anime.title.romaji,
        item.anime.title.native,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "title": {
          const left = a.anime
            ? getDisplayTitle(a.anime.title, true)
            : "Untitled entry";
          const right = b.anime
            ? getDisplayTitle(b.anime.title, true)
            : "Untitled entry";
          return left.localeCompare(right);
        }
        case "score":
          return (b.entry.score ?? -1) - (a.entry.score ?? -1);
        case "progress":
          return b.entry.progress - a.entry.progress;
        case "recent":
        default:
          return (
            new Date(b.entry.updatedAt).getTime() -
            new Date(a.entry.updatedAt).getTime()
          );
      }
    });
  }, [items, query, sort, status]);

  const selectStatus = (next: LibraryStatusFilter) => {
    setStatus(next);
    const url = next === "all" ? "/library" : `/library?status=${next}`;
    window.history.replaceState(null, "", url);
  };

  const meta = status === "all" ? null : WATCH_STATUS_META[status];
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Cinematic Ambient Hero Header */}
      {items.length > 0 ? (
        <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/85 p-6 sm:p-7 md:p-8 backdrop-blur-xl shadow-2xl">
          {/* Ambient high-res backdrop with cinematic dark vignette */}
          {libraryTelemetry.backdropUrl &&
          isHttpUrl(libraryTelemetry.backdropUrl) ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <Image
                src={libraryTelemetry.backdropUrl}
                alt=""
                fill
                priority
                unoptimized
                sizes="100vw"
                className="object-cover object-top opacity-20 blur-md scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/50" />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
            </div>
          ) : (
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          )}

          {/* Header Content */}
          <div className="relative z-10 space-y-5">
            {/* Top row: Badge and Analytics Hub shortcut */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong backdrop-blur-md shadow-xs">
                <span className="h-2 w-2 rounded-full bg-accent radar-live-dot" />
                <span>Personal Archive</span>
                <span className="text-white/30">/</span>
                <span className="text-muted">Anime Vault</span>
              </div>

              <Link
                href="/stats"
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface-2/80 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur-md transition-all hover:border-accent/40 hover:bg-surface-3 hover:text-fg shadow-xs"
              >
                <ChartIcon className="h-3.5 w-3.5 text-accent-strong transition-transform group-hover:scale-110" />
                <span>Stats & Analytics</span>
                <ChevronRightIcon className="h-3 w-3 text-faint group-hover:text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Main title and summary statement */}
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
                My Library
              </h1>
              <p className="mt-1.5 max-w-2xl text-[13px] sm:text-sm text-muted">
                Personal catalog of{" "}
                <span className="font-semibold text-fg">
                  {items.length} {items.length === 1 ? "series" : "series"}
                </span>{" "}
                across your watch history ·{" "}
                <span className="font-semibold text-fg tabular-nums">
                  {libraryTelemetry.totalEpisodesLogged.toLocaleString()}
                </span>{" "}
                episodes recorded.
              </p>
            </div>

            {/* Quick-Telemetry Bento Pods (Clickable Filters) */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4 sm:gap-3">
              {/* Pod 1: Watching */}
              <button
                type="button"
                onClick={() => selectStatus("watching")}
                className={cn(
                  "flex flex-col rounded-2xl border p-3 text-left transition-all duration-150 backdrop-blur-md active:scale-[0.98]",
                  status === "watching"
                    ? "border-purple-500/50 bg-purple-500/15 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
                    : "border-white/[0.06] bg-surface-2/50 hover:border-white/[0.14] hover:bg-surface-2/80",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.8)]" />
                  <span>In Progress</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                    {statusCounts.watching}
                  </span>
                  <span className="text-[11px] text-faint">series</span>
                </div>
              </button>

              {/* Pod 2: Completed */}
              <button
                type="button"
                onClick={() => selectStatus("completed")}
                className={cn(
                  "flex flex-col rounded-2xl border p-3 text-left transition-all duration-150 backdrop-blur-md active:scale-[0.98]",
                  status === "completed"
                    ? "border-emerald-500/50 bg-emerald-500/15 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                    : "border-white/[0.06] bg-surface-2/50 hover:border-white/[0.14] hover:bg-surface-2/80",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>Completed</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                    {statusCounts.completed}
                  </span>
                  <span className="text-[11px] text-faint">finished</span>
                </div>
              </button>

              {/* Pod 3: Plan to Watch */}
              <button
                type="button"
                onClick={() => selectStatus("planning")}
                className={cn(
                  "flex flex-col rounded-2xl border p-3 text-left transition-all duration-150 backdrop-blur-md active:scale-[0.98]",
                  status === "planning"
                    ? "border-sky-500/50 bg-sky-500/15 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                    : "border-white/[0.06] bg-surface-2/50 hover:border-white/[0.14] hover:bg-surface-2/80",
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                  <span>Watchlist</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                    {statusCounts.planning}
                  </span>
                  <span className="text-[11px] text-faint">planned</span>
                </div>
              </button>

              {/* Pod 4: Ratings or Volume Readout */}
              <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-surface-2/50 p-3 backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                  <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>Personal Rating</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-lg font-bold tabular-nums text-fg sm:text-xl">
                    {libraryTelemetry.avgScore
                      ? `${libraryTelemetry.avgScore}`
                      : "—"}
                  </span>
                  <span className="text-[11px] text-faint">
                    {libraryTelemetry.avgScore
                      ? `/ 10 (${libraryTelemetry.scoreCount})`
                      : "Unrated"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            My Library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track anime to build your personal library.
          </p>
        </header>
      )}

      {loadError ? (
        <ErrorState
          title="Your library could not be loaded"
          message="The database did not respond. Nothing has been deleted; try again in a moment."
          action={<RetryButton />}
        />
      ) : null}

      {/* Toolbar with status tabs, search & sort */}
      {items.length > 0 || loadError ? (
        <LibraryToolbar
          status={status}
          onStatusChange={selectStatus}
          statusCounts={statusCounts}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={(next) => setPreference("libraryView", next)}
        />
      ) : null}

      {/* Zero items onboarding state */}
      {items.length === 0 && !loadError ? (
        <div className="space-y-6">
          <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/80 p-6 sm:p-8 backdrop-blur-xl">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                <SparklesIcon className="h-3.5 w-3.5" />
                <span>Getting Started</span>
              </div>
              <h2 className="font-display text-xl font-bold text-fg sm:text-2xl">
                Your anime archive is waiting
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                Add titles you are currently watching, or queue up upcoming
                series for the season. Log episodes with a single tap, score
                completed shows, and track your watch velocity.
              </p>
              <div className="pt-2">
                <LinkButton
                  href="/discover"
                  variant="primary"
                  size="md"
                  className="rounded-xl shadow-lg shadow-accent/20"
                >
                  Explore Discover
                </LinkButton>
              </div>
            </div>
          </section>

          {suggestions.length > 0 ? (
            <section aria-label="Starting suggestions" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-fg">
                  Popular This Season
                </h3>
                <Link
                  href="/discover"
                  className="text-xs font-semibold text-accent-strong hover:underline"
                >
                  View more →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {suggestions.map((anime) => (
                  <AnimePosterCard key={anime.id} anime={anime} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<LibraryIcon className="h-6 w-6 text-faint" />}
          title={
            hasQuery
              ? "No matching titles"
              : meta
                ? meta.emptyTitle
                : "Nothing here yet"
          }
          description={
            hasQuery
              ? `No titles in ${status === "all" ? "your library" : (meta?.label ?? status)} match “${query.trim()}”.`
              : meta
                ? meta.emptyBody
                : "Try another filter."
          }
          action={
            hasQuery ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQuery("")}
                className="rounded-xl"
              >
                Clear search
              </Button>
            ) : status !== "all" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectStatus("all")}
                className="rounded-xl"
              >
                Show all series
              </Button>
            ) : (
              <LinkButton
                href="/discover"
                variant="secondary"
                size="sm"
                className="rounded-xl"
              >
                Find anime in Discover
              </LinkButton>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleItems.map((item) => (
            <LibraryItemCard key={item.entry.id} item={item} />
          ))}
        </div>
      ) : (
        <LibraryList items={visibleItems} />
      )}

      {items.some((item) => !item.anime) ? (
        <p className="rounded-2xl border border-white/[0.08] bg-surface-2/60 p-3.5 text-xs leading-relaxed text-faint">
          Some entries could not be matched with AniList metadata. Their
          progress, ratings and notes are preserved, and they remain removable
          here.
        </p>
      ) : null}

      {pendingIds.size > 0 ? (
        <span className="sr-only" role="status">
          Saving library changes
        </span>
      ) : null}
    </div>
  );
}
