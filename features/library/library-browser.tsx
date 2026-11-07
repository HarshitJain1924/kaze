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
import { OpticalGlass } from "@/components/ui/optical-glass";
import { LibraryItemCard } from "@/features/library/library-item-card";
import {
  LibraryList,
  type UnifiedLibraryItem,
} from "@/features/library/library-list";
import { useLibrary } from "@/features/library/library-provider";
import { ScreenLibraryCard } from "@/features/screen/screen-library";
import { WATCH_STATUS_META } from "@/lib/library-meta";
import { cn, formatScore, getDisplayTitle } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { LibrarySort } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

export type LibraryMediaFilter =
  | "all"
  | "anime"
  | "manga"
  | "manhwa"
  | "movie"
  | "tv";

const MEDIA_FILTER_TABS: { id: LibraryMediaFilter; label: string }[] = [
  { id: "all", label: "All media" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
  { id: "manhwa", label: "Manhwa" },
  { id: "movie", label: "Movie" },
  { id: "tv", label: "TV Show" },
];

export function LibraryBrowser({
  initialStatus,
  suggestions = [],
  screenItems = [],
}: {
  initialStatus: LibraryStatusFilter;
  /** This season's most-watched titles, shown only on a first run. */
  suggestions?: AnimeSummary[];
  /** Tracked films and TV series from TMDB. */
  screenItems?: TmdbLibraryItem[];
}) {
  const { items, loadError, pendingIds, showAdult } = useLibrary();
  const { preferences, setPreference } = usePreferences();

  const [status, setStatus] = useState<LibraryStatusFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [mediaFilter, setMediaFilter] = useState<LibraryMediaFilter>("all");

  const view = preferences.libraryView;
  const preferEnglish = preferences.titleLanguage === "english";

  // Combine AniList items and TMDB screen items into a unified collection
  const allItems: UnifiedLibraryItem[] = useMemo(() => {
    const anilistList: UnifiedLibraryItem[] = items.map((it) => ({
      kind: "anilist",
      item: it,
    }));
    const screenList: UnifiedLibraryItem[] = screenItems.map((it) => ({
      kind: "screen",
      item: it,
    }));
    return [...anilistList, ...screenList];
  }, [items, screenItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<LibraryStatusFilter, number> = {
      all: allItems.length,
      watching: 0,
      completed: 0,
      planning: 0,
      on_hold: 0,
      dropped: 0,
    };
    for (const unified of allItems) {
      const s =
        unified.kind === "anilist"
          ? unified.item.entry.status
          : unified.item.entry.status;
      if (s in counts) {
        counts[s] += 1;
      }
    }
    return counts;
  }, [allItems]);

  // Overall library telemetry & spotlight candidate
  const libraryTelemetry = useMemo(() => {
    let totalEpisodesLogged = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const unified of allItems) {
      if (unified.kind === "anilist") {
        totalEpisodesLogged += unified.item.entry.progress || 0;
        if (
          typeof unified.item.entry.score === "number" &&
          unified.item.entry.score > 0
        ) {
          scoreSum += unified.item.entry.score;
          scoreCount += 1;
        }
      } else {
        const isMovie = unified.item.entry.mediaType === "movie";
        totalEpisodesLogged += isMovie
          ? unified.item.entry.watched
            ? 1
            : 0
          : unified.item.watchedCount;
        if (
          typeof unified.item.entry.score === "number" &&
          unified.item.entry.score > 0
        ) {
          scoreSum += unified.item.entry.score;
          scoreCount += 1;
        }
      }
    }

    const avgScore =
      scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : null;

    // Pick top active in-progress or recently updated item for spotlight
    const activeAniList =
      items.find(
        (it) => it.entry.status === "watching" && it.anime?.bannerImage,
      ) ??
      items.find(
        (it) =>
          it.entry.status === "watching" && it.anime?.coverImage?.extraLarge,
      ) ??
      items.find((it) => it.anime?.bannerImage) ??
      items[0] ??
      null;

    const spotlightBackdrop =
      activeAniList?.anime?.bannerImage ??
      activeAniList?.anime?.coverImage?.extraLarge ??
      null;

    return {
      totalEpisodesLogged,
      avgScore,
      scoreCount,
      activeAniList,
      spotlightBackdrop,
    };
  }, [allItems, items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = allItems.filter((unified) => {
      const entryStatus =
        unified.kind === "anilist"
          ? unified.item.entry.status
          : unified.item.entry.status;

      if (status !== "all" && entryStatus !== status) {
        return false;
      }

      // Adult content filtering for AniList items
      if (
        !showAdult &&
        unified.kind === "anilist" &&
        unified.item.anime?.isAdult
      ) {
        return false;
      }

      // Media category filtering — strictly separate:
      // anime: AniList anime only
      // manga: AniList manga only (excluding Korean origin)
      // manhwa: AniList manga with Korean origin only
      // movie: TMDB movies only (never mixed with anime movies)
      // tv: TMDB TV series only (never mixed with anime TV series)
      if (mediaFilter === "anime") {
        if (unified.kind !== "anilist") return false;
        if ((unified.item.entry.mediaType ?? "anime") !== "anime") return false;
      } else if (mediaFilter === "manga") {
        if (unified.kind !== "anilist") return false;
        if (unified.item.entry.mediaType !== "manga") return false;
        if (unified.item.anime?.countryOfOrigin === "KR") return false;
      } else if (mediaFilter === "manhwa") {
        if (unified.kind !== "anilist") return false;
        if (
          unified.item.entry.mediaType !== "manga" ||
          unified.item.anime?.countryOfOrigin !== "KR"
        ) {
          return false;
        }
      } else if (mediaFilter === "movie") {
        // TMDB Movies only — do NOT mix anime movies here
        if (unified.kind !== "screen") return false;
        if (unified.item.entry.mediaType !== "movie") return false;
      } else if (mediaFilter === "tv") {
        // TMDB TV Shows only — do NOT mix anime series here
        if (unified.kind !== "screen") return false;
        if (unified.item.entry.mediaType !== "tv") return false;
      }

      if (!needle) {
        return true;
      }

      // Search query filtering
      if (unified.kind === "anilist") {
        if (!unified.item.anime) {
          return String(unified.item.entry.anilistId).includes(needle);
        }
        const haystack = [
          unified.item.anime.title.english,
          unified.item.anime.title.romaji,
          unified.item.anime.title.native,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      } else {
        const haystack = [
          unified.item.entry.title,
          unified.item.entry.originalTitle,
          unified.item.entry.overview,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      }
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "title": {
          const left =
            a.kind === "anilist"
              ? a.item.anime
                ? getDisplayTitle(a.item.anime.title, true)
                : "Untitled entry"
              : a.item.entry.title;
          const right =
            b.kind === "anilist"
              ? b.item.anime
                ? getDisplayTitle(b.item.anime.title, true)
                : "Untitled entry"
              : b.item.entry.title;
          return left.localeCompare(right);
        }
        case "score": {
          const scoreA =
            a.kind === "anilist"
              ? (a.item.entry.score ?? -1)
              : (a.item.entry.score ?? -1);
          const scoreB =
            b.kind === "anilist"
              ? (b.item.entry.score ?? -1)
              : (b.item.entry.score ?? -1);
          return scoreB - scoreA;
        }
        case "progress": {
          const progA =
            a.kind === "anilist"
              ? a.item.entry.progress
              : a.item.entry.mediaType === "movie"
                ? a.item.entry.watched
                  ? 1
                  : 0
                : a.item.watchedCount;
          const progB =
            b.kind === "anilist"
              ? b.item.entry.progress
              : b.item.entry.mediaType === "movie"
                ? b.item.entry.watched
                  ? 1
                  : 0
                : b.item.watchedCount;
          return progB - progA;
        }
        case "recent":
        default: {
          const dateA =
            a.kind === "anilist"
              ? new Date(a.item.entry.updatedAt).getTime()
              : new Date(a.item.entry.updatedAt).getTime();
          const dateB =
            b.kind === "anilist"
              ? new Date(b.item.entry.updatedAt).getTime()
              : new Date(b.item.entry.updatedAt).getTime();
          return dateB - dateA;
        }
      }
    });
  }, [allItems, mediaFilter, query, showAdult, sort, status]);

  const selectStatus = (next: LibraryStatusFilter) => {
    setStatus(next);
    const url = next === "all" ? "/library" : `/library?status=${next}`;
    window.history.replaceState(null, "", url);
  };

  const meta = status === "all" ? null : WATCH_STATUS_META[status];
  const hasQuery = query.trim().length > 0;
  const spotlightAnime = libraryTelemetry.activeAniList?.anime;
  const spotlightTitle = spotlightAnime
    ? getDisplayTitle(spotlightAnime.title, preferEnglish)
    : null;

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* Editorial Brutalist Masthead */}
      {allItems.length > 0 ? (
        <header className="border-b border-border pb-7">
          {/* Top Eyebrow Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Personal Archive · Library Index
            </span>
            <Link
              href="/stats"
              className="inline-flex h-7 items-center gap-1.5 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent hover:text-fg"
            >
              <ChartIcon className="h-3 w-3 text-accent-strong" />
              <span>Stats &amp; Analytics</span>
              <ChevronRightIcon className="h-2.5 w-2.5 text-faint" />
            </Link>
          </div>

          {/* Main Title & Spotlight Deck */}
          <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-fg">
                My Library
              </h1>
              <p className="mt-3 max-w-[34rem] text-[13px] leading-relaxed text-muted">
                Personal archive of{" "}
                <span className="font-mono font-medium text-fg">
                  {allItems.length}
                </span>{" "}
                {allItems.length === 1 ? "title" : "titles"} across anime, manga, manhwa, movies, and TV shows ·{" "}
                <span className="font-mono font-medium text-fg tabular-nums">
                  {libraryTelemetry.totalEpisodesLogged.toLocaleString()}
                </span>{" "}
                units recorded.
              </p>
            </div>

            {/* Spotlight Frame: Current Top Series */}
            {spotlightAnime && libraryTelemetry.spotlightBackdrop ? (
              <div className="relative aspect-[16/10] overflow-hidden border border-border bg-surface-2">
                <Image
                  src={libraryTelemetry.spotlightBackdrop}
                  alt=""
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 380px"
                  className="object-cover object-top opacity-55 transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

                {spotlightAnime.averageScore ? (
                  <OpticalGlass
                    variant="pill"
                    interactive={false}
                    className="absolute right-2.5 top-2.5 flex items-center gap-1 px-2 py-1 text-[9px] font-semibold tabular-nums text-white/90"
                  >
                    <StarIcon className="h-2.5 w-2.5 fill-current text-amber-300" />
                    <span>{formatScore(spotlightAnime.averageScore)}</span>
                  </OpticalGlass>
                ) : null}

                <OpticalGlass
                  variant="card"
                  className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-2.5 p-2 sm:gap-3 sm:p-2.5"
                >
                  <Link
                    href={`/media/${spotlightAnime.id}`}
                    className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-white/20 sm:w-11"
                  >
                    {spotlightAnime.coverImage?.extraLarge ||
                    spotlightAnime.coverImage?.large ? (
                      <Image
                        src={
                          spotlightAnime.coverImage.extraLarge ??
                          spotlightAnime.coverImage.large ??
                          ""
                        }
                        alt=""
                        fill
                        unoptimized
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-white/10" />
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                      {libraryTelemetry.activeAniList?.entry.status === "watching"
                        ? "Active Series"
                        : "Library Anchor"}
                    </p>
                    <Link
                      href={`/media/${spotlightAnime.id}`}
                      className="mt-0.5 block truncate font-display text-[13px] font-medium leading-tight text-white transition-colors hover:text-accent-strong"
                      title={spotlightTitle ?? ""}
                    >
                      {spotlightTitle}
                    </Link>
                    <p className="mt-0.5 truncate text-[10px] text-white/65">
                      {libraryTelemetry.activeAniList?.entry.progress} logged
                      {spotlightAnime.episodes
                        ? ` / ${spotlightAnime.episodes} eps`
                        : ""}
                    </p>
                  </div>

                  <Link
                    href={`/media/${spotlightAnime.id}`}
                    aria-label={`Open ${spotlightTitle}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/25 text-white/85 transition-colors hover:border-accent hover:text-accent-strong"
                  >
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </OpticalGlass>
              </div>
            ) : null}
          </div>

          {/* Quick-Telemetry Ledger Pods (Clickable Filters) */}
          <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:grid-cols-4 sm:gap-3">
            {/* Pod 1: Watching */}
            <button
              type="button"
              onClick={() => selectStatus("watching")}
              className={cn(
                "flex flex-col border p-3 text-left transition-colors",
                status === "watching"
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface/40 hover:border-accent/40 hover:bg-surface",
              )}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
                In Progress
              </span>
              <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
                {statusCounts.watching}
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
                active series
              </span>
            </button>

            {/* Pod 2: Completed */}
            <button
              type="button"
              onClick={() => selectStatus("completed")}
              className={cn(
                "flex flex-col border p-3 text-left transition-colors",
                status === "completed"
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface/40 hover:border-accent/40 hover:bg-surface",
              )}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-success">
                Completed
              </span>
              <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
                {statusCounts.completed}
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
                finished titles
              </span>
            </button>

            {/* Pod 3: Planning */}
            <button
              type="button"
              onClick={() => selectStatus("planning")}
              className={cn(
                "flex flex-col border p-3 text-left transition-colors",
                status === "planning"
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface/40 hover:border-accent/40 hover:bg-surface",
              )}
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-400">
                Watchlist
              </span>
              <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
                {statusCounts.planning}
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
                planned titles
              </span>
            </button>

            {/* Pod 4: Rating Readout */}
            <div className="flex flex-col border border-border bg-surface/40 p-3">
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-400">
                <StarIcon className="h-2.5 w-2.5 fill-current text-amber-400" />
                Personal Rating
              </span>
              <span className="mt-1 font-mono text-xl font-bold tabular-nums text-fg">
                {libraryTelemetry.avgScore ? libraryTelemetry.avgScore : "—"}
              </span>
              <span className="text-[10px] uppercase tracking-[0.08em] text-faint">
                {libraryTelemetry.avgScore
                  ? `/ 10 (${libraryTelemetry.scoreCount} scored)`
                  : "Unrated"}
              </span>
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b border-border pb-5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Personal Archive · Library Index
          </span>
          <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-none tracking-[-0.04em] text-fg">
            My Library
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            Track anime, manga, manhwa, movies, and TV shows in one private archive.
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

      {/* Media Type Segmented Tabs: Anime, Manga, Manhwa, Movie, TV Show */}
      {allItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Filter library by media type"
            className="no-scrollbar flex overflow-x-auto border border-border bg-surface/40 p-0.5"
          >
            {MEDIA_FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mediaFilter === tab.id}
                onClick={() => setMediaFilter(tab.id)}
                className={cn(
                  "h-8 shrink-0 border-r border-border last:border-r-0 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  mediaFilter === tab.id
                    ? "bg-accent text-accent-contrast"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="hidden font-mono text-[11px] text-faint sm:inline-block">
            {visibleItems.length} of {allItems.length} titles
          </span>
        </div>
      ) : null}

      {/* Ruled Toolbar: Status Strip, Search, Sort & Grid/List View Toggle */}
      {allItems.length > 0 || loadError ? (
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
      {allItems.length === 0 && !loadError ? (
        <div className="space-y-6">
          <section className="border border-border bg-surface/40 p-6 sm:p-8">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                <SparklesIcon className="h-3 w-3" />
                <span>Getting Started</span>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
                Your media archive is waiting
              </h2>
              <p className="text-[13px] leading-relaxed text-muted">
                Add anime, manga, movies, or TV series you are tracking, log progress
                with a single tap, score completed titles, and keep private notes
                across your whole collection.
              </p>
              <div className="pt-2">
                <Link
                  href="/discover"
                  className="inline-flex h-8 items-center border border-accent bg-accent px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-contrast transition-colors hover:bg-accent-strong"
                >
                  Explore Discover
                </Link>
              </div>
            </div>
          </section>

          {suggestions.length > 0 ? (
            <section aria-label="Starting suggestions" className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-fg">
                  Popular This Season
                </h3>
                <Link
                  href="/discover"
                  className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-strong hover:underline"
                >
                  View more &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                {suggestions.map((anime) => (
                  <AnimePosterCard
                    key={anime.id}
                    anime={anime}
                    variant="editorial"
                  />
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
              : mediaFilter === "movie"
                ? "No movies yet"
                : mediaFilter === "tv"
                  ? "No TV shows yet"
                  : mediaFilter === "manga"
                    ? "No manga yet"
                    : mediaFilter === "manhwa"
                      ? "No manhwa yet"
                      : meta
                        ? meta.emptyTitle
                        : "Nothing here yet"
          }
          description={
            hasQuery
              ? `No titles in ${status === "all" ? "your library" : (meta?.label ?? status)} match “${query.trim()}”.`
              : mediaFilter === "movie"
                ? "Search cinema and films in Discover to track them in your library."
                : mediaFilter === "tv"
                  ? "Search television series in Discover to track them in your library."
                  : mediaFilter === "manga"
                    ? "Search manga in Discover to track your reading progress."
                    : mediaFilter === "manhwa"
                      ? "Search manhwa in Discover to track your reading progress."
                      : meta
                        ? meta.emptyBody
                        : "Try another filter."
          }
          action={
            hasQuery ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Clear search
              </button>
            ) : status !== "all" ? (
              <button
                type="button"
                onClick={() => selectStatus("all")}
                className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Show all titles
              </button>
            ) : mediaFilter === "movie" ? (
              <Link
                href="/discover?view=movie"
                className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Find movies in Discover
              </Link>
            ) : mediaFilter === "tv" ? (
              <Link
                href="/discover?view=tv"
                className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Find TV shows in Discover
              </Link>
            ) : (
              <Link
                href="/discover"
                className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Find titles in Discover
              </Link>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleItems.map((unified) =>
            unified.kind === "anilist" ? (
              <LibraryItemCard
                key={`anilist:${unified.item.entry.id}`}
                item={unified.item}
              />
            ) : (
              <ScreenLibraryCard
                key={`screen:${unified.item.entry.id}`}
                item={unified.item}
              />
            ),
          )}
        </div>
      ) : (
        <LibraryList items={visibleItems} />
      )}

      {items.some((item) => !item.anime) ? (
        <p className="border border-border bg-surface/40 p-3 text-xs leading-relaxed text-faint">
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
