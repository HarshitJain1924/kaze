"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AnimeFilters, SORT_OPTIONS } from "@/components/anime-filters";
import type { AnimeFilterState } from "@/components/anime-filters";
import { AnimeGrid } from "@/components/anime-grid";
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  FilmIcon,
  FlameIcon,
  GridIcon,
  HeartIcon,
  LeafIcon,
  ListIcon,
  LoaderIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  SlidersIcon,
  SmileIcon,
  SparklesIcon,
  StarIcon,
  SwordsIcon,
  TrophyIcon,
  WandIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PosterGridSkeleton } from "@/components/loading-skeleton";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/features/library/library-provider";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { seasonLabel } from "@/lib/season";
import {
  cn,
  formatEpisodeCount,
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeFormat, AnimePage, AnimeSeason, AnimeSort, AnimeSummary } from "@/types/anime";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

interface DiscoveryChannel {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  filters: Partial<AnimeFilterState>;
}

const DISCOVERY_CHANNELS: DiscoveryChannel[] = [
  { id: "trending", label: "Trending Now", icon: FlameIcon, filters: { sort: "TRENDING_DESC" } },
  { id: "popular", label: "Most Popular", icon: SparklesIcon, filters: { sort: "POPULARITY_DESC" } },
  { id: "top-rated", label: "Top Rated", icon: TrophyIcon, filters: { sort: "SCORE_DESC" } },
  { id: "fall-2026", label: "Fall 2026", icon: LeafIcon, filters: { season: "FALL", year: 2026 } },
  { id: "movies", label: "Anime Movies", icon: FilmIcon, filters: { format: "MOVIE" } },
  { id: "action", label: "Action", icon: SwordsIcon, filters: { genre: "Action" } },
  { id: "fantasy", label: "Fantasy", icon: WandIcon, filters: { genre: "Fantasy" } },
  { id: "romance", label: "Romance", icon: HeartIcon, filters: { genre: "Romance" } },
  { id: "comedy", label: "Comedy", icon: SmileIcon, filters: { genre: "Comedy" } },
  { id: "scifi", label: "Sci-Fi", icon: RocketIcon, filters: { genre: "Sci-Fi" } },
];

function mergeUnique(
  current: AnimeSummary[],
  next: AnimeSummary[],
): AnimeSummary[] {
  const seen = new Set(current.map((anime) => anime.id));
  return [...current, ...next.filter((anime) => !seen.has(anime.id))];
}

function buildQuery(
  query: string,
  filters: AnimeFilterState,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.format) params.set("format", filters.format);
  if (filters.season) params.set("season", filters.season);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.sort) params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

function DiscoverDetailedCard({ anime }: { anime: AnimeSummary }) {
  const { preferences } = usePreferences();
  const { entryFor, requestAdd } = useLibrary();

  const title = getDisplayTitle(anime.title, preferences.titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const score = formatScore(anime.averageScore);
  const formatLabel = formatFormat(anime.format);
  const entry = entryFor(anime.id);

  return (
    <article className="group relative flex flex-col sm:flex-row gap-4 p-3.5 sm:p-4 rounded-2xl border border-white/10 bg-surface-2 hover:border-white/20 hover:bg-surface-3 transition-all duration-200 shadow-sm">
      {/* Poster */}
      <Link
        href={`/anime/${anime.id}`}
        className="relative aspect-[2/3] w-24 sm:w-28 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-surface-3 shadow-md"
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            unoptimized
            sizes="120px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-surface-3" />
        )}

        {score ? (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
            <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            {score}
          </span>
        ) : null}
      </Link>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {anime.status ? (
              <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold border-success/30 bg-success/15 text-success">
                {anime.status}
              </span>
            ) : null}
            {formatLabel ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/80">
                {formatLabel}
              </span>
            ) : null}
            {anime.seasonYear ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/80">
                {anime.seasonYear}
              </span>
            ) : null}
            {anime.episodes ? (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/80">
                {formatEpisodeCount(anime.episodes, { short: true })}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 font-display text-base sm:text-lg font-bold text-white transition-colors group-hover:text-accent-strong line-clamp-1">
            <Link href={`/anime/${anime.id}`}>
              {title}
            </Link>
          </h3>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {anime.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <Link
            href={`/anime/${anime.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
          >
            <span>View Anime Details</span>
            <ChevronRightIcon className="h-3 w-3" />
          </Link>

          {entry ? (
            <button
              type="button"
              onClick={() => requestAdd(anime)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/20 px-3 text-xs font-semibold text-accent-strong hover:bg-accent/30 transition-colors"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{entry.status}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requestAdd(anime)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-contrast hover:bg-accent-hover transition-colors shadow-xs"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Add to Watchlist</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function DiscoverBrowser({
  initialPage,
  initialQuery,
  initialFilters,
}: {
  initialPage: AnimePage | null;
  initialQuery: string;
  initialFilters: AnimeFilterState;
}) {
  const { preferences } = usePreferences();
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<AnimeFilterState>(initialFilters);
  const [items, setItems] = useState<AnimeSummary[]>(initialPage?.items ?? []);
  const [pageInfo, setPageInfo] = useState(initialPage?.pageInfo ?? null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LoadStatus>(
    initialPage ? "idle" : "error",
  );
  const [error, setError] = useState<string | null>(
    initialPage
      ? null
      : "The anime catalogue is temporarily unavailable. Your library and progress are unaffected.",
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const skipInitialFetch = useRef(true);

  // Debounce typing; clearing the field applies immediately for snappy UX.
  useEffect(() => {
    const trimmed = queryInput.trim();
    if (trimmed === query) {
      return;
    }
    const timer = setTimeout(() => setQuery(trimmed), 350);
    return () => clearTimeout(timer);
  }, [queryInput, query]);

  // Keep the address bar shareable without triggering a server navigation.
  useEffect(() => {
    const search = buildQuery(query, filters, 1);
    const url = search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [query, filters]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    const controller = new AbortController();
    setStatus(page === 1 ? "loading" : "loadingMore");
    setError(null);

    apiFetch<AnimePage>(
      `/api/anime/search?${buildQuery(query, filters, page)}`,
      { signal: controller.signal },
    )
      .then((data) => {
        setItems((current) =>
          page === 1 ? data.items : mergeUnique(current, data.items),
        );
        setPageInfo(data.pageInfo);
        setStatus("idle");
      })
      .catch((requestError: unknown) => {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : "Could not load anime right now.",
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [query, filters, page, retryNonce]);

  const updateFilters = (patch: Partial<AnimeFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const resetAll = () => {
    setQueryInput("");
    setQuery("");
    setFilters({ sort: "POPULARITY_DESC" });
    setPage(1);
  };

  const clearQuery = () => {
    setQueryInput("");
    setQuery("");
  };

  const applyChannel = (channel: DiscoveryChannel) => {
    updateFilters({
      genre: undefined,
      format: undefined,
      season: undefined,
      year: undefined,
      ...channel.filters,
    });
  };

  const isChannelActive = (channel: DiscoveryChannel) => {
    const { genre, format, season, year, sort } = channel.filters;
    if (genre && filters.genre !== genre) return false;
    if (format && filters.format !== format) return false;
    if (season && filters.season !== season) return false;
    if (year && filters.year !== year) return false;
    if (sort && filters.sort !== sort) return false;
    return true;
  };

  const activeChips: Array<{
    key: string;
    label: string;
    clear: () => void;
  }> = [];
  if (filters.genre) {
    activeChips.push({
      key: "genre",
      label: `Genre: ${filters.genre}`,
      clear: () => updateFilters({ genre: undefined }),
    });
  }
  if (filters.format) {
    activeChips.push({
      key: "format",
      label: `Format: ${formatFormat(filters.format) ?? filters.format}`,
      clear: () => updateFilters({ format: undefined }),
    });
  }
  if (filters.season) {
    activeChips.push({
      key: "season",
      label: `Season: ${seasonLabel(filters.season)}`,
      clear: () => updateFilters({ season: undefined }),
    });
  }
  if (filters.year) {
    activeChips.push({
      key: "year",
      label: `Year: ${filters.year}`,
      clear: () => updateFilters({ year: undefined }),
    });
  }

  const isLoading = status === "loading";
  const isTyping = queryInput.trim() !== query;
  const isEmpty = items.length === 0;

  // Top result for spotlight
  const topAnime = items[0] ?? null;
  const topCover = topAnime ? topAnime.coverImage.extraLarge ?? topAnime.coverImage.large : null;
  const topArtwork = topAnime ? topAnime.bannerImage ?? topCover : null;

  return (
    <div className="space-y-6">
      {/* 1. Cinematic Discover Header & Ambient Showcase */}
      <header className="group relative isolate overflow-hidden rounded-3xl border border-white/15 bg-black/80 shadow-2xl transition-all">
        {topAnime && topArtwork && isHttpUrl(topArtwork) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none overflow-hidden z-0"
          >
            <div className="absolute inset-0 scale-125 blur-3xl saturate-200 opacity-25">
              <Image
                src={topArtwork}
                alt=""
                fill
                unoptimized
                sizes="100vw"
                className="object-cover"
              />
            </div>
            {topAnime.bannerImage && isHttpUrl(topAnime.bannerImage) ? (
              <div className="absolute inset-0">
                <Image
                  src={topAnime.bannerImage}
                  alt=""
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-cover object-[center_25%] opacity-30"
                />
              </div>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 via-50% to-surface/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          </div>
        ) : null}

        <div className="relative z-10 flex flex-col justify-between gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-strong">
                AniList Global Catalogue
              </span>
              <span className="text-white/30">·</span>
              <span className="text-xs font-medium text-white/70">
                10,000+ Series & Films
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl drop-shadow-sm">
              Discover Anime
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-white/75 sm:text-sm">
              Explore seasonal releases, highest rated classics, trending anime, and hidden gems. Filter by genre, format, year, or search directly.
            </p>
          </div>

          {/* Featured Spotlight Card from Top Result */}
          {topAnime ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-md shadow-xl lg:max-w-sm">
              <Link
                href={`/anime/${topAnime.id}`}
                className="group/spot relative aspect-[2/3] w-16 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-md"
              >
                {topCover && isHttpUrl(topCover) ? (
                  <Image
                    src={topCover}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover transition-transform duration-300 group-hover/spot:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-3" />
                )}
                {topAnime.averageScore ? (
                  <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                    <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span>{formatScore(topAnime.averageScore)}</span>
                  </span>
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                  Top Result
                </span>
                <Link
                  href={`/anime/${topAnime.id}`}
                  className="mt-0.5 line-clamp-1 block font-display text-sm font-bold text-white hover:text-accent-strong transition-colors"
                  title={getDisplayTitle(topAnime.title, preferences.titleLanguage === "english")}
                >
                  {getDisplayTitle(topAnime.title, preferences.titleLanguage === "english")}
                </Link>
                <p className="mt-0.5 text-[11px] text-white/60">
                  {formatFormat(topAnime.format)} {topAnime.seasonYear ? `· ${topAnime.seasonYear}` : ""} {topAnime.episodes ? `· ${topAnime.episodes} eps` : ""}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={`/anime/${topAnime.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-accent-contrast shadow-sm hover:bg-accent-hover transition-colors"
                  >
                    <span>View Anime</span>
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* 2. Quick Discovery Tag Pills (1-Tap Channels) */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:px-0">
        {DISCOVERY_CHANNELS.map((channel) => {
          const isActive = isChannelActive(channel);
          const IconComponent = channel.icon;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => applyChannel(channel)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 shadow-xs",
                isActive
                  ? "border-accent bg-accent text-accent-contrast shadow-md scale-102"
                  : "border-white/10 bg-surface-2 text-white/80 hover:border-white/25 hover:bg-surface-3 hover:text-white",
              )}
            >
              <IconComponent
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  isActive ? "text-accent-contrast" : "text-accent-strong",
                )}
              />
              <span>{channel.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Command Deck */}
      <div className="space-y-3.5 rounded-2xl border border-white/10 bg-surface-2/80 p-3 sm:p-4 shadow-lg backdrop-blur-md">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              role="searchbox"
              aria-label="Search anime by title"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search anime by title in English or Romaji…"
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-white/15 bg-black/40 pl-10 pr-20 text-sm text-white placeholder-white/40 transition-colors focus:border-accent focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {isLoading || isTyping ? (
                <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
              ) : null}
              {queryInput ? (
                <button
                  type="button"
                  onClick={clearQuery}
                  aria-label="Clear search"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 text-[10px] font-mono text-white/40">
                  Ctrl K
                </kbd>
              )}
            </div>
          </div>

          {/* Filter Toggle Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold transition-all active:scale-95 shadow-sm",
                showFilters || activeChips.length > 0
                  ? "border-accent bg-accent/20 text-accent-strong"
                  : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <SlidersIcon className="h-4 w-4" />
              <span>Filters</span>
              {activeChips.length > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-contrast">
                  {activeChips.length}
                </span>
              ) : null}
            </button>

            {queryInput || activeChips.length > 0 ? (
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        {/* Collapsible Filter Dropdowns */}
        {showFilters ? (
          <div className="pt-2 border-t border-white/10">
            <AnimeFilters
              value={filters}
              onChange={updateFilters}
              onClear={resetAll}
            />
          </div>
        ) : null}

        {/* Active Filter Chips */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-white/50 mr-1">
              Active filters:
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-accent-strong transition-all hover:bg-accent/25 active:scale-95"
              >
                <span>{chip.label}</span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/40 text-accent-contrast">
                  <CloseIcon className="h-2 w-2" />
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetAll}
              className="ml-1 text-[11px] font-medium text-white/50 underline-offset-2 hover:text-white hover:underline transition-colors"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* 4. Results Bar & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <p aria-live="polite" className="text-xs font-semibold text-white/80">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-accent-strong">
                <span className="h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
                Searching AniList…
              </span>
            ) : pageInfo?.total != null ? (
              <span>
                Showing <span className="font-bold text-white">{items.length}</span> of{" "}
                <span className="font-bold text-white">{pageInfo.total.toLocaleString("en-US")}</span> results
              </span>
            ) : (
              <span>{items.length} results</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            <span className="hidden sm:inline text-white/50">Sort by:</span>
            <select
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value as AnimeSort })}
              className="h-8 rounded-lg border border-white/15 bg-surface-2 px-2.5 text-xs font-semibold text-white focus:border-accent focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Grid vs Detailed List */}
          <div className="inline-flex items-center rounded-lg border border-white/15 bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Poster grid view"
              title="Poster grid view"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                viewMode === "grid"
                  ? "bg-accent text-accent-contrast shadow-xs font-bold"
                  : "text-white/60 hover:text-white",
              )}
            >
              <GridIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="Detailed list view"
              title="Detailed list view"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-all",
                viewMode === "list"
                  ? "bg-accent text-accent-contrast shadow-xs font-bold"
                  : "text-white/60 hover:text-white",
              )}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Results Grid or Detailed List */}
      {isLoading ? (
        <PosterGridSkeleton count={12} />
      ) : isEmpty ? (
        status === "error" ? (
          <ErrorState
            title="Catalogue temporarily unavailable"
            message={error ?? "The anime catalogue could not be loaded."}
            onRetry={() => setRetryNonce((value) => value + 1)}
          />
        ) : (
          <EmptyState
            title="No anime found"
            description={
              query
                ? `Nothing matched “${query}”. Try a shorter title or remove active filters.`
                : "No titles matched these filters. Try another genre, format, or year."
            }
            action={
              <Button variant="secondary" size="sm" onClick={resetAll}>
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <>
          {viewMode === "grid" ? (
            <AnimeGrid items={items} priorityCount={6} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((anime) => (
                <DiscoverDetailedCard key={anime.id} anime={anime} />
              ))}
            </div>
          )}

          {status === "error" ? (
            <ErrorState
              title="Could not load more"
              message={error ?? "The next page failed to load."}
              onRetry={() => setRetryNonce((value) => value + 1)}
            />
          ) : null}

          {/* Pagination / Load more */}
          <div className="flex flex-col items-center gap-3 pt-4">
            {pageInfo?.hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => setPage((value) => value + 1)}
                disabled={status === "loadingMore"}
                className="min-w-44 h-10 font-bold"
              >
                {status === "loadingMore" ? "Loading more titles…" : "Load more anime"}
              </Button>
            ) : (
              <p className="text-xs text-white/50">
                {pageInfo?.total != null
                  ? "You have reached the end of these results."
                  : "No further results."}
              </p>
            )}
            {isTyping ? (
              <button
                type="button"
                onClick={clearQuery}
                className="text-xs text-accent-strong underline-offset-2 hover:underline"
              >
                Apply pending search text
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
