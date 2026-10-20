"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloseIcon,
  LoaderIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import { cn, formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

interface HomeSearchProps {
  popularAnime: AnimeSummary[];
}

export function HomeSearch({ popularAnime }: HomeSearchProps) {
  const { preferences } = usePreferences();
  const { entryFor, addToLibrary } = useLibrary();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [addingId, setAddingId] = useState<number | null>(null);

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
      await addToLibrary(anime, "planning");
      setAddingId(null);
    },
    [addToLibrary, addingId],
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

  const previewPopular = popularAnime.slice(0, 4);

  return (
    <div
      ref={containerRef}
      className="relative z-30 rounded-2xl border border-white/10 bg-[#0d0d17] p-3.5 shadow-xl transition-all sm:p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Search input field */}
        <div className="relative min-w-0 flex-1">
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-white/40" />

            <input
              ref={inputRef}
              type="search"
              role="searchbox"
              aria-label="Search anime to add to your library"
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
              placeholder="Search anime to add to your library..."
              autoComplete="off"
              spellCheck={false}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#141423] pl-10 pr-20 text-sm font-normal text-white placeholder-white/35 transition-all focus:border-accent focus:bg-[#18182b] focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:appearance-none"
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
                  className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              ) : (
                <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/50 sm:inline-block">
                  {isMac ? "⌘ K" : "Ctrl K"}
                </kbd>
              )}
            </div>
          </div>

          <p className="mt-1.5 px-1 text-[11px] text-white/50">
            Search by title, or try a popular anime below.
          </p>
        </div>

        {/* Right: Quick add thumbnails + button */}
        {previewPopular.length > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3.5 border-t border-white/5 pt-3 sm:justify-start lg:border-t-0 lg:pt-0">
            {/* Thumbnails row */}
            <div className="flex items-center -space-x-2 sm:space-x-1.5 sm:space-x-reverse">
              {previewPopular.map((anime) => {
                const cover =
                  anime.coverImage.extraLarge ?? anime.coverImage.large;
                const title = getDisplayTitle(
                  anime.title,
                  preferences.titleLanguage === "english",
                );
                const isTracked = !!entryFor(anime.id);

                return (
                  <button
                    key={anime.id}
                    type="button"
                    title={
                      isTracked
                        ? `${title} (In your library)`
                        : `Quick add ${title}`
                    }
                    onClick={() => {
                      if (!isTracked) {
                        void handleAdd(anime);
                      } else {
                        inputRef.current?.focus();
                        setQuery(title);
                        setIsOpen(true);
                      }
                    }}
                    className={cn(
                      "group relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg border shadow-md transition-all duration-200 hover:z-10 hover:scale-110 active:scale-95 sm:w-11",
                      isTracked
                        ? "border-accent ring-1 ring-accent/40"
                        : "border-white/15 hover:border-accent",
                    )}
                  >
                    {cover && isHttpUrl(cover) ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[#1e1d2c]" />
                    )}

                    {isTracked ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <CheckIcon className="h-3.5 w-3.5 text-accent-strong" />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Quick add action button */}
            <div className="text-left">
              <button
                type="button"
                onClick={() => {
                  inputRef.current?.focus();
                  setIsOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-strong transition-all hover:border-accent hover:bg-accent hover:text-white active:scale-95"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>Quick add</span>
              </button>
              <p className="mt-0.5 text-[10px] text-white/45 hidden sm:block">
                Add to your library without leaving home
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Search results popover anchored beneath input */}
      {isOpen && debouncedQuery ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[380px] overflow-y-auto rounded-2xl border border-white/15 bg-[#10101c]/98 p-2 shadow-2xl backdrop-blur-2xl">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/60">
              <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
              <span>Searching AniList...</span>
            </div>
          ) : error ? (
            <div className="py-6 text-center text-xs text-danger">{error}</div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-xs text-white/60">
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

                return (
                  <div
                    key={anime.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl p-2 transition-colors",
                      isFocused
                        ? "bg-white/10"
                        : "hover:bg-white/5",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Link
                        href={`/anime/${anime.id}`}
                        onClick={() => setIsOpen(false)}
                        className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#1c1b29]"
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
                          className="line-clamp-1 text-[13px] font-semibold text-white hover:text-accent-strong transition-colors"
                          title={title}
                        >
                          {title}
                        </Link>

                        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                          {anime.format ? (
                            <span>{formatFormat(anime.format)}</span>
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
                            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white"
                          >
                            View
                          </Link>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isCurrentlyAdding}
                          onClick={() => void handleAdd(anime)}
                          className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-strong disabled:opacity-60 active:scale-95"
                        >
                          {isCurrentlyAdding ? (
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                          ) : (
                            <PlusIcon className="h-3 w-3" />
                          )}
                          <span>
                            {isCurrentlyAdding ? "Adding…" : "Add"}
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
  );
}
