"use client";

import { ChartIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { LinkButton } from "@/components/ui/link-button";
import { calculateStats } from "@/features/stats/calculate-stats";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn } from "@/lib/utils";

function percent(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return Math.round((count / total) * 100);
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5",
        accent && "bg-accent-soft/60",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-fg">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-faint">{hint}</p> : null}
    </div>
  );
}

export function StatsView() {
  const { items, loadError } = useLibrary();
  const stats = calculateStats(items);

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
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
            Statistics
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Your watching
          </h1>
        </header>
        <EmptyState
          icon={<ChartIcon className="h-5 w-5" />}
          title="No statistics yet"
          description="Add anime to your library and mark episodes as watched. Statistics are built only from data you record."
          action={
            <LinkButton href="/discover" variant="primary" size="sm">
              Find anime
            </LinkButton>
          }
        />
      </div>
    );
  }

  const maxScoreCount = Math.max(
    1,
    ...stats.scoreDistribution.map((bucket) => bucket.count),
  );
  const topGenres = stats.genreDistribution.slice(0, 8);
  const maxGenreCount = Math.max(1, ...topGenres.map((g) => g.count));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
          Statistics
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          Your watching
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Calculated from your library — {stats.total}{" "}
          {stats.total === 1 ? "title" : "titles"} tracked, including recorded
          episode progress and personal ratings.
        </p>
      </header>

      <section
        aria-label="Library totals"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard label="Tracked" value={stats.total} accent />
        <StatCard
          label="Currently watching"
          value={stats.statusCounts.watching}
          hint={`${stats.statusCounts.on_hold} on hold`}
        />
        <StatCard
          label="Completed"
          value={stats.statusCounts.completed}
          hint={`${stats.statusCounts.dropped} dropped`}
        />
        <StatCard
          label="Episodes recorded"
          value={stats.episodesWatched}
          hint={
            stats.entriesWithUnknownEpisodeTotals > 0
              ? `${stats.entriesWithUnknownEpisodeTotals} with unknown totals`
              : "Across all statuses"
          }
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section
          aria-labelledby="status-distribution"
          className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5"
        >
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2
              id="status-distribution"
              className="font-display text-base font-semibold text-fg"
            >
              Status distribution
            </h2>
            <span className="text-[11px] text-faint">
              {stats.total} total
            </span>
          </div>
          <ul className="space-y-3">
            {WATCH_STATUS_ORDER.map((status) => {
              const count = stats.statusCounts[status];
              const share = percent(count, stats.total);
              const meta = WATCH_STATUS_META[status];
              return (
                <li key={status}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-2 font-medium text-muted">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </span>
                    <span className="tabular-nums text-faint">
                      {count} · {share}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${share}%`,
                        backgroundColor: meta.color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="rating-distribution"
          className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5"
        >
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2
              id="rating-distribution"
              className="font-display text-base font-semibold text-fg"
            >
              Ratings
            </h2>
            <span className="text-[11px] text-faint">
              {stats.averageScore !== null
                ? `Average ${stats.averageScore} / 10 · ${stats.scoredCount} rated`
                : "No ratings yet"}
            </span>
          </div>

          <div className="flex h-[172px] items-end gap-1.5">
            {stats.scoreDistribution.map((bucket) => {
              const height =
                bucket.count === 0
                  ? 2
                  : Math.max(6, (bucket.count / maxScoreCount) * 100);
              return (
                <div
                  key={bucket.score}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${bucket.count} rated ${bucket.score}/10`}
                >
                  <span className="text-[10px] tabular-nums text-faint">
                    {bucket.count > 0 ? bucket.count : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-sm",
                      bucket.count > 0 ? "bg-accent/80" : "bg-surface-3",
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-faint">{bucket.score}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-faint">
            Personal ratings only. Community scores are shown on anime pages.
          </p>
        </section>
      </div>

      <section
        aria-labelledby="genre-distribution"
        className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5"
      >
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2
            id="genre-distribution"
            className="font-display text-base font-semibold text-fg"
          >
            Genres you watch
          </h2>
          <span className="text-[11px] text-faint">
            {stats.genreDistribution.length} genres
          </span>
        </div>

        {topGenres.length === 0 ? (
          <p className="text-sm text-faint">
            Genre data is unavailable for your current entries.
          </p>
        ) : (
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {topGenres.map((genre) => (
              <li key={genre.genre}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-muted">{genre.genre}</span>
                  <span className="tabular-nums text-faint">
                    {genre.count}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${(genre.count / maxGenreCount) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="Data notes"
        className="rounded-2xl border border-border-subtle bg-surface/60 p-4 text-xs leading-relaxed text-faint sm:p-5"
      >
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          How these numbers work
        </h2>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Episodes recorded is the sum of episode progress saved in your
            library. It is not a watch-time estimate.
          </li>
          <li>
            {stats.entriesWithUnknownEpisodeTotals > 0
              ? `${stats.entriesWithUnknownEpisodeTotals} ${
                  stats.entriesWithUnknownEpisodeTotals === 1
                    ? "title has"
                    : "titles have"
                } an unknown episode total; only the progress you logged is counted.`
              : "Every entry with progress has a known episode total."}
          </li>
          {stats.missingMetadataCount > 0 ? (
            <li>
              {stats.missingMetadataCount}{" "}
              {stats.missingMetadataCount === 1 ? "entry is" : "entries are"}{" "}
              missing AniList metadata, so their genres are excluded.
            </li>
          ) : null}
          <li>
            No historical trend, streak or watch-time data is fabricated. Only
            what the application has recorded is shown.
          </li>
        </ul>
      </section>
    </div>
  );
}
