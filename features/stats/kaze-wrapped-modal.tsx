"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  CloseIcon,
  CrownIcon,
  SparklesIcon,
  StarIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import type { LibraryStats } from "@/features/stats/calculate-stats";
import type { LibraryItem } from "@/types/library";
import { getDisplayTitle } from "@/lib/utils";

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
  gradient: string;
}

function determineArchetype(topGenre: string | null): Archetype {
  switch (topGenre) {
    case "Action":
      return {
        title: "The Shonen Titan",
        subtitle: "Adrenaline & Unwavering Resolve",
        description:
          "You thrive on high-stakes battles, friendship-fueled power-ups, and epic journeys against impossible odds. You never back down from a training arc.",
        color: "#f43f5e",
        gradient: "from-rose-500/30 via-orange-500/20 to-purple-900/40",
      };
    case "Psychological":
    case "Mystery":
      return {
        title: "The Seinen Mastermind",
        subtitle: "Cerebral Games & Moral Ambiguity",
        description:
          "You don't just watch stories; you dissect them. Mind games, plot twists, and complex philosophical dilemmas are your natural habitat.",
        color: "#06b6d4",
        gradient: "from-cyan-500/30 via-indigo-500/20 to-slate-900/40",
      };
    case "Romance":
    case "Drama":
      return {
        title: "The Emotional Alchemist",
        subtitle: "Heartstrings & Unspoken Words",
        description:
          "You feel every heartbeat, confession, and bittersweet heartbreak. You appreciate the delicate artistry of human relationships and character growth.",
        color: "#ec4899",
        gradient: "from-pink-500/30 via-rose-500/20 to-purple-900/40",
      };
    case "Fantasy":
    case "Adventure":
      return {
        title: "The Astral Voyager",
        subtitle: "Mythic Realms & Limitless Wonder",
        description:
          "Dungeons, ancient prophecies, and vast mythical continents call to you. You are forever exploring worlds beyond the mundane horizon.",
        color: "#a855f7",
        gradient: "from-purple-500/30 via-violet-500/20 to-indigo-950/40",
      };
    case "Slice of Life":
    case "Comedy":
      return {
        title: "The Soul Healer",
        subtitle: "Warm Tea & Gentle Afternoons",
        description:
          "You find pure joy in the quiet everyday moments, wholesome laughter, and cozy vibes. Anime is your sanctuary of comfort and light.",
        color: "#10b981",
        gradient: "from-emerald-500/30 via-teal-500/20 to-slate-900/40",
      };
    case "Sci-Fi":
      return {
        title: "The Cybernetic Futurist",
        subtitle: "Neon Skies & Quantum Dilemmas",
        description:
          "Space frontiers, mecha duels, and post-human evolution fuel your imagination. You live twenty years ahead in the timestream.",
        color: "#3b82f6",
        gradient: "from-blue-500/30 via-cyan-500/20 to-slate-900/40",
      };
    default:
      return {
        title: "The Versatile Connoisseur",
        subtitle: "Eclectic Taste & Boundless Curiosity",
        description:
          "You cannot be pigeonholed. Your watchlist spans every genre, format, and era — a true omnivore of visual storytelling.",
        color: "#8b5cf6",
        gradient: "from-violet-500/30 via-accent/20 to-slate-900/40",
      };
  }
}

export function KazeWrappedModal({
  stats,
  items,
  isOpen,
  onClose,
}: KazeWrappedModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const topGenre = stats.genreDistribution[0]?.genre ?? null;
  const archetype = useMemo(() => determineArchetype(topGenre), [topGenre]);

  const topRatedItems = useMemo(() => {
    return items
      .filter((i) => i.entry.score !== null && i.entry.score >= 8 && i.anime)
      .sort((a, b) => (b.entry.score ?? 0) - (a.entry.score ?? 0))
      .slice(0, 4);
  }, [items]);

  const watchTimeHours = useMemo(() => {
    return Math.round((stats.episodesWatched * 24) / 60);
  }, [stats.episodesWatched]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        setCurrentSlide((prev) => Math.min(prev + 1, 4));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const totalSlides = 5;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kaze Wrapped: Your Anime Journey"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Dynamic blurred atmospheric backdrop */}
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-2xl transition-opacity animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Story Container */}
      <div className="relative z-10 flex h-[90vh] max-h-[720px] w-full max-w-[480px] flex-col overflow-hidden rounded-[32px] border border-white/15 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
        {/* Ambient Top Glow */}
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[100px] opacity-40 bg-gradient-to-br ${archetype.gradient}`}
        />

        {/* Story Progress Indicators */}
        <div className="relative z-20 flex gap-1.5 px-5 pt-4">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/20 transition-all cursor-pointer"
            >
              <div
                className={`h-full bg-white transition-all duration-300 ${
                  idx <= currentSlide ? "w-full" : "w-0"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Top Action Bar */}
        <div className="relative z-20 flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/20 text-accent font-bold text-xs">
              風
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Kaze Wrapped
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close Wrapped"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Slide Content Area */}
        <div className="relative z-10 flex flex-1 flex-col justify-between p-6 overflow-y-auto">
          {/* SLIDE 0: Welcome & Screen Time */}
          {currentSlide === 0 && (
            <div className="flex flex-1 flex-col justify-center text-center animate-in fade-in zoom-in-95 duration-300">
              <span className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-strong mb-6">
                <SparklesIcon className="h-3.5 w-3.5" />
                Your Year in Anime
              </span>

              <h2 className="font-display text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
                {stats.episodesWatched}
              </h2>
              <p className="mt-1 text-sm font-medium uppercase tracking-widest text-white/60">
                Episodes Watched
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="flex items-center justify-center gap-2 text-accent">
                  <ClockIcon className="h-5 w-5" />
                  <span className="font-display text-2xl font-bold text-white">
                    ~{watchTimeHours} hrs
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/60">
                  That is {(watchTimeHours / 24).toFixed(1)} full uninterrupted days immersed in other worlds.
                </p>
              </div>

              {stats.chaptersRead > 0 ? (
                <p className="mt-6 text-xs text-white/50">
                  Plus <span className="font-semibold text-white/80">{stats.chaptersRead} manga chapters</span> devoured.
                </p>
              ) : null}
            </div>
          )}

          {/* SLIDE 1: Anime Soul Archetype */}
          {currentSlide === 1 && (
            <div className="flex flex-1 flex-col justify-center text-center animate-in fade-in zoom-in-95 duration-300">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">
                Your Anime Soul
              </span>

              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-gradient-to-tr from-accent/30 to-purple-500/20 shadow-[0_0_40px_rgba(139,92,246,0.3)] backdrop-blur-xl mb-6">
                <CrownIcon className="h-12 w-12 text-accent" />
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {archetype.title}
              </h2>
              <p className="mt-1 text-sm font-semibold" style={{ color: archetype.color }}>
                {archetype.subtitle}
              </p>

              <p className="mt-5 text-sm leading-relaxed text-white/70 px-4">
                {archetype.description}
              </p>
            </div>
          )}

          {/* SLIDE 2: Top Genres Breakdown */}
          {currentSlide === 2 && (
            <div className="flex flex-1 flex-col justify-center animate-in fade-in zoom-in-95 duration-300">
              <span className="text-center text-xs font-semibold uppercase tracking-widest text-white/50 mb-2">
                Your Flavor Palette
              </span>
              <h2 className="text-center font-display text-2xl font-bold text-white mb-6">
                Top Genres
              </h2>

              <div className="space-y-3">
                {stats.genreDistribution.slice(0, 5).map((g, i) => {
                  const maxCount = stats.genreDistribution[0]?.count ?? 1;
                  const pct = Math.round((g.count / maxCount) * 100);
                  return (
                    <div
                      key={g.genre}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-white flex items-center gap-2">
                          <span className="text-xs font-bold text-white/40">#{i + 1}</span>
                          {g.genre}
                        </span>
                        <span className="text-xs font-semibold text-accent">
                          {g.count} titles
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SLIDE 3: Hall of Fame */}
          {currentSlide === 3 && (
            <div className="flex flex-1 flex-col justify-center animate-in fade-in zoom-in-95 duration-300">
              <span className="text-center text-xs font-semibold uppercase tracking-widest text-white/50 mb-2">
                Hall of Fame
              </span>
              <h2 className="text-center font-display text-2xl font-bold text-white mb-6">
                Your Highest Rated
              </h2>

              {topRatedItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {topRatedItems.map((item) => (
                    <div
                      key={item.entry.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-2 backdrop-blur-md"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
                        {item.anime?.coverImage.large ? (
                          <Image
                            src={item.anime.coverImage.large}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        ) : null}
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-warning backdrop-blur-md">
                          <StarIcon className="h-3 w-3 fill-current" />
                          {item.entry.score}/10
                        </div>
                      </div>
                      <p className="mt-2 truncate text-xs font-semibold text-white">
                        {item.anime ? getDisplayTitle(item.anime.title, true) : "Anime"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                  Rate your favorite titles 8/10 or higher to populate your personal Hall of Fame!
                </div>
              )}
            </div>
          )}

          {/* SLIDE 4: Shareable Taste Passport */}
          {currentSlide === 4 && (
            <div className="flex flex-1 flex-col justify-center text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 to-white/5 p-6 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
                      Kaze Taste Passport
                    </p>
                    <p className="font-display text-lg font-bold text-white">
                      {archetype.title}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-contrast font-bold">
                    風
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <p className="text-[10px] text-white/50">Episodes</p>
                    <p className="text-base font-bold text-white">
                      {stats.episodesWatched}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <p className="text-[10px] text-white/50">Watch Time</p>
                    <p className="text-base font-bold text-white">
                      ~{watchTimeHours}h
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <p className="text-[10px] text-white/50">Completed</p>
                    <p className="text-base font-bold text-white">
                      {stats.statusCounts.completed}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <p className="text-[10px] text-white/50">Mean Score</p>
                    <p className="text-base font-bold text-white">
                      {stats.averageScore ? `${stats.averageScore}/10` : "—"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[11px] font-medium text-white/60 italic">
                  Tracked with Kaze — The Private Anime & Manga Vault
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `My Kaze Anime Soul is "${archetype.title}" with ${stats.episodesWatched} episodes watched (~${watchTimeHours} hours)! Track your anime on Kaze.`
                  );
                  alert("Copied your taste passport summary to clipboard!");
                }}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 px-6 text-xs font-bold text-accent-contrast transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-accent/30"
              >
                <SparklesIcon className="h-4 w-4" />
                Copy & Share Summary
              </button>
            </div>
          )}
        </div>

        {/* Bottom Carousel Controls */}
        <div className="relative z-20 flex items-center justify-between border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </button>

          <span className="text-xs font-medium text-white/40">
            {currentSlide + 1} / {totalSlides}
          </span>

          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1))}
            disabled={currentSlide === totalSlides - 1}
            className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none"
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
