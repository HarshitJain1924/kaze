"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  FlameIcon,
  HeartIcon,
  LoaderIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
  SparklesIcon,
  StarIcon,
  SwordsIcon,
  TrophyIcon,
  WandIcon,
  ZapIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatMediaKind,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

interface HomeSearchProps {
  popularAnime: AnimeSummary[];
}

const PAGE_SIZE = 4;

interface QuickDiscoveryTag {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_DISCOVERY_TAGS: QuickDiscoveryTag[] = [
  { label: "Manga", href: "/discover?type=manga", icon: SparklesIcon },
  { label: "Manhwa", href: "/discover?type=manga&country=KR", icon: SparklesIcon },
  { label: "Trending", href: "/discover?sort=TRENDING_DESC", icon: FlameIcon },
  { label: "Top Rated", href: "/discover?sort=SCORE_DESC", icon: TrophyIcon },
  { label: "Action", href: "/discover?genre=Action", icon: SwordsIcon },
  { label: "Romance", href: "/discover?genre=Romance", icon: HeartIcon },
  { label: "Fantasy", href: "/discover?genre=Fantasy", icon: WandIcon },
  { label: "Isekai", href: "/discover?genre=Isekai", icon: SparklesIcon },
  { label: "Airing Today", href: "/schedule", icon: ZapIcon },
];

export function HomeSearch({ popularAnime }: HomeSearchProps) {
  const { preferences } = usePreferences();
  const { entryFor, addToLibrary } = useLibrary();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaType, setMediaType] = useState<"anime" | "manga" | "manhwa">("anime");
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

  // Debounce search input and clear results when the field is emptied.
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQuery(trimmed);
      if (!trimmed) {
        setResults([]);
      }
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
        let url = `/api/media/search?q=${encodeURIComponent(debouncedQuery)}&perPage=8`;
        if (mediaType === "manga") {
          url += "&type=manga";
        } else if (mediaType === "manhwa") {
          url += "&type=manga&country=KR";
        } else {
          url += "&type=anime";
        }

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Failed to search ${mediaType}`);
        }

        const data = await response.json();
        setResults(data.items ?? []);
        setActiveIndex(-1);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError(`Unable to search ${mediaType} right now.`);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    void runFetch();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, mediaType]);

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
      className="relative z-30 border-t border-border pt-6"
    >
      {/* Header with authentic Japanese anime flavor & quick catalog access */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/70 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center border border-accent/30 text-accent-strong">
            <SparkIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">
              Quick Find & Track
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Instant AniList search across anime, manga, and manhwa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Media Type Tabs */}
          <div
            role="tablist"
            aria-label="Catalogue type"
            className="inline-flex items-center gap-1 border-b border-border text-[11px]"
          >
            {(["anime", "manga", "manhwa"] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={mediaType === type}
                onClick={() => {
                  setMediaType(type);
                  if (query.trim()) {
                    setIsOpen(true);
                  }
                }}
                className={cn(
                  "border-b-2 px-3 py-2 text-[11px] font-medium capitalize transition-colors",
                  mediaType === type
                    ? "border-accent text-accent-strong"
                    : "border-transparent text-muted hover:text-fg",
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="hidden sm:inline text-xs font-medium text-muted hover:text-fg transition-colors"
          >
            {showSuggestions ? "Hide suggestions" : "Show suggestions"}
          </button>
          <span className="hidden text-border sm:inline">|</span>
          <Link
            href={`/discover${mediaType === "manhwa" ? "?type=manga&country=KR" : mediaType === "manga" ? "?type=manga" : ""}`}
            className="hidden items-center gap-1 text-xs font-medium text-accent-strong transition-colors hover:underline sm:inline-flex"
          >
            <span>Explore all {mediaType}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Full-width interactive media search bar */}
      <div className="relative mt-5">
        <div className="relative flex items-center">
          <SearchIcon className="pointer-events-none absolute left-3.5 h-4 w-4 text-faint" />

          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label={`Search ${mediaType} to track or explore`}
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
            placeholder={
              mediaType === "manhwa"
                ? "Search manhwa to track (e.g. Solo Leveling, Omniscient Reader, Tower of God)..."
                : mediaType === "manga"
                  ? "Search manga to track (e.g. Berserk, One Piece, Chainsaw Man, Vagabond)..."
                  : "Search anime to track (e.g. Frieren, Solo Leveling, Bleach, Jujutsu Kaisen)..."
            }
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full border border-border bg-transparent pl-10 pr-24 text-sm font-normal text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
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
                className="flex h-8 w-8 items-center justify-center text-faint transition-colors hover:text-fg"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="hidden px-1.5 py-0.5 font-mono text-[10px] font-medium text-faint sm:inline-block">
                {isMac ? "⌘ K" : "Ctrl K"}
              </kbd>
            )}
          </div>
        </div>

        {/* Quick Genre & Category Discovery Tag Pills */}
        <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[11px] font-medium text-faint mr-1">
            Browse:
          </span>
          {QUICK_DISCOVERY_TAGS.map((tag) => {
            const Icon = tag.icon;
            return (
              <Link
                key={tag.label}
                href={tag.href}
                className="inline-flex shrink-0 items-center gap-1.5 border-b border-transparent px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                <Icon className="h-3 w-3 text-accent-strong" />
                <span>{tag.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Search results popover anchored cleanly underneath the input */}
        {isOpen && debouncedQuery ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[380px] overflow-y-auto border border-border bg-bg p-1 shadow-xl">
            {loading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
                <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
                <span>Searching AniList catalog...</span>
              </div>
            ) : error ? (
              <div className="py-6 text-center text-xs text-danger">{error}</div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">
                No {mediaType} found matching &quot;{debouncedQuery}&quot;.
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
                        "flex items-center justify-between gap-3 border-b border-border-subtle p-2.5 transition-colors last:border-b-0",
                        isFocused
                          ? "bg-surface-3"
                          : "hover:bg-surface-2",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Link
                          href={`/media/${anime.id}`}
                          onClick={() => setIsOpen(false)}
                          className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-border bg-surface-3"
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
                            href={`/media/${anime.id}`}
                            onClick={() => setIsOpen(false)}
                            className="line-clamp-1 text-[13px] font-semibold text-fg hover:text-accent-strong transition-colors"
                            title={title}
                          >
                            {title}
                          </Link>

                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                            {score ? (
                              <span className="flex items-center gap-0.5 font-medium text-warning">
                                <StarIcon className="h-3 w-3 fill-warning text-warning" />
                                {score}
                              </span>
                            ) : null}
                            {isManga(anime) ? (
                              <>
                                <span>·</span>
                                <span>{formatMediaKind(anime)}</span>
                                {anime.chapters ? (
                                  <>
                                    <span>·</span>
                                    <span>{anime.chapters} ch</span>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {anime.format ? (
                                  <>
                                    <span>·</span>
                                    <span>{formatFormat(anime.format)}</span>
                                  </>
                                ) : null}
                                {anime.episodes ? (
                                  <>
                                    <span>·</span>
                                    <span>{anime.episodes} eps</span>
                                  </>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isTracked && entry ? (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.status} mediaType={anime.mediaType} />
                            <Link
                              href={`/media/${anime.id}`}
                              onClick={() => setIsOpen(false)}
                              className="border-b border-transparent px-2 py-1 text-[10px] font-medium text-muted hover:border-accent hover:text-fg"
                            >
                              View
                            </Link>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isCurrentlyAdding}
                            onClick={() => void handleAdd(anime)}
                            className="inline-flex h-8 items-center gap-1.5 bg-accent px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-60"
                          >
                            {isCurrentlyAdding ? (
                              <LoaderIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusIcon className="h-3 w-3" />
                            )}
                            <span>
                              {isCurrentlyAdding ? "Adding…" : "+ Track"}
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
                  ? "Recommended for you · Untracked anime"
                  : "Trending Quick-Track"}
              </span>
              {popularAnime.length > PAGE_SIZE ? (
                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Cycle to next recommendations"
                  className="inline-flex items-center gap-1 border-b border-transparent px-1.5 py-1 text-[10px] font-medium text-muted transition-colors hover:border-accent hover:text-fg"
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
            <div className="flex items-center justify-between border-y border-border px-3 py-3 text-xs text-muted">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-success" />
                <span>You&apos;ve tracked all top trending recommendations! Use the search bar above to track any anime.</span>
              </div>
              <Link href="/discover" className="text-accent-strong hover:underline text-xs font-medium">
                Browse catalog &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-4">
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
                const formatLabel = formatFormat(anime.format);

                return (
                  <div
                    key={anime.id}
                    className="group relative flex items-center gap-3 border-b border-border p-3 transition-colors hover:bg-surface/50 sm:border-r sm:last:border-r-0"
                  >
                    {/* Poster Thumbnail with hover zoom & subtle border */}
                    <Link
                      href={`/media/${anime.id}`}
                      className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden border border-border bg-surface-3"
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
                        href={`/media/${anime.id}`}
                        className="line-clamp-1 text-xs font-semibold text-fg transition-colors hover:text-accent-strong"
                        title={title}
                      >
                        {title}
                      </Link>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        {score ? (
                          <span className="flex items-center gap-0.5 font-medium text-warning">
                            <StarIcon className="h-3 w-3 fill-warning text-warning" />
                            {score}
                          </span>
                        ) : null}
                        {formatLabel ? (
                          <>
                            <span>·</span>
                            <span>{formatLabel}</span>
                          </>
                        ) : null}
                        {anime.episodes ? (
                          <>
                            <span>·</span>
                            <span>{anime.episodes} ep</span>
                          </>
                        ) : null}
                      </div>

                      {/* Action button */}
                      <div className="mt-1.5">
                        {isTracked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-accent-strong">
                            <CheckIcon className="h-3 w-3" />
                            <span>In library</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => void handleAdd(anime)}
                            className="inline-flex h-7 items-center gap-1 border border-border px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg transition-colors hover:border-accent hover:text-accent-strong disabled:opacity-60"
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
