"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  LoaderIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

interface HomeSearchProps {
  popularAnime: AnimeSummary[];
}

const PAGE_SIZE = 4;

export function HomeSearch({ popularAnime }: HomeSearchProps) {
  const { preferences } = usePreferences();
  const { entryFor, addToLibrary } = useLibrary();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Pagination / cycle offset for quick recommendations
  const [pageIndex, setPageIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  // Keyboard shortcut Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to dismiss results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Fetch search results on debounced query
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const runFetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/anime/search?q=${encodeURIComponent(debouncedQuery)}&perPage=8`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to search anime");
        }

        const data = await response.json();
        setResults(data.items ?? []);
        setActiveIndex(-1);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError("Unable to search anime right now.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    void runFetch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  const handleAdd = useCallback(
    async (anime: AnimeSummary) => {
      if (addingId !== null) return;
      setAddingId(anime.id);
      const title = getDisplayTitle(
        anime.title,
        preferences.titleLanguage === "english",
      );
      try {
        const ok = await addToLibrary(anime, "planning");
        if (ok) {
          toast({
            title: "Added to library",
            description: `"${title}" was added to your Planning list.`,
            tone: "success",
          });
        }
      } finally {
        setAddingId(null);
      }
    },
    [addToLibrary, addingId, preferences.titleLanguage, toast],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected && !entryFor(selected.id)) {
        void handleAdd(selected);
      }
    }
  };

  // Smart Untracked Recommendations Pool:
  // Dynamically prioritize anime not yet tracked in the user's library.
  // If the user tracks an anime, untracked candidates update and the next untracked titles rotate in.
  const untrackedAnime = useMemo(() => {
    return popularAnime.filter((anime) => !entryFor(anime.id));
  }, [popularAnime, entryFor]);

  const displayedAnime = useMemo(() => {
    // If we have untracked anime, pick from them
    const source = untrackedAnime.length > 0 ? untrackedAnime : popularAnime;
    if (source.length === 0) return [];

    const total = source.length;
    const startIndex = (pageIndex * PAGE_SIZE) % total;

    if (total <= PAGE_SIZE) {
      return source;
    }

    const items: AnimeSummary[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      const anime = source[(startIndex + i) % total];
      if (anime) {
        items.push(anime);
      }
    }
    return items;
  }, [untrackedAnime, popularAnime, pageIndex]);

  const handleShuffle = () => {
    setPageIndex((prev) => prev + 1);
  };

  const allTracked = popularAnime.length > 0 && untrackedAnime.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative z-30 space-y-4 rounded-[22px] border border-border/80 bg-surface p-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.9)] transition-colors sm:p-5"
    >
      {/* Header with clear purpose & catalog link */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/70 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong shadow-xs">
            <SparkIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-fg">
              Quick Find & Track
            </h2>
            <p className="text-xs text-muted">
              Search AniList or 1-click track popular series without leaving home
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="text-xs font-medium text-muted hover:text-fg transition-colors"
          >
            {showSuggestions ? "Hide suggestions" : "Show suggestions"}
          </button>
          <span className="hidden text-border sm:inline">|</span>
          <Link
            href="/discover"
            className="hidden items-center gap-1 text-xs font-medium text-accent-strong transition-colors hover:underline sm:inline-flex"
          >
            <span>Explore all anime</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Full-width interactive search bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-faint" />

          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label="Search anime to track or explore"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search anime to track (e.g. Frieren, Solo Leveling, Bleach)..."
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-24 text-sm font-normal text-fg placeholder:text-faint transition-all focus:border-accent focus:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:appearance-none"
          />

          <div className="absolute right-3 flex items-center gap-1.5">
            {loading ? (
              <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-faint sm:inline-block">
                {isMac ? "⌘ K" : "Ctrl K"}
              </kbd>
            )}
          </div>
        </div>

        {/* Search results popover anchored cleanly underneath the input */}
        {isOpen && debouncedQuery ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[380px] overflow-y-auto rounded-2xl border border-border bg-surface p-2 shadow-2xl">
            {loading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
                <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
                <span>Searching AniList...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-xs text-danger">{error}</div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                No anime found matching &quot;{debouncedQuery}&quot;.
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((anime, index) => {
                  const title = getDisplayTitle(
                    anime.title,
                    preferences.titleLanguage === "english",
                  );
                  const cover =
                    anime.coverImage.extraLarge ?? anime.coverImage.large;
                  const isTracked = !!entryFor(anime.id);
                  const entry = entryFor(anime.id);
                  const isFocused = index === activeIndex;
                  const isCurrentlyAdding = addingId === anime.id;
                  const score = formatScore(anime.averageScore);

                  return (
                    <div
                      key={anime.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl p-2 transition-colors",
                        isFocused
                          ? "bg-surface-3"
                          : "hover:bg-surface-2",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Link
                          href={`/anime/${anime.id}`}
                          onClick={() => setIsOpen(false)}
                          className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3"
                        >
                          {cover && isHttpUrl(cover) ? (
                            <Image
                              src={cover}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : null}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/anime/${anime.id}`}
                            onClick={() => setIsOpen(false)}
                            className="line-clamp-1 text-[13px] font-semibold text-fg hover:text-accent-strong transition-colors"
                            title={title}
                          >
                            {title}
                          </Link>

                          <div className="flex items-center gap-1.5 text-[11px] text-muted">
                            {score ? (
                              <span className="flex items-center gap-0.5 font-medium text-warning">
                                <StarIcon className="h-3 w-3 fill-warning text-warning" />
                                {score}
                              </span>
                            ) : null}
                            {anime.format ? (
                              <>
                                <span>·</span>
                                <span>{formatFormat(anime.format)}</span>
                              </>
                            ) : null}
                            {anime.seasonYear ? (
                              <>
                                <span>·</span>
                                <span>{anime.seasonYear}</span>
                              </>
                            ) : null}
                            {anime.episodes ? (
                              <>
                                <span>·</span>
                                <span>{anime.episodes} eps</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isTracked && entry ? (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.status} />
                            <Link
                              href={`/anime/${anime.id}`}
                              onClick={() => setIsOpen(false)}
                              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted hover:bg-surface-3 hover:text-fg"
                            >
                              View
                            </Link>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isCurrentlyAdding}
                            onClick={() => void handleAdd(anime)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast shadow-xs transition-all hover:bg-accent-hover disabled:opacity-60 active:scale-95"
                          >
                            {isCurrentlyAdding ? (
                              <LoaderIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusIcon className="h-3 w-3" />
                            )}
                            <span>
                              {isCurrentlyAdding ? "Adding…" : "Add to library"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Dynamic Trending Quick-Track Cards */}
      {showSuggestions ? (
        <div className="pt-1">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {untrackedAnime.length > 0
                  ? "Recommended for you · Untracked series"
                  : "Trending Quick-Track"}
              </span>
              {popularAnime.length > PAGE_SIZE ? (
                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Cycle to next recommendations"
                  className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted hover:border-border hover:text-fg transition-colors active:scale-95"
                >
                  <RefreshIcon className="h-3 w-3" />
                  <span>Shuffle</span>
                </button>
              ) : null}
            </div>

            <span className="text-[11px] text-faint hidden sm:inline">
              1-click add to planning
            </span>
          </div>

          {allTracked ? (
            <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-2/40 px-3.5 py-2.5 text-xs text-muted">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-success" />
                <span>You&apos;ve tracked all top trending recommendations! Use the search bar above to track any anime.</span>
              </div>
              <Link href="/discover" className="text-accent-strong hover:underline text-xs font-medium">
                Browse catalog &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {displayedAnime.map((anime) => {
                const cover =
                  anime.coverImage.extraLarge ?? anime.coverImage.large;
                const title = getDisplayTitle(
                  anime.title,
                  preferences.titleLanguage === "english",
                );
                const isTracked = !!entryFor(anime.id);
                const isAdding = addingId === anime.id;
                const score = formatScore(anime.averageScore);

                return (
                  <div
                    key={anime.id}
                    className="group relative flex min-w-0 items-center gap-3 rounded-xl border border-border-subtle bg-surface-2/70 p-2.5 transition-colors duration-200 hover:border-accent/40 hover:bg-surface-2"
                  >
                    {/* Poster Thumbnail */}
                    <Link
                      href={`/anime/${anime.id}`}
                      className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3"
                      title={`View ${title}`}
                    >
                      {cover && isHttpUrl(cover) ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-surface-3" />
                      )}
                    </Link>

                    {/* Title & metadata */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/anime/${anime.id}`}
                        className="line-clamp-1 text-xs font-semibold text-fg transition-colors hover:text-accent-strong"
                        title={title}
                      >
                        {title}
                      </Link>

                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        {score ? (
                          <span className="flex items-center gap-0.5 font-medium text-warning">
                            <StarIcon className="h-3 w-3 fill-warning text-warning" />
                            {score}
                          </span>
                        ) : null}
                        {anime.format ? (
                          <span>{formatFormat(anime.format)}</span>
                        ) : null}
                      </div>

                      {/* Action button */}
                      <div className="mt-2">
                        {isTracked ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">
                            <CheckIcon className="h-3 w-3" />
                            <span>In library</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => void handleAdd(anime)}
                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-60 active:scale-95"
                          >
                            {isAdding ? (
                              <LoaderIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusIcon className="h-3 w-3" />
                            )}
                            <span>{isAdding ? "Adding…" : "Track"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
