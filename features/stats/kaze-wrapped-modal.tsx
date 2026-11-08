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
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import type { LibraryStats } from "@/features/stats/calculate-stats";
import type { LibraryItem } from "@/types/library";
import { cn, getDisplayTitle, isHttpUrl } from "@/lib/utils";

const TOTAL_SLIDES = 5;

interface KazeWrappedModalProps {
  stats: LibraryStats;
  items: LibraryItem[];
  isOpen: boolean;
  onClose: () => void;
}

interface Archetype {
  title: string;
  subtitle: string;
  description: string;
  color: string;
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

export function KazeWrappedModal({
  stats,
  items,
  isOpen,
  onClose,
}: KazeWrappedModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const topGenre = stats.genreDistribution[0]?.genre ?? null;
  const archetype = useMemo(() => determineArchetype(topGenre), [topGenre]);

  const topRatedItems = useMemo(
    () =>
      items
        .filter((entry) => entry.entry.score !== null && entry.entry.score >= 8)
        .filter((entry) => entry.anime !== null)
        .sort((a, b) => (b.entry.score ?? 0) - (a.entry.score ?? 0))
        .slice(0, 4),
    [items],
  );

  const watchTimeHours = useMemo(
    () => Math.round((stats.episodesWatched * 24) / 60),
    [stats.episodesWatched],
  );

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

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const summary = `My Kaze Wrapped: ${archetype.title} — ${stats.episodesWatched} episodes (~${watchTimeHours}h), ${stats.statusCounts.completed} completed, ${stats.averageScore ?? "—"}/10 mean score.`;
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
  }, [
    archetype.title,
    stats.averageScore,
    stats.episodesWatched,
    stats.statusCounts.completed,
    watchTimeHours,
  ]);

  if (!isOpen) return null;

  const year = new Date().getFullYear();
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
                    isDone ? "w-full bg-white/65" : isCurrent ? "w-full" : "w-0",
                  )}
                  style={
                    isCurrent ? { backgroundColor: archetype.color } : undefined
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
                {year} Edition
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
                Episodes watched
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
                  {(watchTimeHours / 24).toFixed(1)} uninterrupted days, counted
                  at roughly 24 minutes an episode.
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
                02 / Anime soul
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
                Derived from {topGenre ? `${topGenre} at the top of your list` : "your genre spread"}
              </p>
            </div>
          ) : null}

          {currentSlide === 2 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                03 / Flavour palette
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

          {currentSlide === 3 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                04 / Hall of fame
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">
                Highest rated
              </h2>

              {topRatedItems.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {topRatedItems.map((item, index) => {
                    const title = item.anime
                      ? getDisplayTitle(item.anime.title, true)
                      : "Untitled";
                    const cover =
                      item.anime?.coverImage.large ??
                      item.anime?.coverImage.extraLarge ??
                      null;

                    return (
                      <div
                        key={item.entry.id}
                        className="wrapped-rise border border-white/12 p-1.5"
                        style={stagger(index * 80)}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
                          {cover && isHttpUrl(cover) ? (
                            <Image
                              src={cover}
                              alt=""
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 42vw, 190px"
                              className="object-cover"
                            />
                          ) : null}
                          <span className="absolute right-0 top-0 inline-flex items-center gap-1 bg-black/80 px-1.5 py-1 font-mono text-[10px] font-semibold tabular-nums text-white">
                            <StarIcon className="h-2.5 w-2.5 fill-current" />
                            {item.entry.score}
                          </span>
                        </div>
                        <p
                          className="mt-2 line-clamp-1 font-display text-[12px] font-medium"
                          title={title}
                        >
                          {title}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 border border-white/12 px-4 py-6 text-center text-[12px] leading-relaxed text-white/55">
                  Score titles 8/10 or higher in your library and they appear here
                  next time.
                </p>
              )}
            </div>
          ) : null}

          {currentSlide === 4 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                05 / Taste passport
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
                ].map((metric, index) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "wrapped-rise border-b border-white/12 px-1 py-3",
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
                Kaze · Private anime, manga, film &amp; TV index
              </p>

              <button
                type="button"
                onClick={handleCopy}
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
                    Copy summary
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

          <span className="font-mono text-[10px] tabular-nums text-white/35">
            {String(currentSlide + 1).padStart(2, "0")} /{" "}
            {String(TOTAL_SLIDES).padStart(2, "0")}
          </span>

          <button
            type="button"
            onClick={() => goTo(currentSlide + 1)}
            disabled={currentSlide === TOTAL_SLIDES - 1}
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
