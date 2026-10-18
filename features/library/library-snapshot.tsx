"use client";

import Link from "next/link";

import {
  CheckIcon,
  ChevronRightIcon,
  InfoIcon,
  LibraryIcon,
  PlayIcon,
  SparkIcon,
} from "@/components/icons";
import { calculateStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  subtext,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="group/tile relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface-2/60 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-surface-2 hover:shadow-md">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {label}
        </span>
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg border",
            iconBg,
            iconColor,
          )}
        >
          {icon}
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-fg tabular-nums">
        {value}
      </p>
      {subtext ? (
        <p className="mt-0.5 text-[10px] font-medium text-faint">
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

export function LibrarySnapshot() {
  const { items } = useLibrary();
  const stats = calculateStats(items);

  if (stats.total === 0) {
    return null;
  }

  const maxCount = Math.max(
    1,
    ...WATCH_STATUS_ORDER.map((status) => stats.statusCounts[status]),
  );

  return (
    <section aria-label="Your library at a glance">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left card: Your Watching & Statistics */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] bg-surface/80 backdrop-blur-xl p-5 sm:p-6 shadow-lg shadow-black/20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
          />

          <div className="relative mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-strong" />
              </span>
              <h2 className="font-display text-base font-semibold tracking-tight text-fg">
                Your watching
              </h2>
            </div>
            <Link
              href="/stats"
              className="group inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Full statistics</span>
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="relative grid grid-cols-2 gap-2.5 sm:gap-3">
            <StatTile
              label="Tracked"
              value={stats.total}
              subtext="titles in library"
              icon={<LibraryIcon className="h-3.5 w-3.5" />}
              iconBg="bg-violet-500/10 border-violet-500/20"
              iconColor="text-violet-400"
            />
            <StatTile
              label="Watching"
              value={stats.statusCounts.watching}
              subtext="currently active"
              icon={<PlayIcon className="h-3.5 w-3.5" />}
              iconBg="bg-indigo-500/10 border-indigo-500/20"
              iconColor="text-indigo-400"
            />
            <StatTile
              label="Completed"
              value={stats.statusCounts.completed}
              subtext="series finished"
              icon={<CheckIcon className="h-3.5 w-3.5" />}
              iconBg="bg-emerald-500/10 border-emerald-500/20"
              iconColor="text-emerald-400"
            />
            <StatTile
              label="Episodes"
              value={stats.episodesWatched}
              subtext="recorded total"
              icon={<SparkIcon className="h-3.5 w-3.5" />}
              iconBg="bg-amber-500/10 border-amber-500/20"
              iconColor="text-amber-400"
            />
          </div>

          {stats.entriesWithUnknownEpisodeTotals > 0 ? (
            <div className="relative mt-3 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-2/40 px-3 py-2 text-[11px] text-faint">
              <InfoIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span>
                {stats.entriesWithUnknownEpisodeTotals} tracked{" "}
                {stats.entriesWithUnknownEpisodeTotals === 1
                  ? "title has"
                  : "titles have"}{" "}
                an unknown episode total; only recorded progress is counted.
              </span>
            </div>
          ) : null}
        </div>

        {/* Right card: Watchlist Status Breakdown */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] bg-surface/80 backdrop-blur-xl p-5 sm:p-6 shadow-lg shadow-black/20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl"
          />

          <div className="relative mb-3.5 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight text-fg">
              Watchlist
            </h2>
            <Link
              href="/library"
              className="group inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>Open library</span>
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Segmented Library Distribution Bar */}
          <div className="relative mb-4">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3/60 ring-1 ring-white/5">
              {WATCH_STATUS_ORDER.map((status) => {
                const count = stats.statusCounts[status];
                if (count === 0) return null;
                const widthPct = (count / stats.total) * 100;
                const meta = WATCH_STATUS_META[status];
                return (
                  <div
                    key={status}
                    title={`${meta.label}: ${count} (${Math.round(widthPct)}%)`}
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: meta.color,
                    }}
                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  />
                );
              })}
            </div>
          </div>

          <ul className="relative space-y-1.5">
            {WATCH_STATUS_ORDER.map((status) => {
              const count = stats.statusCounts[status];
              const meta = WATCH_STATUS_META[status];
              const hasEntries = count > 0;
              const pct = (count / maxCount) * 100;

              return (
                <li key={status}>
                  <Link
                    href={`/library?status=${status}`}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-1.5 transition-all duration-200 hover:bg-surface-2/80"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125",
                        hasEntries && "ring-2 ring-white/20",
                      )}
                      style={{ backgroundColor: meta.color }}
                    />
                    <span
                      className={cn(
                        "w-28 sm:w-32 shrink-0 text-xs font-medium transition-colors",
                        hasEntries
                          ? "text-fg group-hover:text-accent-strong"
                          : "text-muted",
                      )}
                    >
                      {meta.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3/50 ring-1 ring-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-6 text-right text-xs tabular-nums",
                        hasEntries
                          ? "font-bold text-fg group-hover:text-accent-strong"
                          : "font-normal text-faint",
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
