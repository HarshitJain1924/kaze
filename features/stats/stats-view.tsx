"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  BookmarkIcon,
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CrownIcon,
  FilmIcon,
  FlameIcon,
  InfoIcon,
  LibraryIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { LinkButton } from "@/components/ui/link-button";
import { calculateStats } from "@/features/stats/calculate-stats";
import type { LibraryStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, formatFormat, isHttpUrl } from "@/lib/utils";
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
  badgeClass: string;
  accentColor: string;
}

function getOtakuTier(episodes: number): OtakuTier {
  if (episodes >= 3000) {
    return {
      name: "Legendary Archon",
      level: "Tier VI",
      minEpisodes: 3000,
      nextMin: 5000,
      badgeClass: "border-amber-400/50 bg-amber-500/15 text-amber-300",
      accentColor: "#f59e0b",
    };
  }
  if (episodes >= 1500) {
    return {
      name: "Grandmaster Scholar",
      level: "Tier V",
      minEpisodes: 1500,
      nextMin: 3000,
      badgeClass: "border-purple-400/50 bg-purple-500/15 text-purple-300",
      accentColor: "#a855f7",
    };
  }
  if (episodes >= 750) {
    return {
      name: "Master Connoisseur",
      level: "Tier IV",
      minEpisodes: 750,
      nextMin: 1500,
      badgeClass: "border-violet-400/50 bg-violet-500/15 text-violet-300",
      accentColor: "#8b5cf6",
    };
  }
  if (episodes >= 250) {
    return {
      name: "Dedicated Otaku",
      level: "Tier III",
      minEpisodes: 250,
      nextMin: 750,
      badgeClass: "border-cyan-400/50 bg-cyan-500/15 text-cyan-300",
      accentColor: "#06b6d4",
    };
  }
  if (episodes >= 50) {
    return {
      name: "Active Watcher",
      level: "Tier II",
      minEpisodes: 50,
      nextMin: 250,
      badgeClass: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300",
      accentColor: "#10b981",
    };
  }
  return {
    name: "Novice Scout",
    level: "Tier I",
    minEpisodes: 0,
    nextMin: 50,
    badgeClass: "border-white/20 bg-white/10 text-white/80",
    accentColor: "#71717a",
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

const STATUS_ICONS: Record<WatchStatus, React.ComponentType<{ className?: string }>> = {
  watching: PlayIcon,
  completed: CheckIcon,
  planning: BookmarkIcon,
  on_hold: ClockIcon,
  dropped: CloseIcon,
};

const STATUS_GLOWS: Record<WatchStatus, { border: string; bg: string; text: string; dotShadow: string }> = {
  watching: {
    border: "hover:border-violet-500/50 hover:bg-violet-500/10",
    bg: "bg-violet-500/15",
    text: "text-violet-300",
    dotShadow: "0 0 10px rgba(139, 92, 246, 0.8)",
  },
  completed: {
    border: "hover:border-emerald-500/50 hover:bg-emerald-500/10",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dotShadow: "0 0 10px rgba(16, 185, 129, 0.8)",
  },
  planning: {
    border: "hover:border-cyan-500/50 hover:bg-cyan-500/10",
    bg: "bg-cyan-500/15",
    text: "text-cyan-300",
    dotShadow: "0 0 10px rgba(6, 182, 212, 0.8)",
  },
  on_hold: {
    border: "hover:border-amber-500/50 hover:bg-amber-500/10",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    dotShadow: "0 0 10px rgba(245, 158, 11, 0.8)",
  },
  dropped: {
    border: "hover:border-rose-500/50 hover:bg-rose-500/10",
    bg: "bg-rose-500/15",
    text: "text-rose-300",
    dotShadow: "0 0 10px rgba(244, 63, 94, 0.8)",
  },
};

const GENRE_STYLES: Record<string, { bg: string; text: string; bar: string }> = {
  Action: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-300", bar: "bg-rose-500" },
  Adventure: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-300", bar: "bg-amber-500" },
  Fantasy: { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-300", bar: "bg-purple-500" },
  Comedy: { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-300", bar: "bg-yellow-500" },
  Supernatural: { bg: "bg-violet-500/15 border-violet-500/30", text: "text-violet-300", bar: "bg-violet-500" },
  Drama: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-300", bar: "bg-sky-500" },
  "Sci-Fi": { bg: "bg-cyan-500/15 border-cyan-500/30", text: "text-cyan-300", bar: "bg-cyan-500" },
  Romance: { bg: "bg-pink-500/15 border-pink-500/30", text: "text-pink-300", bar: "bg-pink-500" },
  Mystery: { bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-300", bar: "bg-indigo-500" },
  "Slice of Life": { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-300", bar: "bg-emerald-500" },
  Sports: { bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-300", bar: "bg-orange-500" },
  Psychological: { bg: "bg-teal-500/15 border-teal-500/30", text: "text-teal-300", bar: "bg-teal-500" },
};

function getGenreStyle(genre: string) {
  return (
    GENRE_STYLES[genre] ?? {
      bg: "bg-accent/15 border-accent/30",
      text: "text-accent-strong",
      bar: "bg-accent",
    }
  );
}

function StatKpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  glowColor,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext: string;
  glowColor: string;
  iconClass: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-surface-2 p-4 sm:p-5 transition-all duration-300 hover:border-white/20 hover:bg-surface-3 shadow-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: glowColor }}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-xs transition-transform duration-300 group-hover:scale-110",
            iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </p>

      <p className="mt-1 text-xs text-white/50">{subtext}</p>
    </div>
  );
}

/**
 * Modern Luxury Radial Telemetry Gauge
 * Replaces the corny linear progress bars with an interactive circular ring gauge and dynamic center readout hub.
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
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~427.256

  const total = stats.total || 1;
  const activeCount = WATCH_STATUS_ORDER.filter(
    (status) => stats.statusCounts[status] > 0,
  ).length;

  const gapAnglePx = activeCount > 1 ? 5 : 0;
  const totalGapsPx = gapAnglePx * activeCount;
  const usableCircumference = Math.max(0, circumference - totalGapsPx);

  let accumulatedLength = 0;

  const segments = WATCH_STATUS_ORDER.map((status) => {
    const count = stats.statusCounts[status];
    const meta = WATCH_STATUS_META[status];
    if (count === 0) return null;

    const fraction = count / total;
    const arcLength = Math.max(1, fraction * usableCircumference);
    const offset = accumulatedLength;
    accumulatedLength += arcLength + gapAnglePx;

    const isHovered = activeStatus === status;

    return {
      status,
      label: meta.label,
      color: meta.color,
      count,
      percent: Math.round(fraction * 100),
      strokeDasharray: `${arcLength} ${circumference}`,
      strokeDashoffset: -offset,
      isHovered,
    };
  }).filter(Boolean);

  const completionPercent = Math.round(
    ((stats.statusCounts.completed || 0) / total) * 100,
  );

  const hoveredMeta = activeStatus ? WATCH_STATUS_META[activeStatus] : null;
  const displayCount = activeStatus
    ? stats.statusCounts[activeStatus]
    : stats.total;
  const displayLabel = hoveredMeta ? hoveredMeta.label : "Total Anime";
  const displaySub = activeStatus
    ? `${percent(stats.statusCounts[activeStatus], stats.total)}% of Library`
    : `${completionPercent}% Completed`;

  return (
    <div className="relative flex flex-col items-center justify-center p-2">
      <div className="relative flex h-52 w-52 sm:h-60 sm:w-60 items-center justify-center">
        <svg
          viewBox="0 0 180 180"
          className="h-full w-full -rotate-90 transform"
        >
          {/* Track background */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
          />

          {/* Active Status Segments */}
          {segments.map((seg) => (
            <circle
              key={seg!.status}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={seg!.color}
              strokeWidth={seg!.isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={seg!.strokeDasharray}
              strokeDashoffset={seg!.strokeDashoffset}
              strokeLinecap="round"
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => onHoverStatus(seg!.status)}
              onMouseLeave={() => onHoverStatus(null)}
              style={{
                filter: seg!.isHovered
                  ? `drop-shadow(0 0 10px ${seg!.color})`
                  : `drop-shadow(0 0 4px ${seg!.color}66)`,
              }}
            />
          ))}
        </svg>

        {/* Center Readout Telemetry Hub */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none text-center">
          <span
            className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white tabular-nums transition-all"
            style={{
              color: hoveredMeta ? hoveredMeta.color : "#ffffff",
              textShadow: hoveredMeta ? `0 0 20px ${hoveredMeta.color}80` : undefined,
            }}
          >
            {displayCount}
          </span>
          <span className="mt-0.5 text-xs font-bold uppercase tracking-wider text-white/60">
            {displayLabel}
          </span>
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors",
              activeStatus
                ? "border-white/20 bg-white/10 text-white"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
            )}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: hoveredMeta ? hoveredMeta.color : "#10b981",
              }}
            />
            <span>{displaySub}</span>
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-white/40">Hover ring segments or tiles to inspect</p>
    </div>
  );
}

/**
 * Modern Multidimensional Genre Affinity Radar Chart
 * Replaces linear progress bars with an interactive spider/radar web mapping multidimensional taste.
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
  const radius = 92;
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
        <svg viewBox="0 0 300 300" className="h-full w-full select-none overflow-visible">
          <defs>
            <radialGradient id="radar-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

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
                stroke="rgba(255, 255, 255, 0.09)"
                strokeWidth={1}
                strokeDasharray={ring < 1.0 ? "3 3" : undefined}
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
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth={1}
              />
            );
          })}

          {/* Filled Radar Polygon */}
          <polygon
            points={polygonPath}
            fill="url(#radar-glow-grad)"
            stroke="#a78bfa"
            strokeWidth={2}
            className="transition-all duration-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.45)]"
          />

          {/* Axis Labels */}
          {axes.map((g, i) => {
            const angle = angles[i] ?? 0;
            const labelDist = radius + 20;
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
                  fill={isHovered ? "#ffffff" : "rgba(255, 255, 255, 0.65)"}
                  fontSize={10}
                  fontWeight={isHovered ? "bold" : "600"}
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
                {isHovered ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill="#a78bfa"
                    fillOpacity={0.4}
                    className="animate-ping"
                  />
                ) : null}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill={isHovered ? "#ffffff" : "#a78bfa"}
                  stroke={isHovered ? "#8b5cf6" : "#ffffff"}
                  strokeWidth={2}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Readout Telemetry */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none text-center">
          <span className="font-display text-2xl font-bold tracking-tight text-white tabular-nums">
            {hoveredGenre
              ? axes.find((a) => a.genre === hoveredGenre)?.count ?? ""
              : axes.length}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent-strong">
            {hoveredGenre ?? "Core Genres"}
          </span>
          <span className="text-[9px] text-white/40">
            {hoveredGenre ? "series tracked" : "affinity axes"}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-white/40">Hover axes or cards to inspect affinity</p>
    </div>
  );
}

export function StatsView() {
  const { items, loadError } = useLibrary();
  const stats = calculateStats(items);
  const [hoveredStatus, setHoveredStatus] = useState<WatchStatus | null>(null);
  const [hoveredGenre, setHoveredGenre] = useState<string | null>(null);

  // Top banner for atmospheric header background
  const ambientBanner = useMemo(() => {
    const withBanner = items
      .filter((it) => it.anime?.bannerImage)
      .sort((a, b) => (b.anime?.averageScore ?? 0) - (a.anime?.averageScore ?? 0));
    return withBanner[0]?.anime?.bannerImage ?? null;
  }, [items]);

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
    for (const item of items) {
      const fmt = item.anime?.format ?? "UNKNOWN";
      if (fmt !== "UNKNOWN") {
        map.set(fmt, (map.get(fmt) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([format, count]) => ({
        format,
        label: formatFormat(format as any) ?? format,
        count,
        percent: stats.total > 0 ? Math.round((count / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [items, stats.total]);

  // Era Breakdown
  const eraCounts = useMemo(() => {
    let modern2020s = 0;
    let golden2010s = 0;
    let digital2000s = 0;
    let classicPre2000 = 0;

    for (const item of items) {
      const year = item.anime?.seasonYear;
      if (!year) continue;
      if (year >= 2020) modern2020s += 1;
      else if (year >= 2010) golden2010s += 1;
      else if (year >= 2000) digital2000s += 1;
      else classicPre2000 += 1;
    }

    const totalWithYear = modern2020s + golden2010s + digital2000s + classicPre2000;
    if (totalWithYear === 0) return [];

    return [
      { label: "2020s (Modern Wave)", count: modern2020s, color: "bg-accent" },
      { label: "2010s (Golden Era)", count: golden2010s, color: "bg-cyan-500" },
      { label: "2000s (Digital Age)", count: digital2000s, color: "bg-emerald-500" },
      { label: "Classic (Pre-2000)", count: classicPre2000, color: "bg-amber-500" },
    ]
      .filter((e) => e.count > 0)
      .map((e) => ({
        ...e,
        percent: Math.round((e.count / totalWithYear) * 100),
      }));
  }, [items]);

  if (loadError && items.length === 0) {
    return (
      <ErrorState
        title="Statistics unavailable"
        message="Your library could not be loaded, so statistics cannot be calculated."
        action={<RetryButton />}
      />
    );
  }

  if (stats.total === 0) {
    return (
      <div className="space-y-6">
        <header className="rounded-3xl border border-white/10 bg-surface-2 p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Anime Watching Analytics
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Track your journey through Japanese animation with verified statistics.
          </p>
        </header>

        <EmptyState
          icon={<ChartIcon className="h-6 w-6 text-accent-strong" />}
          title="No anime in library yet"
          description="Add anime to your library and log episode progress to unlock deep statistics, watch time analytics, genre mastery, and collector ranks."
          action={
            <LinkButton href="/discover" variant="primary" size="sm">
              Discover Anime
            </LinkButton>
          }
        />
      </div>
    );
  }

  const completionRate = percent(stats.statusCounts.completed, stats.total);
  const maxScoreCount = Math.max(1, ...stats.scoreDistribution.map((b) => b.count));
  const topGenres = stats.genreDistribution.slice(0, 10);
  const maxGenreCount = Math.max(1, ...topGenres.map((g) => g.count));
  const top3Podium = topGenres.slice(0, 3);
  const otherGenres = topGenres.slice(3);

  return (
    <div className="space-y-7">
      {/* 1. Cinematic Hero Header & Collector Profile Showcase */}
      <header className="group relative isolate overflow-hidden rounded-3xl border border-white/15 bg-black/85 p-6 shadow-2xl sm:p-8">
        {ambientBanner && isHttpUrl(ambientBanner) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none overflow-hidden z-0"
          >
            <div className="absolute inset-0 scale-125 blur-3xl saturate-200 opacity-20">
              <Image
                src={ambientBanner}
                alt=""
                fill
                unoptimized
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
          </div>
        ) : null}

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          {/* Left Title & Otaku Tier */}
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-strong">
                Otaku Analytics
              </span>
              <span className="text-white/30">·</span>
              <span className="text-xs font-medium text-white/70">
                Live Library Intelligence
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl drop-shadow-sm">
              Your Watching Statistics
            </h1>

            <p className="text-xs leading-relaxed text-white/75 sm:text-sm">
              Derived from <span className="font-semibold text-white">{stats.total} titles</span> in your library. Verified episode records, personal ratings, and genre signatures.
            </p>

            {/* Otaku Rank & Collector Tier Badge */}
            <div className="inline-flex flex-wrap items-center gap-3 pt-1">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur-md",
                  tier.badgeClass,
                )}
              >
                <CrownIcon className="h-4 w-4" />
                <span>{tier.name}</span>
                <span className="rounded-md border border-white/20 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono">
                  {tier.level}
                </span>
              </div>

              {stats.episodesWatched < 3000 ? (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${tierProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums">
                    {stats.episodesWatched}/{tier.nextMin} eps
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Watch Time Showcase Deck */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5 backdrop-blur-md shadow-xl lg:max-w-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/15 text-amber-300 shadow-md">
              <ClockIcon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Total Watch Time
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                  {completionRate}% finished
                </span>
              </div>

              <p className="mt-0.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
                {watchTime.formatted}
              </p>

              <p className="text-[11px] text-white/60">
                {watchTime.totalHours} hours across {stats.episodesWatched.toLocaleString("en-US")} episodes
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Top Key KPI Metrics Grid */}
      <section aria-label="Library totals" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatKpiCard
          icon={LibraryIcon}
          label="Tracked Anime"
          value={stats.total}
          subtext={`${completionRate}% completion rate`}
          glowColor="#8b5cf6"
          iconClass="text-accent-strong"
        />
        <StatKpiCard
          icon={PlayIcon}
          label="Currently Watching"
          value={stats.statusCounts.watching}
          subtext={`${stats.statusCounts.on_hold} on hold · active shows`}
          glowColor="#a855f7"
          iconClass="text-purple-400"
        />
        <StatKpiCard
          icon={CheckIcon}
          label="Completed Series"
          value={stats.statusCounts.completed}
          subtext={`${stats.statusCounts.dropped} dropped series`}
          glowColor="#10b981"
          iconClass="text-emerald-400"
        />
        <StatKpiCard
          icon={ClockIcon}
          label="Episodes Logged"
          value={stats.episodesWatched}
          subtext={
            stats.entriesWithUnknownEpisodeTotals > 0
              ? `${stats.entriesWithUnknownEpisodeTotals} with unknown totals`
              : "100% verified progress"
          }
          glowColor="#f59e0b"
          iconClass="text-amber-400"
        />
      </section>

      {/* 3. Modern Luxury Status Telemetry Matrix (Replaces Dated Corny Bar) */}
      <section
        aria-labelledby="status-telemetry"
        className="space-y-5 rounded-3xl border border-white/10 bg-surface-2 p-5 sm:p-7 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent-strong radar-live-dot" />
            <div>
              <h2
                id="status-telemetry"
                className="font-display text-lg sm:text-xl font-bold tracking-tight text-white"
              >
                Library Status Telemetry
              </h2>
              <p className="text-xs text-white/60">
                Interactive radial ring gauge and live collection matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/library"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span>View Full Library</span>
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Radial Telemetry Showcase Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Futuristic Circular Ring Gauge */}
          <div className="lg:col-span-5 flex justify-center border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
            <StatusDonutTelemetry
              stats={stats}
              activeStatus={hoveredStatus}
              onHoverStatus={setHoveredStatus}
            />
          </div>

          {/* Right: Modern Bento Grid of Interactive Status Pods */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WATCH_STATUS_ORDER.map((status) => {
              const count = stats.statusCounts[status];
              const share = percent(count, stats.total);
              const meta = WATCH_STATUS_META[status];
              const Icon = STATUS_ICONS[status];
              const glow = STATUS_GLOWS[status];
              const isHovered = hoveredStatus === status;

              return (
                <Link
                  key={status}
                  href={`/library?status=${status}`}
                  onMouseEnter={() => setHoveredStatus(status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 shadow-sm",
                    isHovered
                      ? "border-white/40 bg-white/15 scale-[1.02] shadow-xl ring-1 ring-white/20"
                      : cn("border-white/10 bg-white/[0.03]", glow.border),
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full transition-transform duration-300 group-hover:scale-125"
                        style={{
                          backgroundColor: meta.color,
                          boxShadow: glow.dotShadow,
                        }}
                      />
                      <span className="text-xs font-bold text-white/90 group-hover:text-white">
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 group-hover:text-white transition-colors">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold tracking-tight text-white tabular-nums">
                      {count}
                    </span>
                    <span
                      className={cn(
                        "rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-bold tabular-nums",
                        glow.text,
                      )}
                    >
                      {share}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Ratings Distribution & Media Formats Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ratings Distribution */}
        <section
          aria-labelledby="rating-distribution"
          className="flex flex-col justify-between space-y-4 rounded-3xl border border-white/10 bg-surface-2 p-5 sm:p-6 shadow-lg backdrop-blur-md"
        >
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <StarIcon className="h-4 w-4 fill-amber-400 text-amber-400" />
                <h2
                  id="rating-distribution"
                  className="font-display text-base sm:text-lg font-bold text-white"
                >
                  Personal Ratings
                </h2>
              </div>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80 tabular-nums">
                {stats.averageScore !== null
                  ? `Mean: ★ ${stats.averageScore}/10`
                  : "No scores yet"}
              </span>
            </div>

            {stats.scoredCount > 0 ? (
              <div className="mt-4 space-y-4">
                <div className="flex h-44 items-end gap-1.5 sm:gap-2 pt-2">
                  {stats.scoreDistribution.map((bucket) => {
                    const height =
                      bucket.count === 0
                        ? 0
                        : Math.max(8, (bucket.count / maxScoreCount) * 100);
                    const isPeak = bucket.count === maxScoreCount && bucket.count > 0;

                    return (
                      <div
                        key={bucket.score}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${bucket.count} anime rated ${bucket.score}/10`}
                      >
                        <span className="text-[10px] font-bold tabular-nums text-white/70">
                          {bucket.count > 0 ? bucket.count : ""}
                        </span>
                        <div
                          className={cn(
                            "w-full rounded-t-lg transition-all duration-300",
                            isPeak
                              ? "bg-amber-400 shadow-md shadow-amber-400/20"
                              : bucket.count > 0
                                ? "bg-accent/80 hover:bg-accent"
                                : "bg-white/5",
                          )}
                          style={{ height: `${height}%` }}
                        />
                        <span
                          className={cn(
                            "text-[11px] font-bold tabular-nums",
                            isPeak ? "text-amber-300" : "text-white/50",
                          )}
                        >
                          {bucket.score}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/50">
                  <span>{stats.scoredCount} of {stats.total} titles scored</span>
                  <span>Personal 1–10 Ratings</span>
                </div>
              </div>
            ) : (
              /* Enhanced Empty Ratings State */
              <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-300 shadow-md">
                  <StarIcon className="h-6 w-6 fill-amber-400/40 text-amber-400" />
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-white">
                  No Personal Ratings Recorded Yet
                </h3>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/60">
                  Rate your anime from 1 to 10 in your library to unlock your personal rating curve, mean score analysis, and top-tier picks.
                </p>
                <Link
                  href="/library"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-contrast shadow-sm hover:bg-accent-hover transition-colors"
                >
                  <span>Go to Library to Score</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Media Formats Breakdown */}
        {formatCounts.length > 0 ? (
          <section
            aria-label="Format breakdown"
            className="flex flex-col justify-between space-y-4 rounded-3xl border border-white/10 bg-surface-2 p-5 sm:p-6 shadow-lg backdrop-blur-md"
          >
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FilmIcon className="h-4 w-4 text-accent-strong" />
                  <h3 className="font-display text-base sm:text-lg font-bold text-white">
                    Media Formats
                  </h3>
                </div>
                <span className="text-xs text-white/50">{formatCounts.length} types</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {formatCounts.map((fmt) => (
                  <div
                    key={fmt.format}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-bold text-accent-strong">
                        {fmt.label}
                      </span>
                      <span className="text-white/70">
                        {fmt.count} {fmt.count === 1 ? "title" : "titles"}
                      </span>
                    </div>
                    <span className="font-bold tabular-nums text-white">
                      {fmt.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {/* 5. Multidimensional Genre Affinity & Taste Matrix */}
      <section
        aria-labelledby="genre-affinity-matrix"
        className="space-y-6 rounded-3xl border border-white/10 bg-surface-2 p-5 sm:p-7 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <TrophyIcon className="h-5 w-5 text-amber-400" />
            <div>
              <h2
                id="genre-affinity-matrix"
                className="font-display text-lg sm:text-xl font-bold tracking-tight text-white"
              >
                Genre Affinity & Taste Matrix
              </h2>
              <p className="text-xs text-white/60">
                Multidimensional radar telemetry across your catalogue&apos;s genre spectrum
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              {stats.genreDistribution[0]?.genre ?? "Diverse"} Dominant
            </span>
          </div>
        </div>

        {/* Dual Panel Layout: Left Radar Web, Right Interactive Bento Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Precision SVG Radar Web */}
          <div className="lg:col-span-5 flex justify-center border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
            <GenreRadarChart
              genres={stats.genreDistribution}
              hoveredGenre={hoveredGenre}
              onHoverGenre={setHoveredGenre}
            />
          </div>

          {/* Right: Modern Bento Grid of Genre Taste Pods */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/50 px-1">
              <span>Top {topGenres.length} Genre Pillars</span>
              <span>Sorted by catalogue density</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {topGenres.map((genre, index) => {
                const isHovered = hoveredGenre === genre.genre;
                const share = percent(genre.count, stats.total);
                const isTop3 = index < 3;
                const style = getGenreStyle(genre.genre);

                return (
                  <Link
                    key={genre.genre}
                    href={`/library?genre=${encodeURIComponent(genre.genre)}`}
                    onMouseEnter={() => setHoveredGenre(genre.genre)}
                    onMouseLeave={() => setHoveredGenre(null)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border p-3.5 transition-all duration-300 shadow-sm",
                      isHovered
                        ? "border-accent bg-accent/15 scale-[1.03] shadow-lg ring-1 ring-accent/30 z-10"
                        : isTop3
                          ? "border-white/15 bg-white/[0.05] hover:border-white/30 hover:bg-white/[0.08]"
                          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
                          index === 0
                            ? "bg-amber-400 text-black font-extrabold"
                            : index === 1
                              ? "bg-cyan-400 text-black font-extrabold"
                              : index === 2
                                ? "bg-purple-400 text-black font-extrabold"
                                : "border border-white/10 bg-white/5 text-white/60",
                        )}
                      >
                        #{index + 1}
                      </span>
                      <span className="font-display text-base font-bold text-white tabular-nums">
                        {genre.count} <span className="text-[10px] font-normal text-white/40">titles</span>
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <h4 className="font-display text-sm font-bold text-white group-hover:text-accent-strong transition-colors line-clamp-1">
                        {genre.genre}
                      </h4>
                      <p className="mt-0.5 text-[11px] font-medium text-white/50">
                        <span className="font-bold text-white/80 tabular-nums">{share}%</span> of library
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.bar)} />
                      <span className={cn("text-[10px] font-semibold truncate", style.text)}>
                        {index === 0 ? "Primary Pillar" : index === 1 ? "Secondary Arc" : index === 2 ? "Core Foundation" : "Genre Affinity"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 6. Release Era Timeline */}
      {eraCounts.length > 0 ? (
        <section
          aria-label="Release era timeline"
          className="space-y-4 rounded-3xl border border-white/10 bg-surface-2 p-5 sm:p-6 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-cyan-400" />
              <h3 className="font-display text-base font-bold text-white">
                Release Eras
              </h3>
            </div>
            <span className="text-xs text-white/50">Broadcast decade</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {eraCounts.map((era) => (
              <div
                key={era.label}
                className="flex flex-col justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-xs"
              >
                <div className="flex items-center justify-between font-medium">
                  <span className="text-white/90 font-semibold">{era.label}</span>
                  <span className="tabular-nums font-bold text-white">
                    {era.percent}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/50">{era.count} series</p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", era.color)}
                    style={{ width: `${era.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Data Integrity & Verification Footnote */}
      <footer className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 text-xs text-white/60">
        <div className="flex items-center gap-2 font-semibold text-white/90">
          <InfoIcon className="h-4 w-4 text-accent-strong" />
          <span>Library Data Integrity Guarantee</span>
        </div>
        <p className="mt-1.5 leading-relaxed">
          Watch time calculations are calculated using verified broadcast runtimes (~24 minutes per standard TV episode) based on your real logged progress. No fabricated streaks or synthetic numbers are ever displayed.
        </p>
      </footer>
    </div>
  );
}