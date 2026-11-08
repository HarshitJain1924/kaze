import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon, FilmIcon, StarIcon } from "@/components/icons";
import type { ScreenLibraryStats } from "@/features/stats/calculate-screen-stats";
import { isHttpUrl } from "@/lib/utils";
import type { TmdbSearchResult } from "@/types/tmdb";

/**
 * Films and television sit beside the anime shelf on the dashboard. The ledger
 * only appears once the viewer actually tracks something, so a signed-in reader
 * who only watches anime never sees four empty counters.
 */
export function ScreenShelf({
  items,
  stats,
}: {
  items: TmdbSearchResult[] | null;
  stats: ScreenLibraryStats | null;
}) {
  const metrics = stats
    ? [
        { label: "Films tracked", value: stats.movieCount },
        { label: "Series tracked", value: stats.tvCount },
        { label: "Films watched", value: stats.watchedFilms },
        { label: "Episodes logged", value: stats.episodesWatched },
      ]
    : [];
  const hasLedger = metrics.some((metric) => metric.value > 0);

  return (
    <section aria-label="Films and TV" className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Screen archive
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">
            Films &amp; TV
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Cinema and television, tracked beside your anime shelf.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/screen"
            className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
          >
            Screen library
            <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/discover?type=movie"
            className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
          >
            Explore films
            <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      {hasLedger ? (
        <dl className="grid grid-cols-2 divide-x divide-border border-y border-border sm:grid-cols-4">
          {metrics.map((metric) => (
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
      ) : null}

      {items === null ? (
        <p className="border border-border bg-surface/40 px-4 py-6 text-[12px] leading-relaxed text-muted">
          The film and television index is taking a moment.{" "}
          <Link
            href="/discover?type=movie"
            className="text-accent-strong hover:underline"
          >
            Browse films directly
          </Link>
          .
        </p>
      ) : items.length === 0 ? null : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6 sm:gap-x-4">
          {items.map((item) => {
            const href = `/screen/${item.kind}/${item.tmdbId}`;
            return (
              <article key={`${item.kind}-${item.tmdbId}`} className="group min-w-0">
                <div className="relative aspect-[2/3] overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
                  {item.posterUrl && isHttpUrl(item.posterUrl) ? (
                    <Image
                      src={item.posterUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 30vw, 16vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-surface-3">
                      <FilmIcon className="h-6 w-6 text-faint/60" />
                    </span>
                  )}

                  <Link
                    href={href}
                    aria-label={`View details for ${item.title}`}
                    className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  />

                  {item.voteAverage && item.voteAverage > 0 ? (
                    <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
                      <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
                      {item.voteAverage.toFixed(1)}
                    </span>
                  ) : null}

                  <span className="pointer-events-none absolute bottom-0 right-0 z-20 bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Film
                  </span>
                </div>

                <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.1em] text-faint">
                  Film{item.year ? ` / ${item.year}` : ""}
                </p>
                <h3
                  className="mt-0.5 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong"
                  title={item.title}
                >
                  <Link href={href}>{item.title}</Link>
                </h3>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
