"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  CalendarIcon,
  ChevronRightIcon,
  FlameIcon,
  PlayIcon,
  SlidersIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from "@/components/icons";
import { PosterGridSkeleton } from "@/components/loading-skeleton";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { fetchCachedJson } from "@/lib/cache/request-cache";
import { ApiRequestError } from "@/lib/http";
import { cn, isHttpUrl } from "@/lib/utils";
import {
  DiscoverDeck,
  DiscoverHero,
  DiscoverPills,
  DiscoverResultsBar,
  DiscoverSortSelect,
  type DiscoverChip,
} from "@/features/discover/discover-chrome";
import { kindLabel, ScreenPoster } from "@/features/screen/screen-poster";
import {
  TMDB_ADULT_FILTERS,
  TMDB_RATING_FILTERS,
  tmdbDiscoverCategoriesForKind,
  tmdbGenresForKind,
  tmdbSortsForKind,
  type TmdbDiscoverCategory,
  type TmdbDiscoverFilters,
  type TmdbDiscoverSort,
  type TmdbKind,
  type TmdbSearchPage,
  type TmdbSearchResult,
} from "@/types/tmdb";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR + 1 - 1950 + 1 },
  (_, index) => CURRENT_YEAR + 1 - index,
);

const CATEGORY_META: Record<
  TmdbDiscoverCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  trending: { label: "Trending", icon: FlameIcon },
  popular: { label: "Popular", icon: SparklesIcon },
  top_rated: { label: "Top Rated", icon: TrophyIcon },
  upcoming: { label: "Upcoming", icon: CalendarIcon },
  on_the_air: { label: "Currently Airing", icon: PlayIcon },
};

function mergeUnique(
  current: TmdbSearchResult[],
  next: TmdbSearchResult[],
): TmdbSearchResult[] {
  const seen = new Set(current.map((item) => item.tmdbId));
  return [...current, ...next.filter((item) => !seen.has(item.tmdbId))];
}

function requestPath(
  kind: TmdbKind,
  category: TmdbDiscoverCategory,
  query: string,
  page: number,
  filters: TmdbDiscoverFilters,
): string {
  if (query.length >= 2) {
    const params = new URLSearchParams({
      kind,
      q: query,
      page: String(page),
    });
    if (filters.adult) params.set("adult", filters.adult);
    return `/api/tmdb/search?${params.toString()}`;
  }
  const params = new URLSearchParams({
    kind,
    category,
    page: String(page),
  });
  if (filters.genres?.length) params.set("genre", filters.genres.join(","));
  if (filters.adult) params.set("adult", filters.adult);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.minRating !== undefined) {
    params.set("rating", String(filters.minRating));
  }
  if (filters.sort) params.set("sort", filters.sort);
  return `/api/tmdb/discover?${params.toString()}`;
}

function countTmdbFilters(filters: TmdbDiscoverFilters): number {
  return [
    filters.genres?.length ? true : undefined,
    filters.year,
    filters.minRating !== undefined ? true : undefined,
    filters.sort,
    filters.adult ? true : undefined,
  ].filter((value) => value !== undefined).length;
}

function TmdbDiscoverListCard({ item }: { item: TmdbSearchResult }) {
  const poster =
    item.posterUrl && isHttpUrl(item.posterUrl) ? item.posterUrl : null;

  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-2 p-3.5 shadow-sm transition-all duration-200 hover:border-border hover:bg-surface-3 sm:flex-row sm:p-4">
      <Link
        href={`/screen/${item.kind}/${item.tmdbId}`}
        className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-surface-3 shadow-md sm:w-28"
      >
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            unoptimized
            sizes="120px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-surface-3" />
        )}
        {item.voteAverage && item.voteAverage > 0 ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
            <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            {item.voteAverage.toFixed(1)}
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="rounded-lg border border-border-subtle bg-surface-3/60 px-2 py-0.5 text-[10px] font-medium text-muted">
              {kindLabel(item.kind)}
            </span>
            {item.year ? (
              <span className="rounded-lg border border-border-subtle bg-surface-3/60 px-2 py-0.5 text-[10px] font-medium text-muted">
                {item.year}
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 line-clamp-1 font-display text-base font-bold text-fg transition-colors group-hover:text-accent-strong sm:text-lg">
            <Link href={`/screen/${item.kind}/${item.tmdbId}`}>
              {item.title}
            </Link>
          </h3>

          {item.overview ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
              {item.overview}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
          <Link
            href={`/screen/${item.kind}/${item.tmdbId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:underline"
          >
            <span>View {kindLabel(item.kind)} Details</span>
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
          {item.voteCount ? (
            <span className="text-[10px] tabular-nums text-faint">
              {item.voteCount.toLocaleString("en-US")} votes
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TmdbFilterFields({
  kind,
  filters,
  onChange,
  idPrefix,
  adultAllowed = false,
}: {
  kind: TmdbKind;
  filters: TmdbDiscoverFilters;
  onChange: (patch: Partial<TmdbDiscoverFilters>) => void;
  idPrefix: string;
  adultAllowed?: boolean;
}) {
  const genreOptions = tmdbGenresForKind(kind);
  const sortOptions = tmdbSortsForKind(kind);
  const selectedGenres = filters.genres ?? [];

  const toggleGenre = (value: string) => {
    const next = selectedGenres.includes(value)
      ? selectedGenres.filter((genre) => genre !== value)
      : [...selectedGenres, value];
    onChange({ genres: next.length > 0 ? next : undefined });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            Genre
            {selectedGenres.length > 0
              ? ` · any of ${selectedGenres.length}`
              : " · pick any number"}
          </span>
          {selectedGenres.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange({ genres: undefined })}
              className="text-[11px] font-medium text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Clear genres
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {genreOptions.map((option) => {
            const active = selectedGenres.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleGenre(option.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all active:scale-95",
                  active
                    ? "border-accent bg-accent text-accent-contrast shadow-sm"
                    : "border-border-subtle bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-year`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Year
        </label>
        <Select
          id={`${idPrefix}-year`}
          aria-label="Filter by release year"
          value={filters.year ? String(filters.year) : ""}
          onChange={(event) =>
            onChange({
              year: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Any year</option>
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-rating`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Rating
        </label>
        <Select
          id={`${idPrefix}-rating`}
          aria-label="Filter by minimum rating"
          value={
            filters.minRating !== undefined ? String(filters.minRating) : ""
          }
          onChange={(event) =>
            onChange({
              minRating: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
        >
          {TMDB_RATING_FILTERS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-adult`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          18+ content
        </label>
        <Select
          id={`${idPrefix}-adult`}
          aria-label="Filter by adult content"
          value={filters.adult ?? ""}
          disabled={!adultAllowed}
          title={
            adultAllowed
              ? undefined
              : "Enable adult titles in Settings to browse 18+ content"
          }
          onChange={(event) =>
            onChange({
              adult:
                event.target.value === ""
                  ? undefined
                  : (event.target.value as TmdbDiscoverFilters["adult"]),
            })
          }
        >
          {TMDB_ADULT_FILTERS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-sort`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Sort
        </label>
        <Select
          id={`${idPrefix}-sort`}
          aria-label="Sort results"
          value={filters.sort ?? ""}
          onChange={(event) =>
            onChange({
              sort: (event.target.value || undefined) as
                | TmdbDiscoverSort
                | undefined,
            })
          }
        >
          <option value="">Category default</option>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function TmdbFilters({
  kind,
  filters,
  onChange,
  onClear,
  adultAllowed = false,
}: {
  kind: TmdbKind;
  filters: TmdbDiscoverFilters;
  onChange: (patch: Partial<TmdbDiscoverFilters>) => void;
  onClear: () => void;
  adultAllowed?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countTmdbFilters(filters);
  const noun = kind === "movie" ? "movies" : "TV shows";

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">
        <TmdbFilterFields
          kind={kind}
          filters={filters}
          onChange={onChange}
          adultAllowed={adultAllowed}
          idPrefix={`${kind}-desktop-filters`}
        />
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          className="h-11 flex-1 justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersIcon className="h-4 w-4" />
            Filters
          </span>
          {activeCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-contrast">
              {activeCount}
            </span>
          ) : (
            <span className="text-xs text-faint">None</span>
          )}
        </Button>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Filter ${noun}`}
        description="Refine by genre, release year, rating, 18+ content and sort order."
        mobileSheet
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
                setSheetOpen(false);
              }}
            >
              Reset all
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </>
        }
      >
        <TmdbFilterFields
          kind={kind}
          filters={filters}
          onChange={onChange}
          adultAllowed={adultAllowed}
          idPrefix={`${kind}-sheet-filters`}
        />
      </Dialog>
    </div>
  );
}

export function TmdbDiscoverBrowser({
  kind,
  initialPage,
  initialCategory,
  initialQuery,
  initialFilters,
  initialError,
  adultAllowed = false,
}: {
  kind: TmdbKind;
  initialPage: TmdbSearchPage | null;
  initialCategory: TmdbDiscoverCategory;
  initialQuery: string;
  initialFilters: TmdbDiscoverFilters;
  initialError: string | null;
  adultAllowed?: boolean;
}) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [category, setCategory] =
    useState<TmdbDiscoverCategory>(initialCategory);
  const [filters, setFilters] = useState<TmdbDiscoverFilters>(initialFilters);
  const [items, setItems] = useState<TmdbSearchResult[]>(
    initialPage?.results ?? [],
  );
  const [pageInfo, setPageInfo] = useState<TmdbSearchPage | null>(initialPage);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LoadStatus>(
    initialPage ? "idle" : initialError ? "error" : "loading",
  );
  const [error, setError] = useState<string | null>(initialError);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(
    () => countTmdbFilters(initialFilters) > 0,
  );
  const [retryNonce, setRetryNonce] = useState(0);
  const skipInitialFetch = useRef(
    initialPage !== null || initialError !== null,
  );

  const categoryOptions = tmdbDiscoverCategoriesForKind(kind);
  const genreOptions = tmdbGenresForKind(kind);
  const sortOptions = tmdbSortsForKind(kind);
  const kindLabelPlural = kind === "movie" ? "movies" : "TV shows";

  useEffect(() => {
    const trimmed = queryInput.trim();
    if (trimmed === query) return;
    const timer = window.setTimeout(() => {
      setQuery(trimmed);
      setPage(1);
      setStatus(trimmed.length === 1 ? "idle" : "loading");
      setError(null);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [queryInput, query]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("type", kind);
    if (category !== "trending") params.set("category", category);
    if (query) params.set("q", query);
    if (filters.genres?.length) params.set("genre", filters.genres.join(","));
    if (filters.adult) params.set("adult", filters.adult);
    if (filters.year) params.set("year", String(filters.year));
    if (filters.minRating !== undefined) {
      params.set("rating", String(filters.minRating));
    }
    if (filters.sort) params.set("sort", filters.sort);
    window.history.replaceState(null, "", `/discover?${params.toString()}`);
  }, [kind, category, query, filters]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    if (query.length === 1) return;

    const controller = new AbortController();

    fetchCachedJson<TmdbSearchPage>(
      requestPath(kind, category, query, page, filters),
      { signal: controller.signal },
    )
      .then((data) => {
        setItems((current) =>
          page === 1 ? data.results : mergeUnique(current, data.results),
        );
        setPageInfo(data);
        setStatus("idle");
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (page === 1) {
          setItems([]);
          setPageInfo(null);
        }
        setError(
          cause instanceof ApiRequestError
            ? cause.message
            : `Could not load ${kindLabelPlural} right now.`,
        );
        setStatus("error");
      });

    return () => controller.abort();
  }, [category, filters, kind, kindLabelPlural, page, query, retryNonce]);

  const searchTooShort = query.length === 1;
  const isLoading = status === "loading" && !searchTooShort;
  const isEmpty = items.length === 0;
  const isTyping = queryInput.trim() !== query;
  const hasNextPage = pageInfo ? pageInfo.page < pageInfo.totalPages : false;
  const searchActive = query.length >= 2;
  const activeFilterCount = countTmdbFilters(filters);
  const selectedGenres = filters.genres ?? [];

  const resetAll = () => {
    setQueryInput("");
    setQuery("");
    setCategory("trending");
    setFilters({});
    setPage(1);
    setStatus("loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  const clearSearch = () => {
    setQueryInput("");
    setQuery("");
    setPage(1);
    setStatus("loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  const submitSearch = () => {
    const trimmed = queryInput.trim();
    setQuery(trimmed);
    setPage(1);
    setStatus(trimmed.length === 1 ? "idle" : "loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  const selectCategory = (option: TmdbDiscoverCategory) => {
    setCategory(option);
    setQueryInput("");
    setQuery("");
    setPage(1);
    setStatus("loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  const applyFilter = (patch: Partial<TmdbDiscoverFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    // TMDB search does not accept catalogue filters, so changing a filter
    // returns to category browsing with the constraint applied.
    setQueryInput("");
    setQuery("");
    setPage(1);
    setStatus("loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  const clearFilters = () =>
    applyFilter({
      genres: undefined,
      year: undefined,
      minRating: undefined,
      sort: undefined,
      adult: undefined,
    });

  const toggleGenre = (value: string) => {
    const next = selectedGenres.includes(value)
      ? selectedGenres.filter((genre) => genre !== value)
      : [...selectedGenres, value];
    applyFilter({ genres: next.length > 0 ? next : undefined });
  };

  const chips: DiscoverChip[] = [];
  for (const genreId of selectedGenres) {
    const genre = genreOptions.find((option) => option.value === genreId);
    chips.push({
      key: `genre-${genreId}`,
      label: `Genre: ${genre?.label ?? genreId}`,
      clear: () => toggleGenre(genreId),
    });
  }
  if (filters.year) {
    chips.push({
      key: "year",
      label: `Year: ${filters.year}`,
      clear: () => applyFilter({ year: undefined }),
    });
  }
  if (filters.minRating !== undefined) {
    chips.push({
      key: "rating",
      label: `Rating: ${filters.minRating.toFixed(1)}+`,
      clear: () => applyFilter({ minRating: undefined }),
    });
  }
  if (filters.sort) {
    const sort = sortOptions.find((option) => option.value === filters.sort);
    chips.push({
      key: "sort",
      label: `Sort: ${sort?.label ?? filters.sort}`,
      clear: () => applyFilter({ sort: undefined }),
    });
  }
  if (filters.adult) {
    chips.push({
      key: "adult",
      label: filters.adult === "only" ? "18+: only" : "18+: included",
      clear: () => applyFilter({ adult: undefined }),
    });
  }

  const topItem = items[0] ?? null;
  const pills = categoryOptions.map((option) => ({
    id: option,
    label: CATEGORY_META[option].label,
    icon: CATEGORY_META[option].icon,
    active: category === option && !searchActive,
    onSelect: () => selectCategory(option),
  }));

  return (
    <div className="space-y-6">
      <DiscoverHero
        eyebrow="TMDB Catalogue"
        headlineMeta={
          kind === "movie" ? "Feature films worldwide" : "Series & specials"
        }
        title={`Discover ${kind === "movie" ? "Movies" : "TV Shows"}`}
        description={`Explore ${
          kind === "movie" ? "cinema releases" : "series"
        } by category, refine with genres, release years, ratings and adult content, or search TMDB directly. Every title opens the same Kaze detail and tracking experience.`}
        backdropUrl={topItem?.backdropUrl ?? topItem?.posterUrl ?? null}
        spotlight={
          topItem
            ? {
                href: `/screen/${topItem.kind}/${topItem.tmdbId}`,
                posterUrl: topItem.posterUrl,
                score:
                  topItem.voteAverage && topItem.voteAverage > 0
                    ? topItem.voteAverage.toFixed(1)
                    : null,
                title: topItem.title,
                meta: [kindLabel(topItem.kind), topItem.year]
                  .filter(Boolean)
                  .join(" · "),
                ctaLabel: `View ${kindLabel(topItem.kind)}`,
              }
            : null
        }
      />

      <DiscoverPills pills={pills} />

      <DiscoverDeck
        searchValue={queryInput}
        onSearchChange={setQueryInput}
        onSearchSubmit={submitSearch}
        searchAriaLabel={`Search ${kindLabelPlural} by title`}
        placeholder={
          kind === "movie"
            ? "Search films by title…"
            : "Search TV shows by title…"
        }
        busy={isLoading || isTyping}
        onClearSearch={clearSearch}
        filtersOpen={showFilters}
        onToggleFilters={() => setShowFilters((current) => !current)}
        filterCount={activeFilterCount}
        showReset={
          Boolean(queryInput) ||
          activeFilterCount > 0 ||
          category !== "trending"
        }
        onReset={resetAll}
        chips={chips}
        onClearAll={resetAll}
        hint={
          searchTooShort ? (
            <p className="text-xs text-faint">Type at least two characters.</p>
          ) : null
        }
      >
        <TmdbFilters
          kind={kind}
          filters={filters}
          onChange={applyFilter}
          onClear={clearFilters}
          adultAllowed={adultAllowed}
        />
      </DiscoverDeck>

      <DiscoverResultsBar
        loading={isLoading}
        loadingLabel="Searching TMDB…"
        visibleCount={items.length}
        totalCount={
          filters.adult === "only" ? null : (pageInfo?.totalResults ?? null)
        }
        emptyLabel={
          searchTooShort ? "Type at least two characters." : null
        }
        sort={
          <DiscoverSortSelect
            value={filters.sort ?? ""}
            onChange={(value) =>
              applyFilter({
                sort: (value || undefined) as TmdbDiscoverSort | undefined,
              })
            }
            options={[
              { value: "", label: "Category default" },
              ...sortOptions,
            ]}
          />
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        <PosterGridSkeleton count={12} label="Loading films and TV" />
      ) : searchTooShort ? null : isEmpty ? (
        status === "error" ? (
          <ErrorState
            title="TMDB discovery unavailable"
            message={error ?? `Could not load ${kindLabelPlural}.`}
            onRetry={() => {
              setStatus(page === 1 ? "loading" : "loadingMore");
              setError(null);
              setRetryNonce((value) => value + 1);
            }}
          />
        ) : (
          <EmptyState
            title={`No ${kindLabelPlural} found`}
            description={
              query
                ? `Nothing matched “${query}”. Try a shorter title or clear the search.`
                : activeFilterCount > 0
                  ? "No titles matched these filters. Try another genre, year, or rating."
                  : "No titles matched this category. Try another category."
            }
            action={
              <Button variant="secondary" size="sm" onClick={resetAll}>
                Reset discovery
              </Button>
            }
          />
        )
      ) : (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((item, index) => (
                <ScreenPoster
                  key={`${item.kind}-${item.tmdbId}`}
                  item={item}
                  priority={index < 6}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((item) => (
                <TmdbDiscoverListCard
                  key={`${item.kind}-${item.tmdbId}`}
                  item={item}
                />
              ))}
            </div>
          )}

          {status === "error" ? (
            <ErrorState
              title="Could not load more"
              message={error ?? "The next page failed to load."}
              onRetry={() => {
                setStatus("loadingMore");
                setError(null);
                setRetryNonce((value) => value + 1);
              }}
            />
          ) : null}

          <div className="flex flex-col items-center gap-3 pt-4">
            {hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus("loadingMore");
                  setError(null);
                  setPage((value) => value + 1);
                }}
                disabled={status === "loadingMore"}
                className="h-10 min-w-44 font-bold"
              >
                {status === "loadingMore"
                  ? "Loading more titles…"
                  : `Load more ${kindLabelPlural}`}
              </Button>
            ) : (
              <p className="text-xs text-faint">
                You have reached the end of these results.
              </p>
            )}
          </div>
        </>
      )}

      <TmdbAttribution className="mt-2 border-t border-border-subtle pt-3 text-[10px]" />
    </div>
  );
}
