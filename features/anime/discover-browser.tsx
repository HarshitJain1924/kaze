"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AnimeFilters,
  COUNTRY_LABELS,
  SORT_OPTIONS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/components/anime-filters";
import type { AnimeFilterState } from "@/components/anime-filters";
import { AnimeGrid } from "@/components/anime-grid";
import {
  AlertIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  EyeIcon,
  FilmIcon,
  FlameIcon,
  HeartIcon,
  LeafIcon,
  LockIcon,
  PlayIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  SmileIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  SwordsIcon,
  TrophyIcon,
  WandIcon,
  ZapIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PosterGridSkeleton } from "@/components/loading-skeleton";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  DiscoverDeck,
  DiscoverHero,
  DiscoverPills,
  DiscoverResultsBar,
  DiscoverSortSelect,
  DiscoverTypeTabs,
} from "@/features/discover/discover-chrome";
import { useLibrary } from "@/features/library/library-provider";
import { TmdbDiscoverBrowser } from "@/features/screen/tmdb-discover-browser";
import {
  DISCOVER_VIEWS,
  isTmdbDiscoverView,
  type DiscoverView,
} from "@/types/discover";
import type {
  TmdbDiscoverCategory,
  TmdbDiscoverFilters,
  TmdbSearchPage,
} from "@/types/tmdb";
import { fetchCachedJson } from "@/lib/cache/request-cache";
import { ApiRequestError } from "@/lib/http";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import {
  cn,
  formatEpisodeCount,
  formatFormat,
  formatMediaKind,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";
import type { AnimePage, AnimeSort, AnimeSummary } from "@/types/anime";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

interface DiscoveryChannel {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  filters: Partial<AnimeFilterState>;
  animeOnly?: boolean;
}

const DISCOVERY_CHANNELS: DiscoveryChannel[] = [
  { id: "trending", label: "Trending Now", icon: FlameIcon, filters: { sort: "TRENDING_DESC" } },
  { id: "popular", label: "Most Popular", icon: SparklesIcon, filters: { sort: "POPULARITY_DESC" } },
  { id: "top-rated", label: "Top Rated", icon: TrophyIcon, filters: { sort: "SCORE_DESC" } },
  { id: "favourites", label: "Fan Favourites", icon: CrownIcon, filters: { sort: "FAVOURITES_DESC" } },
  { id: "airing", label: "Airing Now", icon: PlayIcon, filters: { status: "RELEASING" } },
  { id: "upcoming", label: "Upcoming", icon: CalendarIcon, filters: { status: "NOT_YET_RELEASED" } },
  { id: "movies", label: "Anime Movies", icon: FilmIcon, filters: { format: "MOVIE" }, animeOnly: true },
  { id: "ova", label: "OVAs & Specials", icon: ZapIcon, filters: { format: "OVA" }, animeOnly: true },
  { id: "light-novels", label: "Light Novels", icon: BookmarkIcon, filters: { source: "LIGHT_NOVEL" } },
  { id: "action", label: "Action", icon: SwordsIcon, filters: { genre: "Action" } },
  { id: "fantasy", label: "Fantasy", icon: WandIcon, filters: { genre: "Fantasy" } },
  { id: "romance", label: "Romance", icon: HeartIcon, filters: { genre: "Romance" } },
  { id: "comedy", label: "Comedy", icon: SmileIcon, filters: { genre: "Comedy" } },
  { id: "scifi", label: "Sci-Fi", icon: RocketIcon, filters: { genre: "Sci-Fi" } },
  { id: "horror", label: "Horror", icon: AlertIcon, filters: { genre: "Horror" } },
  { id: "mecha", label: "Mecha", icon: SettingsIcon, filters: { genre: "Mecha" } },
  { id: "mystery", label: "Mystery", icon: EyeIcon, filters: { genre: "Mystery" } },
  { id: "slice-of-life", label: "Slice of Life", icon: SunIcon, filters: { genre: "Slice of Life" } },
  { id: "adult", label: "18+", icon: LockIcon, filters: { adultContent: "only" } },
];

/** Filter keys a channel can own. Media type and country describe the view
 * itself (manhwa is always KR), so they never decide which pill is current. */
const CHANNEL_FILTER_KEYS = [
  "genre",
  "format",
  "status",
  "season",
  "year",
  "source",
  "adultContent",
  "sort",
] as const;

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
  if (filters.mediaType === "manga") params.set("type", "manga");
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.format) params.set("format", filters.format);
  if (filters.status) params.set("status", filters.status);
  if (filters.season) params.set("season", filters.season);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.source) params.set("source", filters.source);
  if (filters.countryOfOrigin) {
    params.set("country", filters.countryOfOrigin);
  }
  if (filters.adultContent && filters.adultContent !== "filtered") {
    params.set("adult", filters.adultContent);
  }
  if (filters.sort) params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

interface SavedDiscoverState {
  query: string;
  filters: AnimeFilterState;
  search: string;
}

const DISCOVER_STATE_KEY = "kaze.discover.state.v1";

const DISCOVER_VIEW_LABELS: Record<DiscoverView, string> = {
  anime: "Anime",
  manga: "Manga",
  manhwa: "Manhwa",
  movie: "Movies",
  tv: "TV Shows",
};

function readSavedDiscoverState(): SavedDiscoverState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DISCOVER_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedDiscoverState>;
    if (
      typeof parsed.query !== "string" ||
      typeof parsed.search !== "string" ||
      !parsed.filters ||
      typeof parsed.filters.sort !== "string"
    ) {
      return null;
    }
    return {
      query: parsed.query,
      filters: parsed.filters,
      search: parsed.search,
    };
  } catch {
    return null;
  }
}

function DiscoverDetailedCard({ anime }: { anime: AnimeSummary }) {
  const { preferences } = usePreferences();
  const { entryFor, requestAdd } = useLibrary();

  const title = getDisplayTitle(anime.title, preferences.titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const score = formatScore(anime.averageScore);
  const formatLabel = isManga(anime)
    ? formatMediaKind(anime)
    : formatFormat(anime.format);
  const entry = entryFor(anime.id);

  return (
    <article className={cn("group flex flex-col gap-4 border-b border-border py-4 sm:flex-row sm:items-start")}>
      {/* Poster */}
      <Link
        href={`/media/${anime.id}`}
        className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-24"
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
          <span className="absolute left-0 top-0 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
            <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
            {score}
          </span>
        ) : null}
      </Link>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {anime.status ? (
              <span className="inline-flex items-center border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] border-success/30 bg-success/10 text-success">
                {anime.status}
              </span>
            ) : null}
            {formatLabel ? (
              <span className="border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted">
                {formatLabel}
              </span>
            ) : null}
            {anime.seasonYear ? (
              <span className="border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted">
                {anime.seasonYear}
              </span>
            ) : null}
            {anime.episodes ? (
              <span className="border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted">
                {formatEpisodeCount(anime.episodes, { short: true })}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-2 font-display text-[15px] font-semibold leading-snug tracking-[-0.02em] text-fg transition-colors group-hover:text-accent-strong">
            <Link href={`/media/${anime.id}`}>
              {title}
            </Link>
          </h3>

          {/* Genres */}
          {anime.genres && anime.genres.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {anime.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-faint"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
          <Link
            href={`/media/${anime.id}`}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-fg"
          >
            <span>Open details</span>
            <ChevronRightIcon className="h-3 w-3" />
          </Link>

          {entry ? (
            <button
              type="button"
              onClick={() => requestAdd(anime)}
              className="inline-flex h-8 items-center gap-1.5 border border-accent/40 bg-accent/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-strong transition-colors hover:bg-accent/20"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{entry.status}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requestAdd(anime)}
              className="inline-flex h-8 items-center gap-1.5 border border-accent bg-accent px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Add to library</span>
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
  initialView,
  initialTmdbPage,
  initialTmdbCategory,
  initialTmdbQuery,
  initialTmdbFilters,
  initialTmdbError,
  adultAllowed,
}: {
  initialPage: AnimePage | null;
  initialQuery: string;
  initialFilters: AnimeFilterState;
  initialView: DiscoverView;
  initialTmdbPage: TmdbSearchPage | null;
  initialTmdbCategory: TmdbDiscoverCategory;
  initialTmdbQuery: string;
  initialTmdbFilters: TmdbDiscoverFilters;
  initialTmdbError: string | null;
  adultAllowed: boolean;
}) {
  const { preferences } = usePreferences();
  const [activeView, setActiveView] = useState<DiscoverView>(initialView);
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
  const [restoreChecked, setRestoreChecked] = useState(false);

  const isTmdbView = isTmdbDiscoverView(activeView);
  // Only a server-rendered page is worth skipping: when the server could not
  // reach the catalogue the client tries once itself instead of stranding the
  // page on an error the reader has to clear by hand.
  const skipInitialFetch = useRef(initialPage !== null);

  // Returning from a detail page can restore the route from the client cache,
  // so keep a tab-local snapshot and reapply it when the URL has no newer
  // explicit filters.
  useEffect(() => {
    const saved = readSavedDiscoverState();
    const currentSearch = window.location.search;
    // Defer the client-only restore until after hydration.
    const timer = window.setTimeout(() => {
      if (
        saved &&
        (saved.search === currentSearch || currentSearch === "")
      ) {
        setQueryInput(saved.query);
        setQuery(saved.query);
        setFilters(saved.filters);
        skipInitialFetch.current = false;
        setStatus("loading");
      }
      setRestoreChecked(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Debounce typing; clearing the field applies immediately for snappy UX.
  useEffect(() => {
    const trimmed = queryInput.trim();
    if (trimmed === query) {
      return;
    }
    const timer = setTimeout(() => setQuery(trimmed), 350);
    return () => clearTimeout(timer);
  }, [queryInput, query]);

  // Keep the address bar shareable without triggering a server navigation,
  // and persist the snapshot for the detail/back round trip.
  useEffect(() => {
    if (!restoreChecked || isTmdbView) return;
    const search = buildQuery(query, filters, 1);
    const searchString = search ? `?${search}` : "";
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${searchString}`,
    );
    try {
      window.sessionStorage.setItem(
        DISCOVER_STATE_KEY,
        JSON.stringify({ query, filters, search: searchString }),
      );
    } catch {
      // Private browsing or a full storage quota should not break filtering.
    }
  }, [query, filters, restoreChecked, isTmdbView]);

  useEffect(() => {
    if (!restoreChecked || isTmdbView) return;
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    const controller = new AbortController();
    setStatus(page === 1 ? "loading" : "loadingMore");
    setError(null);

    fetchCachedJson<AnimePage>(
      `/api/media/search?${buildQuery(query, filters, page)}`,
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
  }, [query, filters, page, retryNonce, restoreChecked, isTmdbView]);

  const updateFilters = (patch: Partial<AnimeFilterState>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const resetAll = () => {
    setQueryInput("");
    setQuery("");
    setFilters({
      sort: "POPULARITY_DESC",
      mediaType: activeView === "anime" ? "anime" : "manga",
      countryOfOrigin: activeView === "manhwa" ? "KR" : undefined,
    });
    setPage(1);
  };

  const clearQuery = () => {
    setQueryInput("");
    setQuery("");
  };

  const selectView = (next: DiscoverView) => {
    setActiveView(next);
    if (next === "movie" || next === "tv") {
      window.history.replaceState(null, "", `/discover?type=${next}`);
      return;
    }

    setFilters((current) => ({
      ...current,
      mediaType: next === "anime" ? "anime" : "manga",
      countryOfOrigin: next === "manhwa" ? "KR" : undefined,
      season: undefined,
      year: undefined,
      source: undefined,
      format: undefined,
    }));
    setPage(1);
  };

  const applyChannel = (channel: DiscoveryChannel) => {
    updateFilters({
      genre: undefined,
      format: undefined,
      status: undefined,
      season: undefined,
      year: undefined,
      source: undefined,
      countryOfOrigin: undefined,
      adultContent: undefined,
      ...channel.filters,
    });
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
  if (filters.status) {
    activeChips.push({
      key: "status",
      label: `Status: ${STATUS_LABELS[filters.status]}`,
      clear: () => updateFilters({ status: undefined }),
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
  if (filters.source) {
    activeChips.push({
      key: "source",
      label: `Source: ${SOURCE_LABELS[filters.source]}`,
      clear: () => updateFilters({ source: undefined }),
    });
  }
  if (filters.countryOfOrigin) {
    activeChips.push({
      key: "countryOfOrigin",
      label: `Country: ${COUNTRY_LABELS[filters.countryOfOrigin]}`,
      clear: () => updateFilters({ countryOfOrigin: undefined }),
    });
  }
  if (filters.adultContent && filters.adultContent !== "filtered") {
    activeChips.push({
      key: "adultContent",
      label:
        filters.adultContent === "only"
          ? "Adult: 18+ only"
          : "Adult: included",
      clear: () => updateFilters({ adultContent: undefined }),
    });
  }

  const isLoading = status === "loading";
  const isTyping = queryInput.trim() !== query;
  const isEmpty = items.length === 0;

  // Top result for spotlight
  const topAnime = items[0] ?? null;
  const topCover = topAnime ? topAnime.coverImage.extraLarge ?? topAnime.coverImage.large : null;
  const topArtwork = topAnime ? topAnime.bannerImage ?? topCover : null;

  // The season pill is derived from the calendar so it never points at a
  // season that ended months ago.
  const currentSeason = useMemo(() => getCurrentSeason(), []);
  const seasonalChannel: DiscoveryChannel = {
    id: "current-season",
    label: `${seasonLabel(currentSeason.season)} ${currentSeason.year}`,
    icon: LeafIcon,
    filters: { season: currentSeason.season, year: currentSeason.year },
    animeOnly: true,
  };

  const channelList = [...DISCOVERY_CHANNELS, seasonalChannel];

  // Exactly one pill is current: it has to account for every active filter, so
  // a genre pill and a sort pill never both look selected. Ties fall to the
  // first channel, which keeps the default order stable.
  const activeChannelId =
    channelList.find((channel) => {
      const own = channel.filters as unknown as Record<string, unknown>;
      const current = filters as unknown as Record<string, unknown>;
      return CHANNEL_FILTER_KEYS.every((key) =>
        own[key] === undefined
          ? current[key] === undefined
          : current[key] === own[key],
      );
    })?.id ?? null;

  const discoverTypeTabs = (
    <DiscoverTypeTabs
      active={activeView}
      onSelect={(id) => selectView(id as DiscoverView)}
      tabs={DISCOVER_VIEWS.map((view) => ({
        id: view,
        label: DISCOVER_VIEW_LABELS[view],
      }))}
    />
  );

  if (isTmdbView) {
    const tmdbKind: "movie" | "tv" = activeView === "tv" ? "tv" : "movie";
    const useServerPage = activeView === initialView;

    return (
      <div className="space-y-7">
        {discoverTypeTabs}
        <TmdbDiscoverBrowser
          key={tmdbKind}
          kind={tmdbKind}
          initialPage={useServerPage ? initialTmdbPage : null}
          initialCategory={
            useServerPage ? initialTmdbCategory : "trending"
          }
          initialQuery={useServerPage ? initialTmdbQuery : ""}
          initialFilters={useServerPage ? initialTmdbFilters : {}}
          initialError={useServerPage ? initialTmdbError : null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-7 sm:space-y-8">
      {discoverTypeTabs}

      {/* 1. Cinematic Discover Header & Ambient Showcase */}
      <DiscoverHero
        eyebrow="AniList Global Catalogue"
        headlineMeta="10,000+ Series & Films"
        title={`Discover ${activeView === "manhwa" ? "Manhwa" : activeView === "manga" ? "Manga" : "Anime"}`}
        description="Explore seasonal releases, highest rated classics, trending anime, and hidden gems. Filter by genre, format, airing status, source material, country, adult content, or search directly."
        backdropUrl={topArtwork}
        bannerUrl={topAnime?.bannerImage ?? null}
        spotlight={
          topAnime
            ? {
                href: `/media/${topAnime.id}`,
                posterUrl: topCover,
                score: topAnime.averageScore
                  ? formatScore(topAnime.averageScore)
                  : null,
                title: getDisplayTitle(
                  topAnime.title,
                  preferences.titleLanguage === "english",
                ),
                meta: [
                  isManga(topAnime)
                    ? formatMediaKind(topAnime)
                    : formatFormat(topAnime.format),
                  topAnime.seasonYear,
                ]
                  .filter(Boolean)
                  .join(" · "),
                ctaLabel: `View ${
                  isManga(topAnime) ? formatMediaKind(topAnime) : "Anime"
                }`,
              }
            : null
        }
      />

      <DiscoverPills
        pills={channelList.filter(
          (channel) =>
            (adultAllowed || channel.id !== "adult") &&
            (activeView === "anime" || !channel.animeOnly),
        ).map((channel) => ({
          id: channel.id,
          label:
            channel.id === "airing" && activeView !== "anime"
              ? "Publishing"
              : channel.label,
          icon: channel.icon,
          active: channel.id === activeChannelId,
          onSelect: () => applyChannel(channel),
        }))}
      />

      {/* 3. Search & Filter Command Deck */}
      <DiscoverDeck
        searchValue={queryInput}
        onSearchChange={setQueryInput}
        searchAriaLabel={`Search ${activeView} by title`}
        placeholder={`Search ${activeView === "manhwa" ? "manhwa" : activeView === "manga" ? "manga" : "anime"} by title in English or Romaji…`}
        busy={isLoading || isTyping}
        onClearSearch={clearQuery}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        filterCount={activeChips.length}
        showReset={Boolean(queryInput) || activeChips.length > 0}
        onReset={resetAll}
        chips={activeChips}
        onClearAll={resetAll}
      >
        <AnimeFilters
          value={filters}
          onChange={updateFilters}
          onClear={resetAll}
          adultAllowed={adultAllowed}
        />
      </DiscoverDeck>

      {/* 4. Results Bar & View Mode Switcher */}
      <DiscoverResultsBar
        loading={isLoading}
        loadingLabel="Searching AniList…"
        visibleCount={items.length}
        totalCount={pageInfo?.total ?? null}
        sort={
          <DiscoverSortSelect
            value={filters.sort}
            onChange={(value) => updateFilters({ sort: value as AnimeSort })}
            options={SORT_OPTIONS}
          />
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 5. Results Grid or Detailed List */}
      {isLoading ? (
        <PosterGridSkeleton count={12} />
      ) : isEmpty ? (
        status === "error" ? (
          <ErrorState
            title="Catalogue temporarily unavailable"
            message={
              error ??
              `The ${activeView === "manhwa" ? "manhwa" : activeView === "manga" ? "manga" : "anime"} catalogue could not be loaded.`
            }
            onRetry={() => setRetryNonce((value) => value + 1)}
          />
        ) : (
          <EmptyState
            title={`No ${activeView === "manhwa" ? "manhwa" : activeView === "manga" ? "manga" : "anime"} found`}
            description={
              query
                ? `Nothing matched “${query}”. Try a shorter title or remove active filters.`
                : "No titles matched these filters. Try another genre, format, or year."
            }
            action={
              <button
                type="button"
                onClick={resetAll}
                className="h-8 border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg transition-colors hover:border-accent hover:text-accent-strong"
              >
                Clear filters
              </button>
            }
          />
        )
      ) : (
        <>
          {viewMode === "grid" ? (
            <AnimeGrid items={items} priorityCount={6} variant="editorial" />
          ) : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
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
          <div className="flex flex-col items-center gap-3 pt-5">
            {pageInfo?.hasNextPage ? (
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                disabled={status === "loadingMore"}
                className="h-10 min-w-48 border border-border px-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:border-accent hover:text-accent-strong disabled:opacity-50"
              >
                {status === "loadingMore" ? "Loading more…" : "Load more"}
              </button>
            ) : (
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
                {pageInfo?.total != null
                  ? "End of these results"
                  : "No further results"}
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
