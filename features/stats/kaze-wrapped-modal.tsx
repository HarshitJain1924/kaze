"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CrownIcon,
  FilmIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import type { LibraryStats } from "@/features/stats/calculate-stats";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";
import { archiveRangeLabel, summarizeScreenLibrary } from "@/lib/wrapped";
import { cn, getDisplayTitle, isHttpUrl } from "@/lib/utils";

const TOTAL_SLIDES = 6;
/** Dwell time per slide before the story advances on its own. */
const AUTOPLAY_MS = 9000;
/** Anime episodes are counted at a flat 24 minutes, matching the stats page. */
const ANIME_EPISODE_MINUTES = 24;

interface KazeWrappedModalProps {
  stats: LibraryStats;
  items: LibraryItem[];
  /** Film and TV rows so Wrapped covers the whole archive, not just anime. */
  screenItems?: TmdbLibraryItem[];
  isOpen: boolean;
  onClose: () => void;
}

interface Archetype {
  title: string;
  subtitle: string;
  description: string;
  color: string;
}

interface HallEntry {
  key: string;
  title: string;
  cover: string | null;
  score: number;
  kind: string | null;
}

function determineArchetype(topGenre: string | null): Archetype {
  switch (topGenre) {
    case "Action":
      return {
        title: "The Shonen Titan",
        subtitle: "Adrenaline & unwavering resolve",
        description:
          "You thrive on high-stakes battles, friendship-fuelled power-ups and journeys against impossible odds. You never back down from a training arc.",
        color: "#f4566f",
      };
    case "Psychological":
    case "Mystery":
      return {
        title: "The Seinen Mastermind",
        subtitle: "Cerebral games & moral ambiguity",
        description:
          "You don't just watch stories, you dissect them. Mind games, plot twists and philosophical dilemmas are your natural habitat.",
        color: "#4cc4d9",
      };
    case "Romance":
    case "Drama":
      return {
        title: "The Emotional Alchemist",
        subtitle: "Heartstrings & unspoken words",
        description:
          "You feel every heartbeat, confession and bittersweet ending. You appreciate the delicate craft of human relationships and slow character growth.",
        color: "#ee7bab",
      };
    case "Fantasy":
    case "Adventure":
      return {
        title: "The Astral Voyager",
        subtitle: "Mythic realms & limitless wonder",
        description:
          "Dungeons, ancient prophecies and vast mythical continents call to you. You are forever heading past the mundane horizon.",
        color: "#b184f5",
      };
    case "Slice of Life":
    case "Comedy":
      return {
        title: "The Soul Healer",
        subtitle: "Warm tea & gentle afternoons",
        description:
          "You find joy in quiet everyday moments, wholesome laughter and cosy rhythm. Anime is your sanctuary of comfort and light.",
        color: "#5fc99a",
      };
    case "Sci-Fi":
      return {
        title: "The Cybernetic Futurist",
        subtitle: "Neon skies & quantum dilemmas",
        description:
          "Space frontiers, mecha duels and post-human evolution fuel your imagination. You live twenty years ahead in the timestream.",
        color: "#6aa7f5",
      };
    default:
      return {
        title: "The Versatile Connoisseur",
        subtitle: "Eclectic taste & boundless curiosity",
        description:
          "You cannot be pigeonholed. Your list spans every genre, format and era — a true omnivore of visual storytelling.",
        color: "#a58cf0",
      };
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Counts a figure up on mount. It lives in its own component so each slide
 * appearance remounts it and the count always starts from zero — without an
 * extra state write in an effect.
 */
function CountedFigure({
  value,
  duration = 800,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let frame = 0;
    const started = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);

  return <>{display.toLocaleString("en-US")}</>;
}

function stagger(ms: number): CSSProperties {
  return { "--wrapped-delay": `${ms}ms` } as CSSProperties;
}

const METRIC_CLASS = "wrapped-rise border-b border-white/12 px-1 py-3";

export function KazeWrappedModal({
  stats,
  items,
  screenItems = [],
  isOpen,
  onClose,
}: KazeWrappedModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const topGenre = stats.genreDistribution[0]?.genre ?? null;
  const archetype = useMemo(() => determineArchetype(topGenre), [topGenre]);

  const screen = useMemo(
    () => summarizeScreenLibrary(screenItems),
    [screenItems],
  );

  const animeHours = Math.round(
    (stats.episodesWatched * ANIME_EPISODE_MINUTES) / 60,
  );
  const watchTimeHours = animeHours + screen.estimatedHours;

  const archiveLabel = useMemo(
    () =>
      archiveRangeLabel([
        ...items.map((item) => item.entry.createdAt),
        ...screenItems.map((item) => item.entry.createdAt),
      ]),
    [items, screenItems],
  );

  // Anime and film/TV ratings share the 0–10 scale, so one ranking is fair.
  const hallOfFame = useMemo<HallEntry[]>(() => {
    const anime: HallEntry[] = items
      .filter(
        (item) =>
          item.anime !== null &&
          item.entry.score !== null &&
          item.entry.score >= 8,
      )
      .map((item) => ({
        key: `anime-${item.entry.id}`,
        title: item.anime
          ? getDisplayTitle(item.anime.title, true)
          : "Untitled",
        cover:
          item.anime?.coverImage.extraLarge ??
          item.anime?.coverImage.large ??
          null,
        score: item.entry.score ?? 0,
        kind: null,
      }));

    const screenRated: HallEntry[] = screenItems
      .filter((item) => item.entry.score !== null && item.entry.score >= 8)
      .map((item) => ({
        key: `tmdb-${item.entry.id}`,
        title: item.entry.title,
        cover: item.entry.posterPath,
        score: item.entry.score ?? 0,
        kind: item.entry.mediaType === "tv" ? "TV" : "Film",
      }));

    return [...anime, ...screenRated]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [items, screenItems]);

  const isLastSlide = currentSlide === TOTAL_SLIDES - 1;
  const isAutoplaying = !paused && !hovering && !isLastSlide;

  const goTo = useCallback(
    (next: number) => {
      const target = Math.min(TOTAL_SLIDES - 1, Math.max(0, next));
      setDirection(target >= currentSlide ? 1 : -1);
      setCurrentSlide(target);
    },
    [currentSlide],
  );

  const handleClose = useCallback(() => {
    setCurrentSlide(0);
    setCopied(false);
    setPaused(false);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(currentSlide + 1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(currentSlide - 1);
      }
    },
    [currentSlide, goTo, handleClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  // Story autoplay. Reading is the point, so hovering or pressing pause holds
  // the current slide and the fill freezes with it.
  useEffect(() => {
    if (!isOpen || !isAutoplaying || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => goTo(currentSlide + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [currentSlide, goTo, isAutoplaying, isOpen]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  const summary = useMemo(
    () =>
      `My Kaze Wrapped (${archiveLabel}): ${stats.episodesWatched} anime episodes (~${animeHours}h), ${stats.statusCounts.completed} completed, ${screen.filmsWatched} films watched, ${screen.seriesFinished} series finished, ${screen.episodesWatched} TV episodes, ${stats.averageScore ?? "—"}/10 mean score.`,
    [
      archiveLabel,
      animeHours,
      screen.episodesWatched,
      screen.filmsWatched,
      screen.seriesFinished,
      stats.averageScore,
      stats.episodesWatched,
      stats.statusCounts.completed,
    ],
  );

  const handleShare = useCallback(async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Kaze Wrapped", text: summary });
        return;
      } catch {
        // Sharing was cancelled or blocked; fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [summary]);

  if (!isOpen) return null;

  const topGenreCount = stats.genreDistribution[0]?.count ?? 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kaze Wrapped"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close Wrapped"
        className="animate-fade fixed inset-0 cursor-default bg-black/92 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        tabIndex={-1}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="wrapped-panel relative z-10 flex h-[90vh] max-h-[720px] w-full max-w-[460px] flex-col overflow-hidden border border-white/12 bg-[#0a0b0e] text-white outline-none"
      >
        <p className="sr-only" aria-live="polite">
          Slide {currentSlide + 1} of {TOTAL_SLIDES}
        </p>

        {/* Segmented story progress */}
        <div
          role="tablist"
          aria-label="Wrapped slides"
          className="flex gap-1 px-4 pt-4"
        >
          {Array.from({ length: TOTAL_SLIDES }).map((_, index) => {
            const isCurrent = index === currentSlide;
            const isDone = index < currentSlide;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => goTo(index)}
                className="h-1 flex-1 overflow-hidden bg-white/12"
              >
                <span
                  className={cn(
                    "block h-full transition-all duration-500 ease-out",
                    isDone
                      ? "w-full bg-white/65"
                      : isCurrent
                        ? "wrapped-progress"
                        : "w-0",
                  )}
                  style={
                    isCurrent
                      ? {
                          backgroundColor: archetype.color,
                          animationDuration: `${AUTOPLAY_MS}ms`,
                          animationPlayState: isAutoplaying
                            ? "running"
                            : "paused",
                        }
                      : undefined
                  }
                />
              </button>
            );
          })}
        </div>

        {/* Masthead */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center bg-white text-[13px] font-bold leading-none text-black"
            >
              風
            </span>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-white/40">
                Kaze Wrapped
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
                {archiveLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Wrapped"
            className="flex h-8 w-8 items-center justify-center border border-white/15 text-white/65 transition-colors hover:border-white/40 hover:text-white active:translate-y-px"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Slide body: keyed so each slide replays its entrance */}
        <div
          key={currentSlide}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = swipeStartRef.current;
            swipeStartRef.current = null;
            if (!start) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
            goTo(currentSlide + (dx < 0 ? 1 : -1));
          }}
          className={cn(
            "wrapped-slide flex flex-1 flex-col overflow-y-auto px-5 pb-4",
            direction === -1 && "wrapped-shift-left",
          )}
        >
          {currentSlide === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p
                className="font-mono text-[9px] uppercase tracking-[0.24em]"
                style={{ color: archetype.color }}
              >
                01 / Screen time
              </p>

              <h2 className="mt-3 font-display text-[clamp(3.25rem,16vw,4.5rem)] font-semibold leading-[0.85] tracking-[-0.055em] tabular-nums">
                <CountedFigure value={stats.episodesWatched} />
              </h2>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Anime episodes watched
              </p>

              <div className="mt-7 border-t border-white/12 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                    Time in other worlds
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums">
                    <CountedFigure value={watchTimeHours} /> hrs
                  </span>
                </div>

                <div className="mt-3 h-[2px] w-full bg-white/12">
                  <div
                    className="wrapped-bar h-full"
                    style={{
                      width: `${Math.min(100, Math.max(4, (watchTimeHours / 1000) * 100))}%`,
                      backgroundColor: archetype.color,
                    }}
                  />
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-white/55">
                  {(watchTimeHours / 24).toFixed(1)} uninterrupted days —
                  anime at {ANIME_EPISODE_MINUTES} min an episode
                  {screen.estimatedHours > 0
                    ? `, plus ${screen.estimatedHours}h of film and television`
                    : ""}
                  .
                </p>
              </div>

              {stats.chaptersRead > 0 ? (
                <p className="mt-5 text-[12px] text-white/45">
                  Plus{" "}
                  <span className="font-semibold text-white/85">
                    {stats.chaptersRead.toLocaleString("en-US")} chapters
                  </span>{" "}
                  read and{" "}
                  <span className="font-semibold text-white/85">
                    {stats.statusCounts.completed}
                  </span>{" "}
                  titles finished.
                </p>
              ) : null}
            </div>
          ) : null}

          {currentSlide === 1 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                02 / Cinema &amp; television
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">
                Beyond anime
              </h2>

              {screen.filmsTracked + screen.seriesTracked === 0 ? (
                <p className="mt-5 border border-white/12 px-4 py-6 text-center text-[12px] leading-relaxed text-white/55">
                  No films or series tracked yet. Add one from the film and TV
                  shelves and its hours land here next time.
                </p>
              ) : (
                <>
                  <dl className="mt-5 grid grid-cols-2 border-t border-white/12">
                    {[
                      {
                        label: "Films watched",
                        value: screen.filmsWatched.toLocaleString("en-US"),
                      },
                      {
                        label: "Series finished",
                        value: screen.seriesFinished.toLocaleString("en-US"),
                      },
                      {
                        label: "TV episodes",
                        value: screen.episodesWatched.toLocaleString("en-US"),
                      },
                      {
                        label: "Screen hours",
                        value: `${screen.estimatedHours}h`,
                      },
                    ].map((metric, index) => (
                      <div
                        key={metric.label}
                        className={cn(
                          METRIC_CLASS,
                          index % 2 === 1 && "border-l border-white/12 pl-3",
                        )}
                        style={stagger(index * 60)}
                      >
                        <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-5 text-[12px] leading-relaxed text-white/50">
                    {screen.filmsTracked}{" "}
                    {screen.filmsTracked === 1 ? "film" : "films"} and{" "}
                    {screen.seriesTracked} in the archive, estimated at 2 h a
                    film and 45 min an episode.
                  </p>
                </>
              )}
            </div>
          ) : null}

          {currentSlide === 2 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                03 / Anime soul
              </p>

              <div
                className="mt-5 flex h-16 w-16 items-center justify-center border"
                style={{
                  borderColor: `${archetype.color}66`,
                  backgroundColor: `${archetype.color}14`,
                  color: archetype.color,
                }}
              >
                <CrownIcon className="h-7 w-7" />
              </div>

              <h2 className="mt-5 font-display text-[clamp(1.9rem,7vw,2.4rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
                {archetype.title}
              </h2>
              <p
                className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em]"
                style={{ color: archetype.color }}
              >
                {archetype.subtitle}
              </p>

              <div className="mt-5 border-t border-white/12 pt-4">
                <p className="text-[12.5px] leading-relaxed text-white/60">
                  {archetype.description}
                </p>
              </div>

              <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                Derived from{" "}
                {topGenre
                  ? `${topGenre} at the top of your list`
                  : "your genre spread"}
              </p>
            </div>
          ) : null}

          {currentSlide === 3 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                04 / Flavour palette
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">
                Top genres
              </h2>

              <div className="mt-5 border-t border-white/12">
                {stats.genreDistribution.slice(0, 5).map((genre, index) => {
                  const share = Math.round((genre.count / topGenreCount) * 100);
                  return (
                    <div
                      key={genre.genre}
                      className="wrapped-rise border-b border-white/12 py-3"
                      style={stagger(index * 70)}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-baseline gap-2.5">
                          <span className="font-mono text-[9px] tabular-nums text-white/30">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-display text-[15px] font-medium">
                            {genre.genre}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/50">
                          {genre.count} {genre.count === 1 ? "title" : "titles"}
                        </span>
                      </div>
                      <div className="mt-2 h-[2px] w-full bg-white/10">
                        <div
                          className="wrapped-bar h-full"
                          style={{
                            width: `${share}%`,
                            backgroundColor: archetype.color,
                            ...stagger(index * 70 + 90),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {(stats.genreDistribution[0]?.count ?? 0) > 0 ? (
                <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                  {stats.genreDistribution.length} genres across{" "}
                  {stats.total} tracked titles
                </p>
              ) : null}
            </div>
          ) : null}

          {currentSlide === 4 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                05 / Hall of fame
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">
                Highest rated
              </h2>

              {hallOfFame.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {hallOfFame.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="wrapped-rise border border-white/12 p-1.5"
                      style={stagger(index * 80)}
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
                        {entry.cover && isHttpUrl(entry.cover) ? (
                          <Image
                            src={entry.cover}
                            alt=""
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 42vw, 190px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FilmIcon className="h-6 w-6 text-white/20" />
                          </div>
                        )}
                        <span className="absolute right-0 top-0 inline-flex items-center gap-1 bg-black/80 px-1.5 py-1 font-mono text-[10px] font-semibold tabular-nums text-white">
                          <StarIcon className="h-2.5 w-2.5 fill-current" />
                          {entry.score}
                        </span>
                        {entry.kind ? (
                          <span className="absolute bottom-0 left-0 bg-black/80 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-white/70">
                            {entry.kind}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className="mt-2 line-clamp-1 font-display text-[12px] font-medium"
                        title={entry.title}
                      >
                        {entry.title}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 border border-white/12 px-4 py-6 text-center text-[12px] leading-relaxed text-white/55">
                  Score anything 8/10 or higher — anime, film or series — and it
                  appears here next time.
                </p>
              )}
            </div>
          ) : null}

          {currentSlide === 5 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                06 / Taste passport
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">
                {archetype.title}
              </h2>

              <dl className="mt-5 grid grid-cols-2 border-t border-white/12">
                {[
                  {
                    label: "Episodes",
                    value: stats.episodesWatched.toLocaleString("en-US"),
                  },
                  { label: "Watch time", value: `${watchTimeHours}h` },
                  {
                    label: "Completed",
                    value: stats.statusCounts.completed.toLocaleString("en-US"),
                  },
                  {
                    label: "Mean score",
                    value:
                      stats.averageScore !== null
                        ? `${stats.averageScore}/10`
                        : "—",
                  },
                  {
                    label: "Films watched",
                    value: screen.filmsWatched.toLocaleString("en-US"),
                  },
                  {
                    label: "Series finished",
                    value: screen.seriesFinished.toLocaleString("en-US"),
                  },
                ].map((metric, index) => (
                  <div
                    key={metric.label}
                    className={cn(
                      METRIC_CLASS,
                      index % 2 === 1 && "border-l border-white/12 pl-3",
                    )}
                    style={stagger(index * 60)}
                  >
                    <dt className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/40">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 font-display text-lg font-semibold tabular-nums">
                      {metric.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                {archiveLabel} · anime, manga, film &amp; TV
              </p>

              <button
                type="button"
                onClick={handleShare}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-white px-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-black transition-colors hover:bg-white/90 active:translate-y-px"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5" />
                    Copied to clipboard
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-3.5 w-3.5" />
                    Share summary
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>

        {/* Story controls */}
        <div className="flex items-center justify-between gap-2 border-t border-white/12 px-4 py-3">
          <button
            type="button"
            onClick={() => goTo(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="inline-flex h-9 items-center gap-1.5 border border-white/12 px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:pointer-events-none disabled:opacity-30 active:translate-y-px"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Resume autoplay" : "Pause autoplay"}
              className="flex h-9 w-9 items-center justify-center border border-white/12 text-white/60 transition-colors hover:border-white/35 hover:text-white active:translate-y-px"
            >
              {paused ? (
                <PlayIcon className="h-3.5 w-3.5" />
              ) : (
                <PauseIcon className="h-3.5 w-3.5" />
              )}
            </button>
            <span className="font-mono text-[10px] tabular-nums text-white/35">
              {String(currentSlide + 1).padStart(2, "0")} /{" "}
              {String(TOTAL_SLIDES).padStart(2, "0")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => goTo(currentSlide + 1)}
            disabled={isLastSlide}
            className="inline-flex h-9 items-center gap-1.5 bg-white px-3.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-black transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:bg-white/15 disabled:text-white/50 active:translate-y-px"
          >
            Next
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
