"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { CalendarIcon, ChevronRightIcon } from "@/components/icons";
import { useLibrary } from "@/features/library/library-provider";
import type { AnimeSeason, AnimeSummary } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

function getGreetingWord(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
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
  todayCount = 0,
  todayLabel,
  serverHour,
  fallbackSummary,
}: HomeHeroProps) {
  const { items } = useLibrary();

  const greetingWord = useMemo(() => {
    const hour = serverHour ?? new Date().getHours();
    return getGreetingWord(hour);
  }, [serverHour]);

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

  return (
    <header
      aria-label="Home banner"
      className="relative isolate overflow-hidden rounded-[22px] border border-border/70 bg-surface shadow-[0_18px_48px_-30px_rgba(0,0,0,0.9)]"
    >
      {/* Background artwork */}
      <div className="pointer-events-none absolute inset-0 select-none">
        <Image
          src="/hero-banner.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1400px"
          className="hero-art object-cover object-[75%_35%] sm:object-[68%_35%]"
        />
        {/* Contrast overlays: keep left text crisp while letting right atmospheric moon artwork shine through */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent sm:w-[62%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg/65 via-bg/10 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,var(--accent-soft),transparent_55%)]" />
      </div>

      {/* Content wrapper */}
      <div className="relative z-10 flex min-h-[148px] flex-col justify-between gap-5 p-6 sm:min-h-[160px] sm:flex-row sm:items-center sm:p-7 lg:px-8 lg:py-7">
        <div className="max-w-2xl min-w-0">
          {todayLabel ? (
            <p className="text-xs font-medium tracking-wide text-muted">
              {todayLabel}
            </p>
          ) : null}

          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-[34px]">
            Good <span className="text-accent-strong">{greetingWord}</span>
          </h1>

          <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-[13px]">
            {summaryText}
          </p>
        </div>

        <div className="shrink-0">
          <Link
            href="/schedule"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3.5 text-xs font-semibold text-fg shadow-sm backdrop-blur-md transition-all hover:border-accent/50 hover:bg-surface-3 active:scale-[0.98]"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted" />
            <span>Weekly schedule</span>
            <ChevronRightIcon className="h-3 w-3 text-faint" />
          </Link>
        </div>
      </div>
    </header>
  );
}
