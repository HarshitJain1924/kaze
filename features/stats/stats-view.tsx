"use client";

import type { ScreenLibraryStats } from "@/features/stats/calculate-screen-stats";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import {
  BookmarkIcon,
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CrownIcon,
  FilmIcon,
  InfoIcon,
  LibraryIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import { RetryButton } from "@/components/retry-button";
import { LinkButton } from "@/components/ui/link-button";
import { useLibrary } from "@/features/library/library-provider";
import { calculateStats } from "@/features/stats/calculate-stats";
import type { LibraryStats } from "@/features/stats/calculate-stats";
import { KazeWrappedModal } from "@/features/stats/kaze-wrapped-modal";
import { ScreenInsights } from "@/features/stats/screen-insights";
import { useScreenLibraryItems } from "@/features/screen/use-screen-library";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, formatFormat } from "@/lib/utils";
import type { AnimeFormat } from "@/types/anime";
import type { WatchStatus } from "@/types/library";

function percent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

interface OtakuTier {
  name: string;
  level: string;
  minEpisodes: number;
  nextMin: number;
}

function getOtakuTier(episodes: number): OtakuTier {
  if (episodes >= 3000) {
    return {
      name: "Legendary Archon",
      level: "Tier VI",
      minEpisodes: 3000,
      nextMin: 5000,
    };
  }
  if (episodes >= 1500) {
    return {
      name: "Grandmaster Scholar",
      level: "Tier V",
      minEpisodes: 1500,
      nextMin: 3000,
    };
  }
  if (episodes >= 750) {
    return {
      name: "Master Connoisseur",
      level: "Tier IV",
      minEpisodes: 750,
      nextMin: 1500,
    };
  }
  if (episodes >= 250) {
    return {
      name: "Dedicated Otaku",
      level: "Tier III",
      minEpisodes: 250,
      nextMin: 750,
    };
  }
  if (episodes >= 50) {
    return {
      name: "Active Watcher",
      level: "Tier II",
      minEpisodes: 50,
      nextMin: 250,
    };
  }
  return {
    name: "Novice Scout",
    level: "Tier I",
    minEpisodes: 0,
    nextMin: 50,
  };
}

function calculateWatchTime(episodesWatched: number) {
  const totalMinutes = episodesWatched * 24;
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const totalHours = (totalMinutes / 60).toFixed(1);

  let formatted = "";
  if (days > 0) {
    formatted = `${days}d ${hours}h`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m`;
  } else {
    formatted = `${minutes}m`;
  }

  return { days, hours, minutes, totalHours, formatted };
}

const STATUS_ICONS: Record<
  WatchStatus,
  React.ComponentType<{ className?: string }>
> = {
  watching: PlayIcon,
  completed: CheckIcon,
  planning: BookmarkIcon,
  on_hold: ClockIcon,
  dropped: CloseIcon,
};

function StatKpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  accentClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext: string;
  accentClass?: string;
}) {
  return (
    <div className="group relative flex flex-col justify-between border border-border bg-surface/40 p-4 transition-colors hover:border-accent/50 hover:bg-surface">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center border border-border bg-surface-2 text-faint transition-colors group-hover:border-accent/40 group-hover:text-fg",
            accentClass,
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <div className="mt-3">
        <p className="font-mono text-2xl font-bold tracking-tight text-fg tabular-nums sm:text-3xl">
          {typeof value === "number" ? value.toLocaleString("en-US") : value}
        </p>
        <p className="mt-1 truncate text-[11px] uppercase tracking-[0.06em] text-faint">
          {subtext}
        </p>
      </div>
    </div>
  );
}

/**
 * Editorial Dial Telemetry Gauge
 * Precision SVG dial ring with crisp tabular center readout.
 */
function StatusDonutTelemetry({
  stats,
  activeStatus,
  onHoverStatus,
}: {
  stats: LibraryStats;
  activeStatus: WatchStatus | null;
  onHoverStatus: (status: WatchStatus | null) => void;
}) {
  const radius = 68;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~427.256

  const total = stats.total || 1;
  const activeCount = WATCH_STATUS_ORDER.filter(
    (status) => stats.statusCounts[status] > 0,
  ).length;

  const gapAnglePx = activeCount > 1 ? 4 : 0;
  const totalGapsPx = gapAnglePx * activeCount;
  const usableCircumference = Math.max(0, circumference - totalGapsPx);

  interface StatusSegment {
    status: WatchStatus;
    label: string;
    color: string;
    count: number;
    percent: number;
    strokeDasharray: string;
    strokeDashoffset: number;
    isHovered: boolean;
    arcLength: number;
    offset: number;
  }

  const segments = WATCH_STATUS_ORDER.reduce<StatusSegment[]>(
    (acc, status) => {
      const count = stats.statusCounts[status];
      if (count === 0) return acc;
      const meta = WATCH_STATUS_META[status];
      const fraction = count / total;
      const arcLength = Math.max(2, fraction * usableCircumference);
      const previous = acc[acc.length - 1];
      const offset = previous
        ? previous.offset + previous.arcLength + gapAnglePx
        : 0;

      acc.push({
        status,
        label: meta.label,
        color: meta.color,
        count,
        percent: Math.round(fraction * 100),
        strokeDasharray: `${arcLength} ${circumference}`,
        strokeDashoffset: -offset,
        isHovered: activeStatus === status,
        arcLength,
        offset,
      });
      return acc;
    },
    [],
  );

  const completionPercent = Math.round(
    ((stats.statusCounts.completed || 0) / total) * 100,
  );

  const hoveredMeta = activeStatus ? WATCH_STATUS_META[activeStatus] : null;
  const displayCount = activeStatus
    ? stats.statusCounts[activeStatus]
    : stats.total;
  const displayLabel = hoveredMeta ? hoveredMeta.label : "Total Titles";
  const displaySub = activeStatus
    ? `${percent(stats.statusCounts[activeStatus], stats.total)}% of archive`
    : `${completionPercent}% completed`;

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <div className="relative flex h-52 w-52 items-center justify-center sm:h-56 sm:w-56">
        <svg
          viewBox="0 0 180 180"
          className="h-full w-full -rotate-90 transform"
        >
          {/* Background track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />

          {/* Active status segments */}
          {segments.map((seg) => (
            <circle
              key={seg.status}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={seg.isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={seg.strokeDasharray}
              strokeDashoffset={seg.strokeDashoffset}
              strokeLinecap="butt"
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHoverStatus(seg.status)}
              onMouseLeave={() => onHoverStatus(null)}
              opacity={activeStatus && !seg.isHovered ? 0.35 : 1}
            />
          ))}
        </svg>

        {/* Center Readout Telemetry */}
        <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center text-center">
          <span className="font-mono text-4xl font-bold tracking-tight text-fg tabular-nums transition-colors sm:text-5xl">
            {displayCount}
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted">
            {displayLabel}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1.5 border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-fg/80">
            <span
              className="h-1.5 w-1.5 shrink-0"
              style={{
                backgroundColor: hoveredMeta
                  ? hoveredMeta.color
                  : "var(--accent)",
              }}
            />
            <span>{displaySub}</span>
          </span>
        </div>
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        Hover segment or card to inspect
      </p>
    </div>
  );
}

/**
 * Editorial Multidimensional Genre Affinity Radar Chart
 * Crisp concentric polygons with sharp vertex nodes.
 */
function GenreRadarChart({
  genres,
  hoveredGenre,
  onHoverGenre,
}: {
  genres: Array<{ genre: string; count: number }>;
  hoveredGenre: string | null;
  onHoverGenre: (genre: string | null) => void;
}) {
  const axes = genres.slice(0, 8);
  const count = axes.length;
  if (count < 3) return null;

  const cx = 150;
  const cy = 150;
  const radius = 90;
  const maxCount = Math.max(1, ...axes.map((g) => g.count));

  const angles = axes.map((_, i) => -Math.PI / 2 + (2 * Math.PI * i) / count);
  const rings = [0.25, 0.5, 0.75, 1.0];

  const dataPoints = axes.map((g, i) => {
    const angle = angles[i] ?? 0;
    const ratio = Math.max(0.12, g.count / maxCount);
    const x = cx + radius * ratio * Math.cos(angle);
    const y = cy + radius * ratio * Math.sin(angle);
    return { x, y, genre: g.genre, count: g.count, ratio };
  });

  const polygonPath = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        <svg
          viewBox="0 0 300 300"
          className="h-full w-full select-none overflow-visible"
        >
          {/* Concentric Web Polygons */}
          {rings.map((ring) => {
            const points = angles
              .map((angle) => {
                const x = cx + radius * ring * Math.cos(angle);
                const y = cy + radius * ring * Math.sin(angle);
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <polygon
                key={ring}
                points={points}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={ring < 1.0 ? "2 2" : undefined}
                opacity={0.8}
              />
            );
          })}

          {/* Spoke Axis Lines */}
          {angles.map((angle, i) => {
            const x = cx + radius * Math.cos(angle);
            const y = cy + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
                opacity={0.6}
              />
            );
          })}

          {/* Filled Radar Polygon */}
          <polygon
            points={polygonPath}
            fill="var(--accent)"
            fillOpacity={0.16}
            stroke="var(--accent)"
            strokeWidth={1.5}
            className="transition-all duration-300"
          />

          {/* Axis Labels */}
          {axes.map((g, i) => {
            const angle = angles[i] ?? 0;
            const labelDist = radius + 18;
            const x = cx + labelDist * Math.cos(angle);
            const y = cy + labelDist * Math.sin(angle);

            const isHovered = hoveredGenre === g.genre;
            let anchor: "start" | "middle" | "end" = "middle";
            if (Math.cos(angle) > 0.35) anchor = "start";
            else if (Math.cos(angle) < -0.35) anchor = "end";

            return (
              <g
                key={g.genre}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => onHoverGenre(g.genre)}
                onMouseLeave={() => onHoverGenre(null)}
              >
                <text
                  x={x}
                  y={y + 4}
                  textAnchor={anchor}
                  fill={isHovered ? "var(--fg)" : "var(--muted)"}
                  fontSize={10}
                  fontWeight={isHovered ? "700" : "500"}
                  className="select-none font-sans"
                >
                  {g.genre}
                </text>
              </g>
            );
          })}

          {/* Vertex Point Nodes */}
          {dataPoints.map((p) => {
            const isHovered = hoveredGenre === p.genre;
            return (
              <g
                key={p.genre}
                className="cursor-pointer"
                onMouseEnter={() => onHoverGenre(p.genre)}
                onMouseLeave={() => onHoverGenre(null)}
              >
                <rect
                  x={p.x - (isHovered ? 4 : 2.5)}
                  y={p.y - (isHovered ? 4 : 2.5)}
                  width={isHovered ? 8 : 5}
                  height={isHovered ? 8 : 5}
                  fill={isHovered ? "var(--fg)" : "var(--accent)"}
                  stroke="var(--border)"
                  strokeWidth={1}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Readout Telemetry */}
        <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center text-center">
          <span className="font-mono text-2xl font-bold tracking-tight text-fg tabular-nums">
            {hoveredGenre
              ? (axes.find((a) => a.genre === hoveredGenre)?.count ?? "")
              : axes.length}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            {hoveredGenre ?? "Core Genres"}
          </span>
          <span className="font-mono text-[9px] text-faint">
            {hoveredGenre ? "titles mapped" : "affinity axes"}
          </span>
        </div>
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
        Hover vertex or genre card to inspect
      </p>
    </div>
  );
}

export type StatsMediaFilter = "all" | "anime" | "manga" | "movie" | "tv";

export function StatsView({
  screenStats = null,
}: {
  screenStats?: ScreenLibraryStats | null;
}) {
  const { items, loadError, showAdult } = useLibrary();
  const [mediaFilter, setMediaFilter] = useState<StatsMediaFilter>("all");

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (showAdult || !item.anime?.isAdult) &&
          (mediaFilter === "all" ||
            (item.entry.mediaType ?? "anime") === mediaFilter),
      ),
    [items, mediaFilter, showAdult],
  );

  const stats = calculateStats(visibleItems);
  const [hoveredStatus, setHoveredStatus] = useState<WatchStatus | null>(null);
  const [hoveredGenre, setHoveredGenre] = useState<string | null>(null);
  const [isWrappedOpen, setIsWrappedOpen] = useState(false);
  // Wrapped covers films and TV too, so it needs the TMDB side of the library.
  const screenItems = useScreenLibraryItems();

  // Derived watch time
  const watchTime = useMemo(
    () => calculateWatchTime(stats.episodesWatched),
    [stats.episodesWatched],
  );

  // Otaku collector tier
  const tier = useMemo(
    () => getOtakuTier(stats.episodesWatched),
    [stats.episodesWatched],
  );

  const tierProgress = useMemo(() => {
    if (stats.episodesWatched >= tier.nextMin) return 100;
    const range = tier.nextMin - tier.minEpisodes;
    const progress = stats.episodesWatched - tier.minEpisodes;
    return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
  }, [stats.episodesWatched, tier]);

  // Format Breakdown
  const formatCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of visibleItems) {
      const fmt = item.anime?.format ?? "UNKNOWN";
      if (fmt !== "UNKNOWN") {
        map.set(fmt, (map.get(fmt) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([format, count]) => ({
        format,
        label: formatFormat(format as AnimeFormat) ?? format,
        count,
        percent: stats.total > 0 ? Math.round((count / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [visibleItems, stats.total]);

  // Era Breakdown
  const eraCounts = useMemo(() => {
    let modern2020s = 0;
    let golden2010s = 0;
    let digital2000s = 0;
    let classicPre2000 = 0;

    for (const item of visibleItems) {
      const year = item.anime?.seasonYear;
      if (!year) continue;
      if (year >= 2020) modern2020s += 1;
      else if (year >= 2010) golden2010s += 1;
      else if (year >= 2000) digital2000s += 1;
      else classicPre2000 += 1;
    }

    const totalWithYear =
      modern2020s + golden2010s + digital2000s + classicPre2000;
    if (totalWithYear === 0) return [];

    return [
      {
        label: "2020s (Modern Wave)",
        count: modern2020s,
        color: "bg-accent",
      },
      {
        label: "2010s (Golden Era)",
        count: golden2010s,
        color: "bg-accent/70",
      },
      {
        label: "2000s (Digital Age)",
        count: digital2000s,
        color: "bg-accent/45",
      },
      {
        label: "Classic (Pre-2000)",
        count: classicPre2000,
        color: "bg-accent/25",
      },
    ]
      .filter((e) => e.count > 0)
      .map((e) => ({
        ...e,
        percent: Math.round((e.count / totalWithYear) * 100),
      }));
  }, [visibleItems]);

  if (loadError && items.length === 0) {
    return (
      <ErrorState
        title="Statistics unavailable"
        message="Your library could not be loaded, so statistics cannot be calculated."
        action={<RetryButton />}
      />
    );
  }

  if (stats.total === 0 && (screenStats?.total ?? 0) === 0) {
    return (
      <div className="space-y-6">
        <header className="border border-border bg-surface/40 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Personal Archive · Analytics
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-fg sm:text-4xl">
            Archive Statistics
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted sm:text-sm">
            Track your journey through Japanese animation, manga, and cinema with
            verified runtime metrics and genre telemetry.
          </p>
        </header>

        <EmptyState
          icon={<ChartIcon className="h-6 w-6 text-accent-strong" />}
          title="No titles in this view"
          description="Add anime, manga, films, or TV series to your library and log progress to unlock verified statistics, genre telemetry, and collector ranks."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {mediaFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => setMediaFilter("all")}
                  className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg transition-colors hover:border-accent"
                >
                  Show all media
                </button>
              ) : null}
              <LinkButton href="/discover" variant="primary" size="sm">
                Discover titles
              </LinkButton>
            </div>
          }
        />
      </div>
    );
  }

  const completionRate = percent(stats.statusCounts.completed, stats.total);
  const maxScoreCount = Math.max(
    1,
    ...stats.scoreDistribution.map((b) => b.count),
  );
  const topGenres = stats.genreDistribution.slice(0, 9);

  const mediaFilterTabs: { id: StatsMediaFilter; label: string }[] = [
    { id: "all", label: "All media" },
    { id: "anime", label: "Anime" },
    { id: "manga", label: "Manga" },
    ...(screenStats && screenStats.total > 0
      ? [
          { id: "movie" as const, label: "Movies" },
          { id: "tv" as const, label: "TV Shows" },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* 1. Masthead: Editorial Header & Collector Rank Deck */}
      <header className="border border-border bg-surface/40 p-5 sm:p-7">
        <div>
          {/* Eyebrow Navigation Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-accent" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
                Personal Archive · Analytics &amp; Telemetry
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsWrappedOpen(true)}
                className="inline-flex h-7 items-center gap-1.5 border border-accent/60 bg-accent/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong transition-colors hover:bg-accent hover:text-accent-contrast active:translate-y-px"
              >
                <SparklesIcon className="h-3 w-3" />
                <span>Kaze Wrapped</span>
              </button>

              <Link
                href="/library"
                className="inline-flex h-7 items-center gap-1.5 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                <LibraryIcon className="h-3 w-3 text-accent-strong" />
                <span>Open Library</span>
                <ChevronRightIcon className="h-2.5 w-2.5 text-faint" />
              </Link>
            </div>
          </div>

          {/* Main Title & Collector Tier Spotlight Grid */}
          <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-fg">
                Archive Statistics
              </h1>
              <p className="mt-3 max-w-[36rem] text-[13px] leading-relaxed text-muted">
                Personal telemetry verified across{" "}
                <span className="font-mono font-medium text-fg">
                  {stats.total} titles
                </span>{" "}
                in your active catalog.{" "}
                <span className="font-mono font-medium text-fg tabular-nums">
                  {watchTime.formatted}
                </span>{" "}
                watch time logged ({watchTime.totalHours} hours) across{" "}
                {stats.episodesWatched.toLocaleString()} episodes and{" "}
                {stats.chaptersRead.toLocaleString()} manga chapters.
              </p>
            </div>

            {/* Collector Tier Spotlight Card */}
            <div className="border border-border bg-surface-2/60 p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <CrownIcon className="h-3.5 w-3.5 text-accent-strong" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
                    Collector Tier
                  </span>
                </div>
                <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-fg">
                  {tier.level}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold tracking-tight text-fg">
                  {tier.name}
                </h3>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {stats.episodesWatched.toLocaleString()} /{" "}
                  {tier.nextMin.toLocaleString()} eps
                </span>
              </div>

              {/* Ruled Progress Bar */}
              <div className="mt-2.5 h-1.5 w-full border border-border bg-surface-3">
                <div
                  className="h-full bg-accent transition-all duration-500"
                  style={{ width: `${tierProgress}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[10px]">
                <span className="text-muted">
                  {stats.episodesWatched >= tier.nextMin
                    ? "Maximum tier reached"
                    : `${(tier.nextMin - stats.episodesWatched).toLocaleString()} eps to next tier`}
                </span>
                <span className="font-mono font-medium text-accent-strong tabular-nums">
                  {tierProgress}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Films & TV: a separate archive, given its own band above the filters */}
      {screenStats && screenStats.total > 0 ? (
        <section
          aria-labelledby="screen-archive-heading"
          className="border-y border-border"
        >
          <div className="flex flex-wrap items-end justify-between gap-4 py-3.5">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                Screen archive
              </p>
              <h2
                id="screen-archive-heading"
                className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg"
              >
                Films &amp; TV
              </h2>
              <p className="mt-0.5 text-[11px] text-muted">
                Cinema and television sit outside the anime index and are
                counted separately.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/library?media=movie"
                className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
              >
                Film library
                <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/library?media=tv"
                className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
              >
                Series library
                <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/discover?type=movie"
                className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
              >
                Discover
                <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-5">
            {[
              {
                label: "Films tracked",
                value: screenStats.movieCount.toLocaleString("en-US"),
              },
              {
                label: "Films watched",
                value: screenStats.watchedFilms.toLocaleString("en-US"),
              },
              {
                label: "Series tracked",
                value: screenStats.tvCount.toLocaleString("en-US"),
              },
              {
                label: "Episodes logged",
                value: screenStats.episodesWatched.toLocaleString("en-US"),
              },
              {
                label: "Mean rating",
                value:
                  screenStats.averageScore !== null
                    ? screenStats.averageScore.toFixed(1)
                    : "—",
              },
            ].map((metric) => (
              <div key={metric.label} className="px-3 py-2.5">
                <dt className="text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                  {metric.label}
                </dt>
                <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* 3. Media Filter Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-2.5">
        <div
          role="tablist"
          aria-label="Filter statistics by media type"
          className="flex flex-wrap items-center gap-px border border-border bg-border"
        >
          {mediaFilterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mediaFilter === tab.id}
              onClick={() => setMediaFilter(tab.id)}
              className={cn(
                "h-8 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                mediaFilter === tab.id
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-[11px] text-faint">
          Derived from active library records
        </span>
      </div>

      {/* 3. Specialized View: Movies (when filtered) */}
      {mediaFilter === "movie" && screenStats ? (
        <div className="space-y-6">
          <section
            aria-label="Movie Statistics"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
          >
            <StatKpiCard
              icon={FilmIcon}
              label="Cinema Catalog"
              value={screenStats.movieCount}
              subtext="tracked films"
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={CheckIcon}
              label="Watched Films"
              value={screenStats.watchedFilms}
              subtext={`${percent(screenStats.watchedFilms, screenStats.movieCount)}% watched`}
              accentClass="text-success"
            />
            <StatKpiCard
              icon={StarIcon}
              label="Mean Rating"
              value={
                screenStats.averageScore !== null
                  ? `★ ${screenStats.averageScore.toFixed(1)}`
                  : "—"
              }
              subtext={`${screenStats.scoredCount} rated titles`}
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={BookmarkIcon}
              label="Plan to Watch"
              value={screenStats.statusCounts.planning}
              subtext="queued cinema"
              accentClass="text-fg"
            />
          </section>

          {/* Movie Status Matrix */}
          <section
            aria-label="Movie Status Breakdown"
            className="border border-border bg-surface/40 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-fg sm:text-lg">
                  Cinema Status Ledger
                </h2>
                <p className="text-xs text-muted">
                  Distribution of films across personal watch statuses
                </p>
              </div>
              <Link
                href="/library?media=movie"
                className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:border-accent hover:text-fg"
              >
                <span>Open Film Library</span>
                <ChevronRightIcon className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
              {WATCH_STATUS_ORDER.map((status) => {
                const count = screenStats.statusCounts[status];
                const share = percent(count, screenStats.movieCount);
                const meta = WATCH_STATUS_META[status];
                const Icon = STATUS_ICONS[status];

                return (
                  <Link
                    key={status}
                    href={`/library?media=movie&status=${status}`}
                    className="flex flex-col justify-between border border-border bg-surface/50 p-3.5 transition-colors hover:border-accent hover:bg-surface"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg">
                          {meta.label}
                        </span>
                      </div>
                      <Icon className="h-3.5 w-3.5 text-muted" />
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold tabular-nums text-fg">
                        {count}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {share}%
                      </span>
                    </div>

                    <div className="mt-2.5 h-0.5 w-full bg-surface-3">
                      <div
                        className="h-full"
                        style={{
                          width: `${share}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <ScreenInsights items={screenItems} kind="movie" />
        </div>
      ) : null}

      {/* 4. Specialized View: TV Shows (when filtered) */}
      {mediaFilter === "tv" && screenStats ? (
        <div className="space-y-6">
          <section
            aria-label="Television Statistics"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
          >
            <StatKpiCard
              icon={FilmIcon}
              label="Tracked Series"
              value={screenStats.tvCount}
              subtext="TV productions"
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={PlayIcon}
              label="In Progress"
              value={screenStats.statusCounts.watching}
              subtext="active broadcast series"
              accentClass="text-fg"
            />
            <StatKpiCard
              icon={ClockIcon}
              label="Episodes Logged"
              value={screenStats.episodesWatched}
              subtext="verified logged units"
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={StarIcon}
              label="Mean Rating"
              value={
                screenStats.averageScore !== null
                  ? `★ ${screenStats.averageScore.toFixed(1)}`
                  : "—"
              }
              subtext={`${screenStats.scoredCount} rated series`}
              accentClass="text-success"
            />
          </section>

          {/* TV Status Matrix */}
          <section
            aria-label="TV Series Status Breakdown"
            className="border border-border bg-surface/40 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-base font-semibold text-fg sm:text-lg">
                  Television Status Ledger
                </h2>
                <p className="text-xs text-muted">
                  Distribution of TV series across personal watch statuses
                </p>
              </div>
              <Link
                href="/library?media=tv"
                className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:border-accent hover:text-fg"
              >
                <span>Open TV Library</span>
                <ChevronRightIcon className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
              {WATCH_STATUS_ORDER.map((status) => {
                const count = screenStats.statusCounts[status];
                const share = percent(count, screenStats.tvCount);
                const meta = WATCH_STATUS_META[status];
                const Icon = STATUS_ICONS[status];

                return (
                  <Link
                    key={status}
                    href={`/library?media=tv&status=${status}`}
                    className="flex flex-col justify-between border border-border bg-surface/50 p-3.5 transition-colors hover:border-accent hover:bg-surface"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg">
                          {meta.label}
                        </span>
                      </div>
                      <Icon className="h-3.5 w-3.5 text-muted" />
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-mono text-2xl font-bold tabular-nums text-fg">
                        {count}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {share}%
                      </span>
                    </div>

                    <div className="mt-2.5 h-0.5 w-full bg-surface-3">
                      <div
                        className="h-full"
                        style={{
                          width: `${share}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <ScreenInsights items={screenItems} kind="tv" />
        </div>
      ) : null}

      {/* 5. Standard Unified Telemetry Grid (All Media / Anime / Manga) */}
      {mediaFilter !== "movie" && mediaFilter !== "tv" ? (
        <div className="space-y-6">
          {/* Main 4-Pod KPI Metric Ledger */}
          <section
            aria-label="Library totals"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
          >
            <StatKpiCard
              icon={LibraryIcon}
              label="Tracked Titles"
              value={stats.total}
              subtext={`${completionRate}% completion rate`}
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={ClockIcon}
              label="Total Watch Time"
              value={watchTime.formatted}
              subtext={`${watchTime.totalHours} hrs logged (~24m/ep)`}
              accentClass="text-accent-strong"
            />
            <StatKpiCard
              icon={PlayIcon}
              label={mediaFilter === "manga" ? "Chapters Read" : "Episodes Logged"}
              value={
                mediaFilter === "manga"
                  ? stats.chaptersRead
                  : stats.episodesWatched
              }
              subtext={
                mediaFilter === "manga"
                  ? `${stats.volumesRead} volumes logged`
                  : stats.chaptersRead > 0
                    ? `${stats.chaptersRead} manga chapters`
                    : "100% verified progress"
              }
              accentClass="text-fg"
            />
            <StatKpiCard
              icon={StarIcon}
              label="Personal Rating"
              value={
                stats.averageScore !== null
                  ? `★ ${stats.averageScore}/10`
                  : "—"
              }
              subtext={
                stats.scoredCount > 0
                  ? `${stats.scoredCount} of ${stats.total} scored`
                  : "No scores yet"
              }
              accentClass="text-success"
            />
          </section>

          {/* Status Distribution & Telemetry Section */}
          <section
            aria-labelledby="status-telemetry"
            className="border border-border bg-surface/40 p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  Telemetry Matrix
                </span>
                <h2
                  id="status-telemetry"
                  className="font-display text-base font-semibold tracking-tight text-fg sm:text-lg"
                >
                  Library Status Distribution
                </h2>
              </div>

              <Link
                href="/library"
                className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent hover:text-fg"
              >
                <span>View Full Library</span>
                <ChevronRightIcon className="h-3 w-3" />
              </Link>
            </div>

            {/* Radial Telemetry Showcase Layout */}
            <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              {/* Left: Precision SVG Donut Ring */}
              <div className="flex justify-center border-b border-border pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
                <StatusDonutTelemetry
                  stats={stats}
                  activeStatus={hoveredStatus}
                  onHoverStatus={setHoveredStatus}
                />
              </div>

              {/* Right: Ruled Bento Grid of Status Pods */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:col-span-7 sm:gap-3">
                {WATCH_STATUS_ORDER.map((status) => {
                  const count = stats.statusCounts[status];
                  const share = percent(count, stats.total);
                  const meta = WATCH_STATUS_META[status];
                  const Icon = STATUS_ICONS[status];
                  const isHovered = hoveredStatus === status;

                  return (
                    <Link
                      key={status}
                      href={`/library?status=${status}`}
                      onMouseEnter={() => setHoveredStatus(status)}
                      onMouseLeave={() => setHoveredStatus(null)}
                      className={cn(
                        "group relative flex flex-col justify-between border p-3.5 transition-all",
                        isHovered
                          ? "border-accent bg-accent/10"
                          : "border-border bg-surface/50 hover:border-accent/40 hover:bg-surface",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg">
                            {meta.label}
                          </span>
                        </div>
                        <Icon className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-fg" />
                      </div>

                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="font-mono text-2xl font-bold tabular-nums text-fg">
                          {count}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {share}%
                        </span>
                      </div>

                      {/* Ruled bottom accent track */}
                      <div className="mt-2.5 h-0.5 w-full bg-surface-3">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${share}%`,
                            backgroundColor: meta.color,
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Ratings Curve & Media Formats Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Ratings Histogram */}
            <section
              aria-labelledby="rating-distribution"
              className="flex flex-col justify-between border border-border bg-surface/40 p-5 sm:p-6"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <StarIcon className="h-4 w-4 text-accent-strong" />
                    <h2
                      id="rating-distribution"
                      className="font-display text-base font-semibold text-fg"
                    >
                      Personal Ratings Curve
                    </h2>
                  </div>
                  <span className="border border-border bg-surface px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-fg">
                    {stats.averageScore !== null
                      ? `Mean: ★ ${stats.averageScore}/10`
                      : "No ratings"}
                  </span>
                </div>

                {stats.scoredCount > 0 ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex h-44 items-end gap-1.5 pt-2 sm:gap-2">
                      {stats.scoreDistribution.map((bucket) => {
                        const height =
                          bucket.count === 0
                            ? 0
                            : Math.max(
                                8,
                                (bucket.count / maxScoreCount) * 100,
                              );
                        const isPeak =
                          bucket.count === maxScoreCount && bucket.count > 0;

                        return (
                          <div
                            key={bucket.score}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                            title={`${bucket.count} titles rated ${bucket.score}/10`}
                          >
                            <span className="font-mono text-[10px] tabular-nums text-muted">
                              {bucket.count > 0 ? bucket.count : ""}
                            </span>
                            <div
                              className={cn(
                                "w-full transition-all duration-300",
                                isPeak
                                  ? "bg-accent"
                                  : bucket.count > 0
                                    ? "bg-accent/80 hover:bg-accent"
                                    : "bg-surface-2",
                              )}
                              style={{ height: `${height}%` }}
                            />
                            <span
                              className={cn(
                                "font-mono text-[11px] tabular-nums",
                                isPeak ? "font-bold text-accent-strong" : "text-faint",
                              )}
                            >
                              {bucket.score}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[11px] text-faint">
                      <span>
                        {stats.scoredCount} of {stats.total} titles scored
                      </span>
                      <span>Personal 1–10 Scale</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col items-center justify-center border border-dashed border-border bg-surface-2/40 p-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center border border-border bg-surface text-accent-strong">
                      <StarIcon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-display text-sm font-semibold text-fg">
                      No Personal Ratings Recorded Yet
                    </h3>
                    <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
                      Score titles from 1 to 10 in your library to unlock your personal rating curve, mean score analysis, and top-tier picks.
                    </p>
                    <Link
                      href="/library"
                      className="mt-4 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
                    >
                      <span>Go to Library to Score</span>
                      <ChevronRightIcon className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            </section>

            {/* Media Formats Breakdown */}
            <section
              aria-label="Format breakdown"
              className="flex flex-col justify-between border border-border bg-surface/40 p-5 sm:p-6"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <FilmIcon className="h-4 w-4 text-accent-strong" />
                    <h3 className="font-display text-base font-semibold text-fg">
                      Media Formats
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-faint">
                    {formatCounts.length} formats
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  {formatCounts.length > 0 ? (
                    formatCounts.map((fmt) => (
                      <div
                        key={fmt.format}
                        className="flex flex-col gap-1.5 border border-border bg-surface-2/40 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                              {fmt.label}
                            </span>
                            <span className="text-muted">
                              {fmt.count} {fmt.count === 1 ? "title" : "titles"}
                            </span>
                          </div>
                          <span className="font-mono font-bold tabular-nums text-fg">
                            {fmt.percent}%
                          </span>
                        </div>

                        {/* Ruled meter track */}
                        <div className="mt-1 h-1 w-full border border-border bg-surface-3">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${fmt.percent}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted">
                      No format metadata available for this selection.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Genre Affinity & Radar Matrix */}
          <section
            aria-labelledby="genre-affinity-matrix"
            className="border border-border bg-surface/40 p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  Genre Affinity
                </span>
                <h2
                  id="genre-affinity-matrix"
                  className="font-display text-base font-semibold tracking-tight text-fg sm:text-lg"
                >
                  Taste &amp; Genre Architecture
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-strong">
                  {stats.genreDistribution[0]?.genre ?? "Diverse"} Dominant
                </span>
              </div>
            </div>

            {/* Radar Web & Bento Matrix Grid */}
            <div className="mt-5 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              {/* Left: Precision SVG Radar Web */}
              <div className="flex justify-center border-b border-border pb-6 lg:col-span-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
                <GenreRadarChart
                  genres={stats.genreDistribution}
                  hoveredGenre={hoveredGenre}
                  onHoverGenre={setHoveredGenre}
                />
              </div>

              {/* Right: Ranked Bento Grid of Top Genres */}
              <div className="space-y-3 lg:col-span-7">
                <div className="flex items-center justify-between font-mono text-[10px] text-faint">
                  <span>Top {topGenres.length} Genre Pillars</span>
                  <span>Sorted by catalog density</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {topGenres.map((genre, index) => {
                    const isHovered = hoveredGenre === genre.genre;
                    const share = percent(genre.count, stats.total);

                    return (
                      <Link
                        key={genre.genre}
                        href={`/library?genre=${encodeURIComponent(genre.genre)}`}
                        onMouseEnter={() => setHoveredGenre(genre.genre)}
                        onMouseLeave={() => setHoveredGenre(null)}
                        className={cn(
                          "group relative flex flex-col justify-between border p-3 transition-colors",
                          isHovered
                            ? "border-accent bg-accent/15"
                            : "border-border bg-surface-2/40 hover:border-accent hover:bg-surface-2",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold text-muted">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-xs font-bold tabular-nums text-fg">
                            {genre.count}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <h4 className="font-display text-sm font-semibold text-fg transition-colors group-hover:text-accent-strong">
                            {genre.genre}
                          </h4>
                          <p className="mt-0.5 font-mono text-[10px] text-faint">
                            {share}% of library
                          </p>
                        </div>

                        {/* Flush progress indicator */}
                        <div className="mt-2 h-0.5 w-full bg-surface-3">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${Math.min(100, share * 2)}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Release Era Timeline */}
          {eraCounts.length > 0 ? (
            <section
              aria-label="Release era timeline"
              className="border border-border bg-surface/40 p-5 sm:p-6"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-accent-strong" />
                  <h3 className="font-display text-base font-semibold text-fg">
                    Release Eras
                  </h3>
                </div>
                <span className="font-mono text-xs text-faint">
                  Broadcast decades
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
                {eraCounts.map((era) => (
                  <div
                    key={era.label}
                    className="flex flex-col justify-between border border-border bg-surface-2/40 p-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="font-semibold text-fg/90">
                        {era.label}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-fg">
                        {era.percent}%
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-faint">
                      {era.count} {era.count === 1 ? "series" : "series"}
                    </p>
                    <div className="mt-2.5 h-1 w-full border border-border bg-surface-3">
                      <div
                        className={cn("h-full", era.color)}
                        style={{ width: `${era.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* TMDB Films & TV Section (When viewing all media) */}
          {mediaFilter === "all" && screenStats && screenStats.total > 0 ? (
            <section
              aria-labelledby="films-tv-stats"
              className="border border-border bg-surface/40 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                    TMDB Archive · Cinema &amp; Television
                  </span>
                  <h2
                    id="films-tv-stats"
                    className="font-display text-base font-semibold text-fg sm:text-lg"
                  >
                    Films &amp; TV Telemetry
                  </h2>
                  <p className="text-xs text-muted">
                    {screenStats.movieCount} movies and {screenStats.tvCount} TV series
                    tracked outside Japanese animation
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/library?media=movie"
                    className="inline-flex items-center gap-1 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:border-accent hover:text-fg"
                  >
                    <span>Films</span>
                    <ChevronRightIcon className="h-2.5 w-2.5" />
                  </Link>
                  <Link
                    href="/library?media=tv"
                    className="inline-flex items-center gap-1 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted hover:border-accent hover:text-fg"
                  >
                    <span>TV Shows</span>
                    <ChevronRightIcon className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                <StatKpiCard
                  icon={FilmIcon}
                  label="Films Tracked"
                  value={screenStats.movieCount}
                  subtext={`${screenStats.watchedFilms} watched`}
                  accentClass="text-accent-strong"
                />
                <StatKpiCard
                  icon={PlayIcon}
                  label="TV Series"
                  value={screenStats.tvCount}
                  subtext={`${screenStats.statusCounts.watching} in progress`}
                  accentClass="text-fg"
                />
                <StatKpiCard
                  icon={ClockIcon}
                  label="Episodes Logged"
                  value={screenStats.episodesWatched}
                  subtext="verified logged units"
                  accentClass="text-accent-strong"
                />
                <StatKpiCard
                  icon={StarIcon}
                  label="Average Rating"
                  value={
                    screenStats.averageScore !== null
                      ? `★ ${screenStats.averageScore.toFixed(1)}`
                      : "—"
                  }
                  subtext={
                    screenStats.scoredCount > 0
                      ? `${screenStats.scoredCount} rated titles`
                      : "No ratings"
                  }
                  accentClass="text-success"
                />
              </div>

              {/* Status matrix row */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {WATCH_STATUS_ORDER.map((status) => (
                  <div
                    key={status}
                    className="border border-border bg-surface-2/40 p-2.5 text-xs"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {WATCH_STATUS_META[status].label}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums text-fg">
                      {screenStats.statusCounts[status]}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {/* 6. Data Integrity & Verification Footnote */}
      <footer className="border border-border bg-surface/30 p-4 text-xs text-muted sm:p-5">
        <div className="flex items-center gap-2 font-semibold text-fg">
          <InfoIcon className="h-4 w-4 text-accent-strong" />
          <span>Library Data Integrity Guarantee</span>
        </div>
        <p className="mt-1.5 leading-relaxed text-muted">
          Watch time calculations are calculated using verified broadcast runtimes
          (~24 minutes per standard TV episode) based strictly on your real logged progress.
          No synthetic streaks or fabricated telemetry numbers are displayed.
        </p>
      </footer>

      {/* Kaze Wrapped Modal Trigger */}
      <KazeWrappedModal
        stats={stats}
        items={visibleItems}
        screenItems={screenItems}
        isOpen={isWrappedOpen}
        onClose={() => setIsWrappedOpen(false)}
      />
    </div>
  );
}
