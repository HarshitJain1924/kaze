"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  CompassIcon,
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
import { apiFetch } from "@/lib/http";
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
import type { TmdbSearchPage, TmdbSearchResult } from "@/types/tmdb";

interface HomeSearchProps {
  popularAnime: AnimeSummary[];
  popularManga?: AnimeSummary[];
}

const PAGE_SIZE = 4;

// One selector for everything the archive can track. Films and TV resolve through
// TMDB; anime and reading stay on the AniList catalogue.
const SEARCH_TYPES = [
  { value: "anime", label: "Anime" },
  { value: "manga", label: "Manga" },
  { value: "manhwa", label: "Manhwa" },
  { value: "movie", label: "Films" },
  { value: "tv", label: "TV" },
] as const;

type SearchType = (typeof SEARCH_TYPES)[number]["value"];

function isScreenType(type: SearchType): type is "movie" | "tv" {
  return type === "movie" || type === "tv";
}

interface QuickDiscoveryTag {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUICK_DISCOVERY_TAGS: QuickDiscoveryTag[] = [
  { label: "Trending", href: "/discover?sort=TRENDING_DESC", icon: FlameIcon },
  { label: "Top Rated", href: "/discover?sort=SCORE_DESC", icon: TrophyIcon },
  { label: "Airing Today", href: "/schedule", icon: ZapIcon },
  { label: "Action", href: "/discover?genre=Action", icon: SwordsIcon },
  { label: "Romance", href: "/discover?genre=Romance", icon: HeartIcon },
  { label: "Fantasy", href: "/discover?genre=Fantasy", icon: WandIcon },
  { label: "Isekai", href: "/discover?genre=Isekai", icon: SparklesIcon },
  { label: "Manga", href: "/discover?type=manga", icon: SparklesIcon },
  { label: "Manhwa", href: "/discover?type=manga&country=KR", icon: SparklesIcon },
];

export function HomeSearch({ popularAnime, popularManga }: HomeSearchProps) {
  const { preferences } = usePreferences();
  const { entryFor, addToLibrary } = useLibrary();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaType, setMediaType] = useState<SearchType>("anime");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Film and TV results live beside the AniList results so switching tabs never
  // renders the wrong shape.
  const [screenResults, setScreenResults] = useState<TmdbSearchResult[]>([]);
  const [screenLoading, setScreenLoading] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [trackedScreen, setTrackedScreen] = useState<Record<string, boolean>>(
    {},
  );
  const [screenAddingId, setScreenAddingId] = useState<string | null>(null);

  // Suggestions state: explicitly opt-in, collapsed by default
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);

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

  // Click outside to dismiss search results & browse popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
      if (
        browseRef.current &&
        !browseRef.current.contains(target)
      ) {
        setShowBrowse(false);
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
        setScreenResults([]);
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

    if (isScreenType(mediaType)) {
      const kind = mediaType;
      const runScreenFetch = async () => {
        setScreenLoading(true);
        setScreenError(null);
        try {
          const page = await apiFetch<TmdbSearchPage>(
            `/api/tmdb/search?kind=${kind}&q=${encodeURIComponent(debouncedQuery)}`,
            { signal: controller.signal },
          );
          setScreenResults(page.results);
        } catch (cause: unknown) {
          if ((cause as Error)?.name === "AbortError") return;
          setScreenResults([]);
          setScreenError(
            kind === "movie"
              ? "Film search is unavailable right now."
              : "TV search is unavailable right now.",
          );
        } finally {
          setScreenLoading(false);
        }
      };

      void runScreenFetch();
      return () => controller.abort();
    }

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

  const handleTrackScreen = useCallback(
    async (item: TmdbSearchResult) => {
      const key = `${item.kind}-${item.tmdbId}`;
      if (screenAddingId !== null) return;
      setScreenAddingId(key);
      try {
        await apiFetch<{ entry: unknown }>("/api/tmdb/library", {
          method: "POST",
          body: JSON.stringify({
            kind: item.kind,
            tmdbId: item.tmdbId,
            status: "planning",
          }),
        });
        setTrackedScreen((prev) => ({ ...prev, [key]: true }));
        toast({
          title: "Added to library",
          description: `“${item.title}” is in your Planning list.`,
          tone: "success",
        });
      } catch (cause) {
        toast({
          title: "Could not add that title",
          description:
            cause instanceof Error
              ? cause.message
              : "Film and TV tracking is unavailable right now.",
        });
      } finally {
        setScreenAddingId(null);
      }
    },
    [screenAddingId, toast],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setShowBrowse(false);
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

  // Recommendations pool resolved by selected media type without duplicate network requests
  const sourcePool = useMemo(() => {
    if (isScreenType(mediaType)) return [];
    if (mediaType === "manhwa") {
      const mangaPool = popularManga && popularManga.length > 0 ? popularManga : popularAnime;
      const manhwa = mangaPool.filter((item) => item.countryOfOrigin === "KR");
      return manhwa.length > 0 ? manhwa : mangaPool;
    }
    if (mediaType === "manga") {
      return popularManga && popularManga.length > 0 ? popularManga : popularAnime;
    }
    return popularAnime;
  }, [mediaType, popularAnime, popularManga]);

  // Smart Untracked Recommendations: Prioritize titles not yet in user library
  const untrackedItems = useMemo(() => {
    return sourcePool.filter((item) => !entryFor(item.id));
  }, [sourcePool, entryFor]);

  const displayedItems = useMemo(() => {
    const source = untrackedItems.length > 0 ? untrackedItems : sourcePool;
    if (source.length === 0) return [];

    const total = source.length;
    const startIndex = (pageIndex * PAGE_SIZE) % total;

    if (total <= PAGE_SIZE) {
      return source;
    }

    const items: AnimeSummary[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      const item = source[(startIndex + i) % total];
      if (item) {
        items.push(item);
      }
    }
    return items;
  }, [untrackedItems, sourcePool, pageIndex]);

  const handleShuffle = () => {
    setPageIndex((prev) => prev + 1);
  };

  const allTracked = sourcePool.length > 0 && untrackedItems.length === 0;

  const exploreAllHref =
    mediaType === "movie" || mediaType === "tv"
      ? "/screen"
      : mediaType === "manhwa"
        ? "/discover?type=manga&country=KR"
        : mediaType === "manga"
          ? "/discover?type=manga"
          : "/discover";

  return (
    <div
      ref={containerRef}
      className="relative z-30 pt-0.5 sm:pt-1"
    >
      {/* Compact Utility Bar Header */}
      <div className="mb-1.5 sm:mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        {/* Left: Compact Heading & Inline Media Selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1.5 text-accent-strong">
            <SparkIcon className="h-3.5 w-3.5 shrink-0" />
            <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-fg">
              Quick Find & Track
            </h2>
          </div>

          <span className="text-border-subtle select-none">/</span>

          {/* Inline Anime / Manga / Manhwa Selector */}
          <div
            role="tablist"
            aria-label="Catalogue type"
            className="no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto border border-border/80 bg-surface/50 p-0.5 text-[11px]"
          >
            {SEARCH_TYPES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="tab"
                aria-selected={mediaType === entry.value}
                onClick={() => {
                  setMediaType(entry.value);
                  setResults([]);
                  setScreenResults([]);
                  if (query.trim()) {
                    setIsOpen(true);
                  }
                }}
                className={cn(
                  "shrink-0 px-2 py-0.5 text-[11px] font-medium transition-colors",
                  mediaType === entry.value
                    ? "bg-surface-3 text-accent-strong font-semibold shadow-xs"
                    : "text-muted hover:text-fg hover:bg-surface-2/60",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Secondary Browse & Explicit Suggestions Toggle */}
        <div className="flex items-center gap-2">
          {/* Subtle inline browse shortcuts (non-competing, only on wider viewports) */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-faint">
            <span className="text-[10px] uppercase tracking-wider text-faint">Browse:</span>
            <Link
              href="/discover?sort=TRENDING_DESC"
              className="text-muted hover:text-fg transition-colors"
            >
              Trending
            </Link>
            <span className="text-border-subtle">·</span>
            <Link
              href="/discover?sort=SCORE_DESC"
              className="text-muted hover:text-fg transition-colors"
            >
              Top Rated
            </Link>
            <span className="text-border-subtle">·</span>
            <Link
              href="/schedule"
              className="text-muted hover:text-fg transition-colors"
            >
              Airing
            </Link>
          </div>

          {/* Secondary Browse Dropdown Menu */}
          <div className="relative" ref={browseRef}>
            <button
              type="button"
              onClick={() => setShowBrowse((prev) => !prev)}
              aria-expanded={showBrowse}
              className={cn(
                "inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium transition-colors",
                showBrowse
                  ? "border-accent bg-surface-2 text-accent-strong"
                  : "border-border/80 bg-surface/40 text-muted hover:border-border hover:text-fg",
              )}
            >
              <CompassIcon className="h-3 w-3 text-faint" />
              <span>Browse</span>
              <ChevronDownIcon
                className={cn(
                  "h-3 w-3 transition-transform duration-150",
                  showBrowse && "rotate-180",
                )}
              />
            </button>

            {showBrowse ? (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-64 border border-border bg-bg/95 p-2 shadow-2xl backdrop-blur-md">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Browse Catalogue
                </div>
                <div className="grid grid-cols-2 gap-1 py-1">
                  {QUICK_DISCOVERY_TAGS.map((tag) => {
                    const Icon = tag.icon;
                    return (
                      <Link
                        key={tag.label}
                        href={tag.href}
                        onClick={() => setShowBrowse(false)}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      >
                        <Icon className="h-3.5 w-3.5 text-accent-strong shrink-0" />
                        <span className="truncate">{tag.label}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="mt-1 border-t border-border-subtle pt-1.5 px-2">
                  <Link
                    href={exploreAllHref}
                    onClick={() => setShowBrowse(false)}
                    className="flex items-center justify-between text-[11px] font-medium text-accent-strong hover:underline"
                  >
                    <span>Explore all {mediaType}</span>
                    <ChevronRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {/* Explicit Suggestions control */}
          <button
            type="button"
            onClick={() => setShowSuggestions((prev) => !prev)}
            aria-expanded={showSuggestions}
            disabled={isScreenType(mediaType)}
            title={
              isScreenType(mediaType)
                ? "Suggestions cover anime, manga and manhwa"
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              showSuggestions
                ? "border-accent bg-accent-soft text-accent-strong font-semibold"
                : "border-border/80 bg-surface/40 text-muted hover:border-border hover:text-fg",
            )}
          >
            <SparklesIcon className="h-3 w-3 text-accent-strong" />
            <span>Suggestions</span>
            <ChevronDownIcon
              className={cn(
                "h-3 w-3 transition-transform duration-150",
                showSuggestions && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      {/* Primary Search Input */}
      <div className="relative">
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
              mediaType === "movie"
                ? "Search films to track (e.g. Dune, Past Lives, Oppenheimer)..."
                : mediaType === "tv"
                  ? "Search TV series to track (e.g. Severance, The Bear, Shogun)..."
                  : mediaType === "manhwa"
                    ? "Search manhwa to track (e.g. Solo Leveling, Omniscient Reader, Tower of God)..."
                    : mediaType === "manga"
                      ? "Search manga to track (e.g. Berserk, One Piece, Chainsaw Man, Vagabond)..."
                      : "Search anime to track (e.g. Frieren, Solo Leveling, Bleach, Jujutsu Kaisen)..."
            }
            autoComplete="off"
            spellCheck={false}
            className="h-10 sm:h-11 w-full border border-border bg-surface/30 pl-10 pr-24 text-sm font-normal text-fg placeholder:text-faint transition-colors focus:border-accent focus:bg-surface/50 focus:outline-none focus:ring-1 focus:ring-accent/30 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
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
                className="flex h-7 w-7 items-center justify-center text-faint transition-colors hover:text-fg"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="hidden border border-border/60 bg-surface-2/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-faint sm:inline-block">
                {isMac ? "⌘ K" : "Ctrl K"}
              </kbd>
            )}
          </div>
        </div>

        {/* Search Results Popover (Strict Priority over suggestions) */}
        {isOpen && debouncedQuery ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[380px] overflow-y-auto border border-border bg-bg p-1 shadow-2xl">
            {isScreenType(mediaType) ? (
              screenLoading && screenResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
                  <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
                  <span>
                    Searching TMDB {mediaType === "movie" ? "films" : "TV"}…
                  </span>
                </div>
              ) : screenError ? (
                <div className="py-6 text-center text-xs text-danger">
                  {screenError}
                </div>
              ) : screenResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  No {mediaType === "movie" ? "films" : "TV shows"} matching
                  &quot;{debouncedQuery}&quot;.
                </div>
              ) : (
                <div className="space-y-1">
                  {screenResults.map((item) => {
                    const key = `${item.kind}-${item.tmdbId}`;
                    const inLibrary = trackedScreen[key] === true;
                    const isAdding = screenAddingId === key;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 border-b border-border-subtle p-2.5 transition-colors last:border-b-0 hover:bg-surface-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Link
                            href={`/screen/${item.kind}/${item.tmdbId}`}
                            onClick={() => setIsOpen(false)}
                            className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-border bg-surface-3"
                          >
                            {item.posterUrl && isHttpUrl(item.posterUrl) ? (
                              <Image
                                src={item.posterUrl}
                                alt=""
                                fill
                                unoptimized
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : null}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/screen/${item.kind}/${item.tmdbId}`}
                              onClick={() => setIsOpen(false)}
                              className="line-clamp-1 text-[13px] font-semibold text-fg transition-colors hover:text-accent-strong"
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                              {item.voteAverage ? (
                                <span className="flex items-center gap-0.5 font-medium text-warning">
                                  <StarIcon className="h-3 w-3 fill-warning text-warning" />
                                  {item.voteAverage.toFixed(1)}
                                </span>
                              ) : null}
                              {item.year ? (
                                <>
                                  <span>·</span>
                                  <span>{item.year}</span>
                                </>
                              ) : null}
                              <span>·</span>
                              <span>
                                {item.kind === "movie" ? "Film" : "TV"}
                              </span>
                            </p>
                          </div>
                        </div>
                        {inLibrary ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-accent-strong">
                            <CheckIcon className="h-2.5 w-2.5" />
                            Tracked
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => void handleTrackScreen(item)}
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-accent px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-60"
                          >
                            {isAdding ? (
                              <LoaderIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlusIcon className="h-3 w-3" />
                            )}
                            <span>{isAdding ? "Adding…" : "+ Track"}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : loading && results.length === 0 ? (
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

      {/* Expandable Suggestions Drawer (Opt-in; yields when search results are active) */}
      {showSuggestions && !isScreenType(mediaType) && !(isOpen && debouncedQuery) ? (
        <div className="mt-2.5 border border-border/80 bg-surface/30 p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border-subtle/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-strong">
                {untrackedItems.length > 0
                  ? `Recommended for you · Untracked ${mediaType}`
                  : `Trending ${mediaType}`}
              </span>
              {sourcePool.length > PAGE_SIZE ? (
                <button
                  type="button"
                  onClick={handleShuffle}
                  title="Cycle to next recommendations"
                  className="inline-flex items-center gap-1 border border-border/80 bg-surface/60 px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:border-accent hover:text-fg"
                >
                  <RefreshIcon className="h-3 w-3" />
                  <span>Shuffle</span>
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-faint sm:inline">
                1-click add to planning
              </span>
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="inline-flex items-center gap-1 border-b border-transparent text-[10px] font-medium text-muted hover:border-accent hover:text-fg transition-colors"
                aria-label="Collapse suggestions"
              >
                <CloseIcon className="h-3 w-3" />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          {allTracked ? (
            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-success shrink-0" />
                <span>
                  You&apos;ve tracked all top recommendations! Use the search bar
                  above to track any title.
                </span>
              </div>
              <Link
                href={exploreAllHref}
                className="text-accent-strong hover:underline text-xs font-medium shrink-0 ml-2"
              >
                Browse catalog &rarr;
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {displayedItems.map((anime) => {
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
                    className="group relative flex items-center gap-2.5 border border-border/60 bg-surface/40 p-2 transition-colors hover:border-border hover:bg-surface-2/60"
                  >
                    {/* Poster Thumbnail */}
                    <Link
                      href={`/media/${anime.id}`}
                      className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-border bg-surface-3"
                      title={`View ${title}`}
                    >
                      {cover && isHttpUrl(cover) ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          sizes="40px"
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

                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                        {score ? (
                          <span className="flex items-center gap-0.5 font-medium text-warning">
                            <StarIcon className="h-2.5 w-2.5 fill-warning text-warning" />
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
                        ) : anime.chapters ? (
                          <>
                            <span>·</span>
                            <span>{anime.chapters} ch</span>
                          </>
                        ) : null}
                      </div>

                      {/* Action button */}
                      <div className="mt-1">
                        {isTracked ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.08em] text-accent-strong">
                            <CheckIcon className="h-2.5 w-2.5" />
                            <span>In library</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isAdding}
                            onClick={() => void handleAdd(anime)}
                            className="inline-flex h-6 items-center gap-1 border border-border bg-surface-2/80 px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-fg transition-colors hover:border-accent hover:text-accent-strong disabled:opacity-60"
                          >
                            {isAdding ? (
                              <LoaderIcon className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <PlusIcon className="h-2.5 w-2.5" />
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
