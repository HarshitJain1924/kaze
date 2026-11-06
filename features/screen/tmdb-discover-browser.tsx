"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  CalendarIcon,
  ChevronRightIcon,
  CloseIcon,
  FlameIcon,
  GridIcon,
  ListIcon,
  LoaderIcon,
  PlayIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from "@/components/icons";
import { PosterGridSkeleton } from "@/components/loading-skeleton";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { Button } from "@/components/ui/button";
import { kindLabel, ScreenPoster } from "@/features/screen/screen-poster";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { cn, isHttpUrl } from "@/lib/utils";
import {
  tmdbDiscoverCategoriesForKind,
  type TmdbDiscoverCategory,
  type TmdbKind,
  type TmdbSearchPage,
  type TmdbSearchResult,
} from "@/types/tmdb";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

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
): string {
  if (query.length >= 2) {
    const params = new URLSearchParams({
      kind,
      q: query,
      page: String(page),
    });
    return `/api/tmdb/search?${params.toString()}`;
  }
  const params = new URLSearchParams({
    kind,
    category,
    page: String(page),
  });
  return `/api/tmdb/discover?${params.toString()}`;
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

export function TmdbDiscoverBrowser({
  kind,
  initialPage,
  initialCategory,
  initialQuery,
  initialError,
}: {
  kind: TmdbKind;
  initialPage: TmdbSearchPage | null;
  initialCategory: TmdbDiscoverCategory;
  initialQuery: string;
  initialError: string | null;
}) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const [category, setCategory] =
    useState<TmdbDiscoverCategory>(initialCategory);
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
  const [retryNonce, setRetryNonce] = useState(0);
  const skipInitialFetch = useRef(
    initialPage !== null || initialError !== null,
  );

  const categoryOptions = tmdbDiscoverCategoriesForKind(kind);
  const activeCategory = CATEGORY_META[category];
  const kindLabelPlural = kind === "movie" ? "movies" : "TV shows";
  const singularKind = kind === "movie" ? "Movie" : "TV Show";

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
    window.history.replaceState(null, "", `/discover?${params.toString()}`);
  }, [kind, category, query]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    if (query.length === 1) return;

    const controller = new AbortController();

    apiFetch<TmdbSearchPage>(requestPath(kind, category, query, page), {
      signal: controller.signal,
    })
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
  }, [category, kind, kindLabelPlural, page, query, retryNonce]);

  const searchTooShort = query.length === 1;
  const isLoading = status === "loading" && !searchTooShort;
  const isEmpty = items.length === 0;
  const isTyping = queryInput.trim() !== query;
  const topItem = items[0] ?? null;
  const topArtwork = topItem?.backdropUrl ?? topItem?.posterUrl ?? null;
  const hasNextPage = pageInfo ? pageInfo.page < pageInfo.totalPages : false;
  const searchActive = query.length >= 2;

  const resetAll = () => {
    setQueryInput("");
    setQuery("");
    setCategory("trending");
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

  const selectCategory = (option: TmdbDiscoverCategory) => {
    setCategory(option);
    setQueryInput("");
    setQuery("");
    setPage(1);
    setStatus("loading");
    setError(null);
    setRetryNonce((value) => value + 1);
  };

  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-3xl border border-border-subtle bg-surface-2 shadow-2xl transition-all">
        {topItem && topArtwork && isHttpUrl(topArtwork) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
          >
            <div className="absolute inset-0 scale-125 opacity-25 blur-3xl saturate-200">
              <Image
                src={topArtwork}
                alt=""
                fill
                unoptimized
                sizes="100vw"
                className="object-cover"
              />
            </div>
            {topItem.backdropUrl && isHttpUrl(topItem.backdropUrl) ? (
              <div className="absolute inset-0">
                <Image
                  src={topItem.backdropUrl}
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
                TMDB Global Catalogue
              </span>
              <span className="text-faint">·</span>
              <span className="text-xs font-medium text-muted">
                {activeCategory.label} {kindLabelPlural}
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
              Discover {kind === "movie" ? "Movies" : "TV Shows"}
            </h1>

            <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
              Browse {kind === "movie" ? "cinema releases" : "series"} by
              category or search TMDB directly. Every title opens the same Kaze
              detail and tracking experience.
            </p>
          </div>

          {topItem ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-border-subtle bg-surface/70 p-3 shadow-xl backdrop-blur-md lg:max-w-sm">
              <Link
                href={`/screen/${topItem.kind}/${topItem.tmdbId}`}
                className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-md sm:w-20"
              >
                {topItem.posterUrl && isHttpUrl(topItem.posterUrl) ? (
                  <Image
                    src={topItem.posterUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-3" />
                )}
                {topItem.voteAverage && topItem.voteAverage > 0 ? (
                  <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                    <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {topItem.voteAverage.toFixed(1)}
                  </span>
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                  {searchActive ? "Top Match" : "Top Result"}
                </span>
                <Link
                  href={`/screen/${topItem.kind}/${topItem.tmdbId}`}
                  className="mt-0.5 line-clamp-1 block font-display text-sm font-bold text-fg transition-colors hover:text-accent-strong"
                >
                  {topItem.title}
                </Link>
                <p className="mt-0.5 text-[11px] text-muted">
                  {[kindLabel(topItem.kind), topItem.year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-2">
                  <Link
                    href={`/screen/${topItem.kind}/${topItem.tmdbId}`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
                  >
                    View {singularKind}
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {categoryOptions.map((option) => {
          const meta = CATEGORY_META[option];
          const Icon = meta.icon;
          const active = category === option && !searchActive;
          return (
            <button
              key={option}
              type="button"
              onClick={() => selectCategory(option)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all active:scale-95",
                active
                  ? "border-accent bg-accent text-accent-contrast shadow-md scale-102"
                  : "border-border-subtle bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  active ? "text-accent-contrast" : "text-accent-strong",
                )}
              />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3.5 rounded-2xl border border-border-subtle bg-surface-2/80 p-3 shadow-lg backdrop-blur-md sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              role="searchbox"
              aria-label={`Search ${kindLabelPlural} by title`}
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const trimmed = queryInput.trim();
                  setQuery(trimmed);
                  setPage(1);
                  setStatus(trimmed.length === 1 ? "idle" : "loading");
                  setError(null);
                  setRetryNonce((value) => value + 1);
                }
              }}
              placeholder={
                kind === "movie"
                  ? "Search films by title…"
                  : "Search TV shows by title…"
              }
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-border bg-surface-3/50 pl-10 pr-20 text-sm text-fg placeholder:text-faint transition-colors focus:border-accent focus:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
            />
            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {isLoading || isTyping ? (
                <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
              ) : null}
              {queryInput ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="hidden items-center rounded border border-border bg-surface-3/60 px-1.5 font-mono text-[10px] text-faint sm:inline-flex">
                  Search
                </kbd>
              )}
            </div>
          </div>
          {queryInput || category !== "trending" ? (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-3/60 px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              Reset
            </button>
          ) : null}
        </div>
        {query.length === 1 ? (
          <p className="text-xs text-faint">Type at least two characters.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <p aria-live="polite" className="text-xs font-semibold text-muted">
          {searchTooShort ? (
            <span className="text-faint">Type at least two characters.</span>
          ) : isLoading ? (
            <span className="inline-flex items-center gap-1.5 text-accent-strong">
              <span className="h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
              Searching TMDB…
            </span>
          ) : pageInfo?.totalResults != null ? (
            <span>
              Showing <span className="font-bold text-fg">{items.length}</span>{" "}
              of{" "}
              <span className="font-bold text-fg">
                {pageInfo.totalResults.toLocaleString("en-US")}
              </span>{" "}
              results
            </span>
          ) : (
            <span>{items.length} results</span>
          )}
        </p>

        <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Poster grid view"
            title="Poster grid view"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              viewMode === "grid"
                ? "bg-accent font-bold text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
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
                ? "bg-accent font-bold text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

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

      <TmdbAttribution className="pt-1" />
    </div>
  );
}