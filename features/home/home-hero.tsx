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
import { OpticalGlass } from "@/components/ui/optical-glass";
import {
  useActiveTimeZone,
  usePreferences,
} from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { calculatePersonalContext } from "@/lib/discovery";
import { toIsoDateString } from "@/lib/schedule";
import { seasonLabel } from "@/lib/season";
import {
  cn,
  formatEpisodeCount,
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type {
  AiringScheduleEntry,
  AnimeSeason,
  AnimeSummary,
} from "@/types/anime";
import type { Viewer } from "@/types/viewer";

function getGreetingWord(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getHourInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    return Number.isFinite(hour) ? hour : date.getHours();
  } catch {
    return date.getHours();
  }
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
  todayEntries?: AiringScheduleEntry[] | null;
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
  todayEntries,
  serverHour,
  fallbackSummary,
}: HomeHeroProps) {
  const { preferences } = usePreferences();
  const { activeTimeZone, mounted } = useActiveTimeZone();
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % featuredList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredList.length, isHovered]);

  const currentAnime = featuredList[activeIndex] ?? null;

  // The server hour is only a hydration-safe fallback; after mount the
  // greeting follows the viewer's active timezone, not the server clock.
  const greetingWord = useMemo(() => {
    if (!mounted) {
      const hour = serverHour ?? new Date().getHours();
      return getGreetingWord(hour);
    }
    return getGreetingWord(getHourInTimeZone(new Date(), activeTimeZone));
  }, [activeTimeZone, mounted, serverHour]);

  // "Today" must match the schedule widgets, which group by active timezone.
  const today = useMemo<{ count: number; label: string | null }>(() => {
    if (!mounted) {
      return { count: todayCount, label: todayLabel ?? null };
    }
    const now = new Date();
    const todayIso = toIsoDateString(now, activeTimeZone);
    const count = (todayEntries ?? []).filter(
      (entry) =>
        toIsoDateString(new Date(entry.airingAt * 1000), activeTimeZone) ===
        todayIso,
    ).length;
    const label = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: activeTimeZone,
    }).format(now);
    return { count, label };
  }, [activeTimeZone, mounted, todayCount, todayEntries, todayLabel]);

  const viewerName = useMemo(() => {
    if (preferences.nickname?.trim()) return preferences.nickname.trim();
    if (viewer?.nickname?.trim()) return viewer.nickname.trim();
    if (!viewer?.email) return "Otaku";
    const username = viewer.email.split("@")[0];
    return username ? username.charAt(0).toUpperCase() + username.slice(1) : "Otaku";
  }, [preferences.nickname, viewer]);

  const { summaryText } = useMemo(() => {
    return calculatePersonalContext({
      viewer,
      items,
      todayEntries,
      activeTimeZone,
      titleLanguage: preferences.titleLanguage,
      fallbackSummary,
    });
  }, [
    viewer,
    items,
    todayEntries,
    activeTimeZone,
    preferences.titleLanguage,
    fallbackSummary,
  ]);

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

  const artwork = activeBanner ?? activeCover ?? "/hero-banner.jpg";
  const artworkIsRemote = isHttpUrl(artwork);

  return (
    <section
      aria-label="Seasonal feature"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative isolate border-y border-border bg-bg"
    >
      <div className="grid lg:grid-cols-[minmax(0,0.94fr)_minmax(400px,1.06fr)]">
        <div className="order-last flex min-w-0 flex-col justify-between gap-8 px-4 py-6 sm:px-7 sm:py-8 lg:order-first lg:px-8 lg:py-9 xl:px-10">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="h-1.5 w-1.5 bg-accent" />
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  Seasonal feature
                </p>
                <span className="text-[10px] text-faint">
                  {seasonLabel(season)} {year}
                </span>
              </div>
              <Link
                href="/schedule"
                className="group inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
              >
                <CalendarIcon className="h-3 w-3" />
                Broadcast week
                <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {currentAnime ? (
              <div className="mt-6 flex items-start gap-4 sm:gap-6">
                <Link
                  href={`/media/${currentAnime.id}`}
                  className="group/poster relative aspect-[2/3] w-[104px] shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-[148px] lg:w-[132px] xl:w-[152px]"
                  title={`View ${activeTitle}`}
                >
                  {activeCover && isHttpUrl(activeCover) ? (
                    <Image
                      key={`hero-poster-${currentAnime.id}`}
                      src={activeCover}
                      alt={`${activeTitle} poster`}
                      fill
                      priority
                      sizes="(max-width: 640px) 104px, (max-width: 1024px) 148px, 152px"
                      className="object-cover transition-transform duration-500 group-hover/poster:scale-[1.025]"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-surface-3" />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                    {activeFormat ? <span>{activeFormat}</span> : null}
                    {activeEpisodes ? (
                      <>
                        <span className="text-border">/</span>
                        <span>{activeEpisodes}</span>
                      </>
                    ) : null}
                    {activeScore ? (
                      <>
                        <span className="text-border">/</span>
                        <span className="inline-flex items-center gap-1 text-warning">
                          <StarIcon className="h-3 w-3 fill-current" />
                          {activeScore}
                        </span>
                      </>
                    ) : null}
                    {isHexColor(activeColor) ? (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeColor }}
                      />
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-balance font-display text-[26px] font-semibold leading-[1.04] tracking-[-0.045em] text-fg sm:text-[34px] lg:text-[34px] xl:text-[40px]">
                    <Link
                      href={`/media/${currentAnime.id}`}
                      className="transition-colors hover:text-accent-strong"
                    >
                      {activeTitle}
                    </Link>
                  </h2>

                  {currentAnime.genres?.length ? (
                    <p className="mt-2 line-clamp-1 text-[11px] text-faint">
                      {currentAnime.genres.slice(0, 4).join(" · ")}
                    </p>
                  ) : null}

                  <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-muted sm:text-[13px]">
                    <span className="font-medium text-fg">
                      Good {greetingWord}, {viewerName}.
                    </span>{" "}
                    {summaryText}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-7 max-w-xl">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  {today.label ?? "Broadcast week"}
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-fg">
                  Good {greetingWord}, {viewerName}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {summaryText}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {currentAnime ? (
              <div className="flex flex-wrap items-center gap-3">
                {currentEntry ? (
                  <button
                    type="button"
                    onClick={() => requestAdd(currentAnime)}
                    className="inline-flex h-10 items-center gap-2 border border-accent/60 bg-accent-soft px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-strong transition-colors hover:border-accent"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">
                      In watchlist ({currentEntry.status})
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestAdd(currentAnime)}
                    className="inline-flex h-10 items-center gap-2 bg-accent px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-contrast transition-colors hover:bg-accent-hover"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add to watchlist
                  </button>
                )}

                <Link
                  href={`/media/${currentAnime.id}`}
                  className="group inline-flex h-10 items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg transition-colors hover:text-accent-strong"
                >
                  <EyeIcon className="h-3.5 w-3.5 text-muted" />
                  View details
                  <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            ) : null}

            {featuredList.length > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <OpticalGlass
                    as="button"
                    variant="interactive"
                    type="button"
                    onClick={() =>
                      setActiveIndex(
                        (prev) =>
                          (prev - 1 + featuredList.length) % featuredList.length,
                      )
                    }
                    aria-label="Previous spotlight anime"
                    title="Previous spotlight"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 text-muted transition-colors hover:text-fg"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                  </OpticalGlass>
                  <span className="px-1 font-mono text-[10px] tabular-nums text-faint">
                    {String(activeIndex + 1).padStart(2, "0")} /{" "}
                    {String(featuredList.length).padStart(2, "0")}
                  </span>
                  <OpticalGlass
                    as="button"
                    variant="interactive"
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => (prev + 1) % featuredList.length)
                    }
                    aria-label="Next spotlight anime"
                    title="Next spotlight"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 text-muted transition-colors hover:text-fg"
                  >
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </OpticalGlass>
                </div>

                <div className="flex items-center gap-1.5" aria-label="Spotlight selections">
                  {featuredList.map((anime, index) => {
                    const isSelected = index === activeIndex;
                    const thumb =
                      anime.coverImage.large ?? anime.coverImage.extraLarge;
                    const title = getDisplayTitle(
                      anime.title,
                      preferences.titleLanguage === "english",
                    );

                    return (
                      <button
                        key={anime.id}
                        type="button"
                        aria-label={`Switch spotlight to ${title}`}
                        aria-pressed={isSelected}
                        onClick={() => setActiveIndex(index)}
                        className={cn(
                          "relative aspect-[2/3] w-8 overflow-hidden border transition-opacity sm:w-9",
                          isSelected
                            ? "border-accent opacity-100"
                            : "border-border opacity-55 hover:opacity-90",
                        )}
                      >
                        {thumb && isHttpUrl(thumb) ? (
                          <Image
                            src={thumb}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 bg-surface-3" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative order-first min-h-[230px] overflow-hidden border-b border-border bg-surface sm:min-h-[290px] lg:order-last lg:min-h-[470px] lg:border-b-0 lg:border-l">
          {artworkIsRemote ? (
            <Image
              key={`hero-art-${currentAnime?.id ?? "fallback"}`}
              src={artwork}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="object-cover object-[center_28%] transition-opacity duration-700"
            />
          ) : (
            <Image
              src="/hero-banner.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="object-cover object-[center_30%]"
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg/90 via-bg/30 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
            <OpticalGlass
              variant="pill"
              interactive={false}
              className="optical-glass-dark flex items-end justify-between gap-3 rounded-xl border border-white/20 px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-md"
            >
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  {seasonLabel(season)} {year} · Curated feature
                </p>
                <p className="mt-1 line-clamp-1 font-display text-sm font-medium text-white">
                  {activeTitle ?? "The current season, in focus"}
                </p>
              </div>
              {today.label ? (
                <p className="hidden text-[10px] text-white/70 sm:block">
                  {today.label}
                </p>
              ) : null}
            </OpticalGlass>
          </div>
        </div>
      </div>
    </section>
  );
}
