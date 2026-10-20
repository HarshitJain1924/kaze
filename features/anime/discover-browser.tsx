"use client";

import { useEffect, useRef, useState } from "react";

import { AnimeFilters } from "@/components/anime-filters";
import type { AnimeFilterState } from "@/components/anime-filters";
import { AnimeGrid } from "@/components/anime-grid";
import { AnimeSearch } from "@/components/anime-search";
import { CloseIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PosterGridSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { seasonLabel } from "@/lib/season";
import { formatFormat } from "@/lib/utils";
import type { AnimePage, AnimeSummary } from "@/types/anime";

type LoadStatus = "idle" | "loading" | "loadingMore" | "error";

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

export function DiscoverBrowser({
  initialPage,
  initialQuery,
  initialFilters,
}: {
  initialPage: AnimePage | null;
  initialQuery: string;
  initialFilters: AnimeFilterState;
}) {
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<AnimeFilterState>(initialFilters);
  const [items, setItems] = useState<AnimeSummary[]>(
    initialPage?.items ?? [],
  );
  const [pageInfo, setPageInfo] = useState(initialPage?.pageInfo ?? null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LoadStatus>(
    initialPage ? "idle" : "error",
  );
  const [error, setError] = useState<string | null>(
    initialPage
      ? null
      : "We could not reach AniList. Check your connection and try again.",
  );
  const [retryNonce, setRetryNonce] = useState(0);

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

  const activeChips: Array<{
    key: string;
    label: string;
    clear: () => void;
  }> = [];
  if (filters.genre) {
    activeChips.push({
      key: "genre",
      label: filters.genre,
      clear: () => updateFilters({ genre: undefined }),
    });
  }
  if (filters.format) {
    activeChips.push({
      key: "format",
      label: formatFormat(filters.format) ?? filters.format,
      clear: () => updateFilters({ format: undefined }),
    });
  }
  if (filters.season) {
    activeChips.push({
      key: "season",
      label: seasonLabel(filters.season),
      clear: () => updateFilters({ season: undefined }),
    });
  }
  if (filters.year) {
    activeChips.push({
      key: "year",
      label: String(filters.year),
      clear: () => updateFilters({ year: undefined }),
    });
  }

  const isLoading = status === "loading";
  const isTyping = queryInput.trim() !== query;
  const isEmpty = items.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
          Discover
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          Search the AniList catalogue, or narrow it by genre, format, season and
          year.
        </p>
      </header>

      <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface/60 p-3 sm:p-4">
        <AnimeSearch
          value={queryInput}
          onChange={setQueryInput}
          loading={isLoading || isTyping}
        />
        <AnimeFilters
          value={filters}
          onChange={updateFilters}
          onClear={resetAll}
        />

        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
              >
                {chip.label}
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-faint">
                  <CloseIcon className="h-2.5 w-2.5" />
                </span>
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={resetAll}
              className="ml-1 text-[11px] font-medium text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-5 items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-faint">
          {isLoading
            ? "Searching AniList…"
            : pageInfo?.total != null
              ? `${pageInfo.total.toLocaleString("en-US")} results`
              : `${items.length} results`}
        </p>
        {query || activeChips.length > 0 ? (
          <button
            type="button"
            onClick={resetAll}
            className="text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            Reset search
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <PosterGridSkeleton count={12} />
      ) : isEmpty ? (
        status === "error" ? (
          <ErrorState
            title="AniList is unreachable"
            message={error ?? "The anime catalogue could not be loaded."}
            onRetry={() => setRetryNonce((value) => value + 1)}
          />
        ) : (
          <EmptyState
            title="No anime found"
            description={
              query
                ? `Nothing matched “${query}”. Try a shorter title or fewer filters.`
                : "No titles matched these filters. Try a different genre or year."
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
          <AnimeGrid items={items} priorityCount={6} />

          {status === "error" ? (
            <ErrorState
              title="Could not load more"
              message={error ?? "The next page failed to load."}
              onRetry={() => setRetryNonce((value) => value + 1)}
            />
          ) : null}

          <div className="flex flex-col items-center gap-3 pt-2">
            {pageInfo?.hasNextPage ? (
              <Button
                variant="secondary"
                onClick={() => setPage((value) => value + 1)}
                disabled={status === "loadingMore"}
                className="min-w-40"
              >
                {status === "loadingMore" ? "Loading…" : "Load more"}
              </Button>
            ) : (
              <p className="text-xs text-faint">
                {pageInfo?.total != null
                  ? "You have reached the end of these results."
                  : "No further results."}
              </p>
            )}
            {isTyping ? (
              <button
                type="button"
                onClick={clearQuery}
                className="text-xs text-faint underline-offset-2 hover:text-fg hover:underline"
              >
                Clear search text
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
