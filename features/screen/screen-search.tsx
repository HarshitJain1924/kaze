"use client";

import { useEffect, useRef, useState } from "react";

import { SearchIcon } from "@/components/icons";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { EmptyState } from "@/components/empty-state";
import { Field, inputClass } from "@/components/ui/field";
import { ScreenPoster } from "@/features/screen/screen-poster";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { cn } from "@/lib/utils";
import type { TmdbKind, TmdbSearchPage, TmdbSearchResult } from "@/types/tmdb";

const KINDS: Array<{ value: TmdbKind; label: string; hint: string }> = [
  { value: "movie", label: "Movies", hint: "Features and films" },
  { value: "tv", label: "TV Shows", hint: "Series and seasons" },
];

export function ScreenSearch({ canWrite }: { canWrite: boolean }) {
  const [kind, setKind] = useState<TmdbKind>("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (trimmed.length < 2) {
        setResults(null);
        setError(null);
        setLoading(false);
        return;
      }

      const current = ++requestId.current;
      setLoading(true);
      setError(null);

      apiFetch<TmdbSearchPage>(
        `/api/tmdb/search?kind=${kind}&q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal },
      )
        .then((page) => {
          if (requestId.current !== current) return;
          setResults(page.results);
        })
        .catch((cause) => {
          if (cause instanceof Error && cause.name === "AbortError") return;
          if (requestId.current !== current) return;
          setResults([]);
          setError(
            cause instanceof ApiRequestError
              ? cause.message
              : "Movie and TV search is unavailable right now.",
          );
        })
        .finally(() => {
          if (requestId.current === current) setLoading(false);
        });
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [kind, query]);

  const activeKindLabel = kind === "movie" ? "movies" : "TV shows";

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Choose movie or TV search"
        className="inline-flex w-fit items-center gap-1 rounded-2xl border border-border-subtle bg-surface-2 p-1"
      >
        {KINDS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={kind === entry.value}
            onClick={() => {
              setKind(entry.value);
              setResults(null);
              setError(null);
            }}
            className={cn(
              "rounded-xl px-4 py-1.5 text-xs font-semibold transition-colors",
              kind === entry.value
                ? "bg-accent text-accent-contrast shadow-sm"
                : "text-muted hover:bg-surface-3 hover:text-fg",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <Field label={`Search ${activeKindLabel}`}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              kind === "movie"
                ? "Search films by title…"
                : "Search TV shows by title…"
            }
            aria-label={`Search ${activeKindLabel}`}
            className={cn(inputClass, "h-11 pl-10")}
          />
        </div>
      </Field>

      {!canWrite ? (
        <p className="text-xs text-faint">
          Sign in to add films and TV shows to your library. Search is open to
          everyone.
        </p>
      ) : null}

      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="text-sm text-faint">Type at least two characters.</p>
      ) : null}

      {loading ? (
        <div
          aria-label="Searching TMDB"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="aspect-[2/3] animate-pulse rounded-2xl border border-border-subtle bg-surface-2"
            />
          ))}
        </div>
      ) : null}

      {error && !loading ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
          {error.toLowerCase().includes("not configured") ? (
            <p className="mt-1.5 text-xs text-danger/80">
              Add <code className="font-mono">TMDB_READ_ACCESS_TOKEN</code> to
              the server environment and restart Kaze.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && results && results.length === 0 && !error ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6 text-faint" />}
          title={`No ${activeKindLabel} found`}
          description={`Nothing on TMDB matched “${query.trim()}”. Try a different title.`}
        />
      ) : null}

      {!loading && results && results.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((item, index) => (
            <ScreenPoster
              key={`${item.kind}-${item.tmdbId}`}
              item={item}
              priority={index < 6}
            />
          ))}
        </div>
      ) : null}

      {!results && !loading && query.trim().length === 0 ? (
        <div className="rounded-2xl border border-border-subtle bg-surface-2/50 p-5">
          <p className="font-display text-sm font-semibold text-fg">
            A separate shelf for films and television
          </p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
            Anime and manga stay on AniList. Movies and TV shows are matched to
            TMDB by their own ids, so a series and an anime with the same name
            are never merged.
          </p>
        </div>
      ) : null}

      <TmdbAttribution className="pt-1" />
    </div>
  );
}
