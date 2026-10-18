"use client";

import Link from "next/link";

import { CheckIcon, LibraryIcon, PlayIcon } from "@/components/icons";
import { calculateStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn } from "@/lib/utils";

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-3">
      <div className="flex items-center gap-1.5 text-faint">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 font-display text-xl font-semibold tabular-nums text-fg">
        {value}
      </p>
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
        <div className="rounded-2xl border border-border-subtle bg-surface/70 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-fg">
              Your watching
            </h2>
            <Link
              href="/stats"
              className="text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              Full statistics
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              label="Tracked"
              value={stats.total}
              icon={<LibraryIcon className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Watching"
              value={stats.statusCounts.watching}
              icon={<PlayIcon className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Completed"
              value={stats.statusCounts.completed}
              icon={<CheckIcon className="h-3.5 w-3.5" />}
            />
          </div>
          <div className="mt-2.5 rounded-xl border border-border-subtle bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-faint">
                Episodes recorded
              </span>
              <span className="font-display text-lg font-semibold tabular-nums text-fg">
                {stats.episodesWatched}
              </span>
            </div>
            {stats.entriesWithUnknownEpisodeTotals > 0 ? (
              <p className="mt-1 text-[11px] leading-relaxed text-faint">
                {stats.entriesWithUnknownEpisodeTotals} tracked{" "}
                {stats.entriesWithUnknownEpisodeTotals === 1
                  ? "title has"
                  : "titles have"}{" "}
                an unknown episode total; only recorded progress is counted.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface/70 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-fg">
              Watchlist
            </h2>
            <Link
              href="/library"
              className="text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              Open library
            </Link>
          </div>
          <ul className="space-y-2.5">
            {WATCH_STATUS_ORDER.map((status) => {
              const count = stats.statusCounts[status];
              const meta = WATCH_STATUS_META[status];
              return (
                <li key={status}>
                  <Link
                    href={`/library?status=${status}`}
                    className="group flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-surface-2/70"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="w-28 shrink-0 text-xs font-medium text-muted sm:w-32">
                      {meta.label}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className={cn("block h-full rounded-full")}
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </span>
                    <span className="w-6 text-right text-xs font-semibold tabular-nums text-fg">
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
