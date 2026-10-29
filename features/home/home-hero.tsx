"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { seasonLabel } from "@/lib/season";
import {
  cn,
  formatEpisodeCount,
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSeason, AnimeSummary } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

function getGreetingWord(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function isHexColor(value: string | null): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

interface HomeHeroProps {
  viewer: Viewer | null;
  season: AnimeSeason;
  year: number;
  posters: AnimeSummary[];
  todayCount?: number;
  todayLabel?: string;
  serverHour?: number;
  fallbackSummary?: string;
}

export function HomeHero({
  viewer,
  season,
  year,
  posters,
  todayCount = 0,
  todayLabel,
  serverHour,
  fallbackSummary,
}: HomeHeroProps) {
  const { preferences } = usePreferences();
  const { items, entryFor, requestAdd } = useLibrary();

  // Top spotlight anime candidates (up to 5 for slideshow showcase)
  const featuredList = useMemo(() => {
    return (posters ?? []).slice(0, 5);
  }, [posters]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance spotlight every 8 seconds unless user is hovering
  useEffect(() => {
    if (featuredList.length <= 1 || isHovered) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredList.length, isHovered]);

  const currentAnime = featuredList[activeIndex] ?? null;

  const greetingWord = useMemo(() => {
    const hour = serverHour ?? new Date().getHours();
    return getGreetingWord(hour);
  }, [serverHour]);

  const viewerName = useMemo(() => {
    if (preferences.nickname?.trim()) return preferences.nickname.trim();
    if (viewer?.nickname?.trim()) return viewer.nickname.trim();
    if (!viewer?.email) return "Otaku";
    const username = viewer.email.split("@")[0];
    return username ? username.charAt(0).toUpperCase() + username.slice(1) : "Otaku";
  }, [preferences.nickname, viewer]);

  // Compute how many episodes behind the user is across currently watching anime
  const { episodesBehind, seriesBehind } = useMemo(() => {
    let epCount = 0;
    let seriesCount = 0;

    for (const item of items) {
      if (item.entry.status === "watching" && item.anime) {
        const total = item.anime.episodes;
        const progress = item.entry.progress;
        if (total !== null && total > 0 && progress < total) {
          const behind = total - progress;
          epCount += behind;
          seriesCount += 1;
        }
      }
    }

    return { episodesBehind: epCount, seriesBehind: seriesCount };
  }, [items]);

  const summaryText = useMemo(() => {
    if (fallbackSummary) return fallbackSummary;

    const episodesTodayText =
      todayCount === 1 ? "1 episode airs today." : `${todayCount} episodes air today.`;

    if (!viewer) {
      return `${episodesTodayText} Track your watch progress and follow the broadcast week.`;
    }

    if (seriesBehind > 0) {
      const epWord = episodesBehind === 1 ? "episode" : "episodes";
      const seriesWord = seriesBehind === 1 ? "series" : "series";
      return `${episodesTodayText} You're ${episodesBehind} ${epWord} behind across ${seriesBehind} ${seriesWord}.`;
    }

    if (items.some((it) => it.entry.status === "watching")) {
      return `${episodesTodayText} You're all caught up on your tracked series.`;
    }

    return `${episodesTodayText} Add anime to your library to track upcoming releases.`;
  }, [fallbackSummary, todayCount, viewer, seriesBehind, episodesBehind, items]);

  const activeTitle = currentAnime
    ? getDisplayTitle(currentAnime.title, preferences.titleLanguage === "english")
    : null;
  const activeCover = currentAnime
    ? currentAnime.coverImage.extraLarge ?? currentAnime.coverImage.large
    : null;
  const activeBanner = currentAnime?.bannerImage ?? null;
  const activeScore = currentAnime ? formatScore(currentAnime.averageScore) : null;
  const activeFormat = currentAnime ? formatFormat(currentAnime.format) : null;
  const activeEpisodes = currentAnime
    ? formatEpisodeCount(currentAnime.episodes, { short: true })
    : null;
  const activeColor = currentAnime?.coverImage.color ?? null;
  const currentEntry = currentAnime ? entryFor(currentAnime.id) : null;

  // The artwork for the backdrop: prefer widescreen 4K banner, fallback to cover, then hero banner
  const backdropArt = activeBanner ?? activeCover ?? "/hero-banner.jpg";

  return (
    <header
      aria-label="Seasonal spotlight banner"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative isolate overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl transition-all"
    >
      {/* 4K Multi-Layer Ambient Backdrop (Mirrors Anime Details Page) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden z-0"
      >
        {/* Layer 1: Ambient atmospheric color aura (diffused saturated color bleeding into surroundings) */}
        {isHttpUrl(backdropArt) ? (
          <div className="absolute inset-0 scale-125 blur-[65px] saturate-[2.5] brightness-125 opacity-70">
            <Image
              key={`ambient-aura-${currentAnime?.id ?? "default"}`}
              src={backdropArt}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        {/* Layer 2: 4K Source Artwork with native CDN sharpness */}
        {activeBanner && isHttpUrl(activeBanner) ? (
          <div className="absolute inset-0">
            <Image
              key={`hero-banner-${currentAnime?.id}`}
              src={activeBanner}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover object-[center_25%] opacity-90 transition-opacity duration-700 ease-out"
            />
          </div>
        ) : activeCover && isHttpUrl(activeCover) ? (
          <div className="absolute inset-0">
            <Image
              key={`hero-cover-${currentAnime?.id}`}
              src={activeCover}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="scale-105 object-cover object-center opacity-50 blur-md transition-opacity duration-700 ease-out"
            />
          </div>
        ) : (
          <div className="absolute inset-0">
            <Image
              src="/hero-banner.jpg"
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover object-[75%_35%] opacity-70"
            />
          </div>
        )}

        {/* Layer 3: Dynamic anime dominant color tint */}
        {isHexColor(activeColor) ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-30 mix-blend-screen transition-opacity duration-700"
            style={{
              background: `radial-gradient(ellipse 90% 70% at 75% 25%, ${activeColor}99 0%, transparent 65%)`,
            }}
          />
        ) : null}

        {/* Layer 4: Multi-directional gradient blending - preserves artwork vibrance */}
        {/* Soft left gradient so text and vertical poster have contrast; right 60% is completely clear */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 via-45% to-transparent" />
        {/* Top scrim for header row visibility */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
        {/* Organic bottom fade that dissolves seamlessly */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent via-25% to-transparent" />
      </div>

      {/* Main Foreground Container */}
      <div className="relative z-10 flex flex-col justify-between gap-5 p-4 sm:p-6 lg:p-7">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
              Seasonal Spotlight · {seasonLabel(season)} {year}
            </span>
            {todayLabel ? (
              <>
                <span className="text-white/25">·</span>
                <span className="text-xs font-medium text-white/70">
                  {todayLabel}
                </span>
              </>
            ) : null}
          </div>

          <Link
            href="/schedule"
            className="inline-flex h-7 items-center gap-1.5 rounded-xl border border-white/15 bg-black/40 px-3 text-[11px] font-semibold text-white/90 backdrop-blur-md transition-all hover:border-accent hover:bg-black/60 hover:text-white active:scale-98"
          >
            <CalendarIcon className="h-3 w-3 text-accent-strong" />
            <span>Weekly Schedule</span>
            <ChevronRightIcon className="h-3 w-3 text-white/40" />
          </Link>
        </div>

        {/* Hero Poster + Liquid Glass Card (Identical Structure to Anime Detail Page) */}
        {currentAnime ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
            {/* 4K Detail-Screen Style Vertical Poster Card */}
            <Link
              href={`/anime/${currentAnime.id}`}
              className="group/poster relative aspect-[2/3] w-32 shrink-0 self-start sm:self-center overflow-hidden rounded-2xl border border-white/20 bg-surface-2 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.35)] ring-1 ring-white/15 transition-transform duration-300 hover:scale-[1.02] sm:w-44 lg:w-48"
              title={`View ${activeTitle}`}
            >
              {activeCover && isHttpUrl(activeCover) ? (
                <Image
                  key={`hero-poster-${currentAnime.id}`}
                  src={activeCover}
                  alt={`${activeTitle} poster`}
                  fill
                  priority
                  unoptimized
                  sizes="(max-width: 640px) 128px, (max-width: 1024px) 176px, 192px"
                  className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-3" />
              )}

              {activeScore ? (
                <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/75 px-2 py-0.5 text-xs font-bold text-amber-300 tabular-nums shadow-sm backdrop-blur-md">
                  <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{activeScore}</span>
                </span>
              ) : null}
            </Link>

            {/* Liquid-Glass Detail Header Info Card */}
            <div className="min-w-0 flex-1">
              <div className="liquid-glass rounded-3xl p-5 sm:p-6 lg:p-7 border border-white/15 shadow-2xl">
                {/* Badges row with liquid-glass-pill */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {currentAnime.status ? (
                    <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-[11px] font-semibold tracking-wide border-success/30 bg-success/15 text-success">
                      Airing
                    </span>
                  ) : null}

                  {activeFormat ? (
                    <span className="inline-flex items-center rounded-xl liquid-glass-pill px-2.5 py-1 text-[11px] font-medium text-white/90">
                      {activeFormat}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center rounded-xl liquid-glass-pill px-2.5 py-1 text-[11px] font-medium text-white/90">
                    {seasonLabel(season)} {year}
                  </span>

                  {activeEpisodes ? (
                    <span className="inline-flex items-center rounded-xl liquid-glass-pill px-2.5 py-1 text-[11px] font-medium text-white/90">
                      {activeEpisodes}
                    </span>
                  ) : null}

                  {currentAnime.genres?.slice(0, 3).map((genre) => (
                    <span
                      key={genre}
                      className="hidden sm:inline-flex items-center rounded-xl liquid-glass-pill px-2.5 py-1 text-[11px] font-medium text-white/75"
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                {/* Clean Title without Japanese subtitles */}
                <h1 className="mt-3 line-clamp-2 font-display text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-md sm:text-3xl lg:text-[34px]">
                  <Link
                    href={`/anime/${currentAnime.id}`}
                    className="hover:text-accent-strong transition-colors"
                  >
                    {activeTitle}
                  </Link>
                </h1>

                {/* Summary / Otaku Status */}
                <p className="mt-2 text-xs leading-relaxed text-white/80 sm:text-[13px]">
                  Good <span className="font-semibold text-accent-strong">{greetingWord}</span>, {viewerName}. {summaryText}
                </p>

                {/* Actions and Slideshow Switcher row */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {currentEntry ? (
                      <button
                        type="button"
                        onClick={() => requestAdd(currentAnime)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-accent/50 bg-accent/25 px-4 text-xs font-semibold text-accent-strong shadow-sm backdrop-blur-md transition-all hover:bg-accent/35 active:scale-98"
                      >
                        <CheckIcon className="h-3.5 w-3.5 text-accent-strong" />
                        <span className="capitalize">
                          In Watchlist ({currentEntry.status})
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestAdd(currentAnime)}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-contrast shadow-sm transition-all hover:bg-accent-hover active:scale-98"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        <span>Add to Watchlist</span>
                      </button>
                    )}

                    <Link
                      href={`/anime/${currentAnime.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/20 bg-black/40 px-3.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition-all hover:border-white/40 hover:bg-black/60 active:scale-98"
                    >
                      <EyeIcon className="h-3.5 w-3.5 text-white/70" />
                      <span>View Anime Details</span>
                      <ChevronRightIcon className="h-3 w-3 text-white/50" />
                    </Link>
                  </div>

                  {/* Spotlight Selector Thumbnails (The Slideshow Switcher) */}
                  {featuredList.length > 1 ? (
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIndex(
                              (prev) =>
                                (prev - 1 + featuredList.length) %
                                featuredList.length,
                            )
                          }
                          aria-label="Previous spotlight anime"
                          title="Previous spotlight"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/80 hover:border-white/30 hover:bg-black/70 hover:text-white transition-all active:scale-95"
                        >
                          <ChevronLeftIcon className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50 px-1 hidden md:inline">
                          Spotlight ({activeIndex + 1}/{featuredList.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveIndex(
                              (prev) => (prev + 1) % featuredList.length,
                            )
                          }
                          aria-label="Next spotlight anime"
                          title="Next spotlight"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/40 text-white/80 hover:border-white/30 hover:bg-black/70 hover:text-white transition-all active:scale-95"
                        >
                          <ChevronRightIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {featuredList.map((anime, index) => {
                          const isSelected = index === activeIndex;
                          const thumb = anime.coverImage.large ?? anime.coverImage.extraLarge;
                          const title = getDisplayTitle(anime.title, preferences.titleLanguage === "english");

                          return (
                            <button
                              key={anime.id}
                              type="button"
                              aria-label={`Switch spotlight to ${title}`}
                              onClick={() => setActiveIndex(index)}
                              className={cn(
                                "relative aspect-[2/3] w-9 sm:w-10 overflow-hidden rounded-xl border transition-all duration-200",
                                isSelected
                                  ? "border-accent ring-2 ring-accent scale-105 shadow-lg z-10"
                                  : "border-white/20 opacity-60 hover:opacity-100 hover:scale-102",
                              )}
                            >
                              {thumb && isHttpUrl(thumb) ? (
                                <Image
                                  src={thumb}
                                  alt=""
                                  fill
                                  unoptimized
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-surface-3" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium tracking-wide text-muted">
              {todayLabel ?? "Broadcast Schedule"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-[34px]">
              Good <span className="text-accent-strong">{greetingWord}</span>, {viewerName}
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-[13px]">
              {summaryText}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
