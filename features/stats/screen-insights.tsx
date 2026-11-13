"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { ChevronRightIcon, FilmIcon, StarIcon } from "@/components/icons";
import {
  calculateScreenInsights,
  type ScreenInsightKind,
} from "@/features/stats/calculate-screen-insights";
import { formatShortIsoDate, isHttpUrl } from "@/lib/utils";
import type { TmdbLibraryItem } from "@/types/tmdb";

const KIND_COPY = {
  movie: {
    library: "Film library",
    href: "/library?media=movie",
    progressTitle: "Release decades",
    progressNote: "When your films were made",
    noun: "films",
  },
  tv: {
    library: "Series library",
    href: "/library?media=tv",
    progressTitle: "Series progress",
    progressNote: "Most-watched series by recorded episodes",
    noun: "series",
  },
} as const;

function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
      <div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
          {eyebrow}
        </span>
        <h2 className="mt-1 font-display text-base font-semibold tracking-tight text-fg sm:text-lg">
          {title}
        </h2>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent hover:text-fg"
        >
          <span>{linkLabel}</span>
          <ChevronRightIcon className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The analytics that the status ledger cannot show: how you rate, what eras you
 * watch, how much of each series you have actually seen, and what to open next.
 */
export function ScreenInsights({
  items,
  kind,
}: {
  items: TmdbLibraryItem[];
  kind: ScreenInsightKind;
}) {
  const insights = useMemo(
    () => calculateScreenInsights(items, kind),
    [items, kind],
  );
  const copy = KIND_COPY[kind];

  if (insights.count === 0) return null;

  const maxBucket = Math.max(1, ...insights.scoreBuckets.map((b) => b.count));
  const maxDecade = Math.max(1, ...insights.decades.map((d) => d.count));

  return (
    <>
      {/* Ratings and history / progress */}
      <section
        aria-label={`${kind === "movie" ? "Film" : "Series"} rating and progress breakdown`}
        className="border border-border bg-surface/40 p-5 sm:p-6"
      >
        <SectionHeader
          eyebrow="Rating shape"
          title="How you score"
          description={
            insights.ratedCount > 0
              ? `${insights.ratedCount} of ${insights.count} ${copy.noun} rated · mean ${insights.meanScore?.toFixed(1)}/10`
              : `No ${copy.noun} rated yet — scores of 8+ surface below.`
          }
        />

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
              Score distribution
            </p>
            <div className="mt-2.5 space-y-2">
              {insights.scoreBuckets.map((bucket) => {
                const share = Math.round((bucket.count / maxBucket) * 100);
                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 font-mono text-[10px] tabular-nums text-muted">
                      {bucket.label}
                    </span>
                    <div className="h-1.5 flex-1 bg-surface-3">
                      <div
                        className="h-full bg-accent transition-all duration-300"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg">
                      {bucket.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
              {copy.progressTitle}
            </p>

            {kind === "movie" ? (
              insights.decades.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {insights.decades.map((decade) => (
                    <div key={decade.label} className="flex items-center gap-3">
                      <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted">
                        {decade.label}
                      </span>
                      <div className="h-1.5 flex-1 bg-surface-3">
                        <div
                          className="h-full bg-fg/60 transition-all duration-300"
                          style={{
                            width: `${Math.round((decade.count / maxDecade) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-fg">
                        {decade.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 text-xs text-muted">
                  Release dates are not recorded for these films yet.
                </p>
              )
            ) : insights.seriesProgress.length > 0 ? (
              <div className="mt-2.5 space-y-2">
                {insights.seriesProgress.map((series) => {
                  const percent =
                    series.total && series.total > 0
                      ? Math.min(
                          100,
                          Math.round((series.watched / series.total) * 100),
                        )
                      : null;
                  return (
                    <div key={series.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="truncate text-[11px] text-fg"
                          title={series.title}
                        >
                          {series.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                          {series.watched}
                          {series.total ? `/${series.total}` : ""} eps
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-3">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${percent ?? (series.watched > 0 ? 12 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {insights.episodeCompletion !== null ? (
                  <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                    {insights.episodesWatched.toLocaleString()} of{" "}
                    {insights.episodesAvailable.toLocaleString()} episodes logged
                    · {insights.episodeCompletion}% coverage
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2.5 text-xs text-muted">
                No episodes logged yet. Tick one off and its series appears here.
              </p>
            )}

            {kind === "movie" ? (
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                    Watch rate
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-fg">
                    {insights.watchRate}%
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                    Watched
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-fg">
                    {insights.watchedFilms}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                    Queued
                  </p>
                  <p className="mt-0.5 font-display text-sm font-semibold tabular-nums text-fg">
                    {insights.queuedFilms}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Top rated */}
      {insights.topRated.length > 0 ? (
        <section
          aria-label={`Top rated ${copy.noun}`}
          className="border border-border bg-surface/40 p-5 sm:p-6"
        >
          <SectionHeader
            eyebrow="Hall of fame"
            title={`Your best ${copy.noun}`}
            description="Everything you scored 8/10 or higher, highest first."
            href={copy.href}
            linkLabel={copy.library}
          />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {insights.topRated.map((entry) => (
              <Link
                key={entry.key}
                href={`/screen/${kind}/${entry.tmdbId}`}
                className="group"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden border border-border bg-surface-2">
                  {entry.poster && isHttpUrl(entry.poster) ? (
                    <Image
                      src={entry.poster}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 45vw, 160px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FilmIcon className="h-6 w-6 text-faint/60" />
                    </div>
                  )}
                  <span className="absolute right-0 top-0 inline-flex items-center gap-1 bg-bg/85 px-1.5 py-1 font-mono text-[10px] font-semibold tabular-nums text-fg">
                    <StarIcon className="h-2.5 w-2.5 fill-current text-amber-400" />
                    {entry.score}
                  </span>
                </div>
                <p
                  className="mt-1.5 line-clamp-1 text-[12px] font-medium text-fg transition-colors group-hover:text-accent-strong"
                  title={entry.title}
                >
                  {entry.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Viewing rhythm: real timestamps, so streaks and pace are measured. */}
      {insights.activity.activeDays > 0 ? (
        <section
          aria-label="Viewing rhythm"
          className="border border-border bg-surface/40 p-5 sm:p-6"
        >
          <SectionHeader
            eyebrow="Viewing rhythm"
            title="When you watch"
            description="Built from recorded episode timestamps and completed films."
          />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Current streak",
                value: `${insights.activity.currentStreak}d`,
                hint: "days in a row",
              },
              {
                label: "Longest streak",
                value: `${insights.activity.longestStreak}d`,
                hint: `${insights.activity.activeDays} active days`,
              },
              {
                label: "Pace",
                value:
                  insights.activity.weeklyPace !== null
                    ? `${insights.activity.weeklyPace}/wk`
                    : "—",
                hint:
                  insights.activity.recentEpisodes > 0
                    ? `${insights.activity.recentEpisodes} eps in 4 weeks`
                    : "no recent episodes",
              },
              {
                label: "Busiest month",
                value: insights.activity.busiestMonth?.label ?? "—",
                hint: insights.activity.busiestMonth
                  ? `${insights.activity.busiestMonth.count} logged`
                  : "nothing logged",
              },
            ].map((metric) => (
              <div key={metric.label} className="border border-border bg-surface/60 p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                  {metric.label}
                </p>
                <p className="mt-1 font-display text-base font-semibold tabular-nums text-fg">
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">{metric.hint}</p>
              </div>
            ))}
          </div>

          {insights.activity.weekdayCounts.some((count) => count > 0) ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                By weekday
              </p>
              <div className="mt-2 flex items-end gap-1.5">
                {insights.activity.weekdayCounts.map((count, index) => {
                  const max = Math.max(
                    1,
                    ...insights.activity.weekdayCounts,
                  );
                  return (
                    <div key={index} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-12 w-full items-end bg-surface-3">
                        <div
                          className="w-full bg-accent transition-all duration-300"
                          style={{ height: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-faint">
                        {["S", "M", "T", "W", "T", "F", "S"][index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Backlog runway */}
      {insights.backlog.hours > 0 ? (
        <section
          aria-label="Backlog runway"
          className="border border-border bg-surface/40 p-5 sm:p-6"
        >
          <SectionHeader
            eyebrow="Runway"
            title="What is left"
            description="Unwatched titles, estimated at 2 h a film and 45 min an episode."
            href={copy.href}
            linkLabel={copy.library}
          />

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Films queued",
                value: insights.backlog.films.toLocaleString(),
              },
              {
                label: "Episodes left",
                value: insights.backlog.episodes.toLocaleString(),
              },
              { label: "Estimated hours", value: `${insights.backlog.hours}h` },
              {
                label: "Clear by",
                value: insights.backlog.clearBy ?? "—",
              },
            ].map((metric) => (
              <div key={metric.label} className="border border-border bg-surface/60 p-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-faint">
                  {metric.label}
                </p>
                <p className="mt-1 font-display text-base font-semibold tabular-nums text-fg">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {insights.backlog.clearBy
              ? `At your recent pace, this backlog clears around ${insights.backlog.clearBy} (${insights.backlog.weeksToClear} weeks).`
              : "Log a few episodes to project a finish date for the backlog."}
          </p>
        </section>
      ) : null}

      {/* Recent activity */}
      {insights.recent.length > 0 ? (
        <section
          aria-label={`Recently updated ${copy.noun}`}
          className="border border-border bg-surface/40 p-5 sm:p-6"
        >
          <SectionHeader
            eyebrow="Latest changes"
            title="Recently updated"
            description={`The last ${copy.noun} you touched.`}
          />
          <ul className="mt-3 divide-y divide-border">
            {insights.recent.map((entry) => (
              <li
                key={entry.key}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="truncate text-[13px] text-fg">
                  {entry.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                  {formatShortIsoDate(entry.updatedAt) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
