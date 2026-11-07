"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CheckIcon, FilmIcon, StarIcon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { getWatchStatusLabel } from "@/lib/library-meta";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbKind, TmdbLibraryItem } from "@/types/tmdb";

type KindFilter = "all" | TmdbKind;

function labelForKind(kind: TmdbKind): string {
  return kind === "movie" ? "Film" : "TV";
}

export function ScreenLibraryCard({ item }: { item: TmdbLibraryItem }) {
  const { entry, watchedCount } = item;
  const total = entry.totalEpisodes ?? 0;
  const percent =
    entry.mediaType === "tv" && total > 0
      ? Math.min(100, Math.round((watchedCount / total) * 100))
      : entry.mediaType === "movie" && entry.watched
        ? 100
        : 0;

  const isCompleted =
    (entry.mediaType === "movie" && entry.watched) ||
    (entry.mediaType === "tv" && total > 0 && watchedCount >= total) ||
    entry.status === "completed";

  return (
    <article className="group relative flex min-w-0 flex-col">
      {/* Poster Artwork Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
        {entry.posterPath && isHttpUrl(entry.posterPath) ? (
          <Image
            src={entry.posterPath}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 20vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
            <FilmIcon className="h-8 w-8 text-faint/60" />
          </div>
        )}

        <Link
          href={`/screen/${entry.mediaType}/${entry.tmdbId}`}
          aria-label={`View ${entry.title}`}
          className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />

        {/* Top Badges Row */}
        {entry.score ? (
          <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
            <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
            {entry.score}
          </span>
        ) : null}

        <span className="pointer-events-none absolute right-0 top-0 z-20 bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
          {labelForKind(entry.mediaType)}
        </span>

        {/* Bottom Progress Telemetry on Poster with Flush Ruled Track */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between bg-gradient-to-t from-bg/95 via-bg/75 to-transparent px-2 pb-1.5 pt-3">
            <span className="font-mono text-[10px] font-medium tabular-nums text-fg">
              {entry.mediaType === "movie"
                ? entry.watched
                  ? "Watched"
                  : "Not watched"
                : `${watchedCount}${total ? `/${total}` : ""} eps`}
            </span>
            {entry.mediaType === "tv" && total > 0 ? (
              <span className="font-mono text-[9px] tabular-nums text-faint">
                {percent}%
              </span>
            ) : null}
          </div>

          <div className="h-[2px] w-full bg-border">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCompleted ? "bg-success" : "bg-accent",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Information Below Poster */}
      <div className="mt-2 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-1 text-[8px] font-medium uppercase tracking-[0.14em] text-faint">
          <span>
            {[
              entry.mediaType === "movie" ? "Film" : "Series",
              entry.releaseDate ? entry.releaseDate.slice(0, 4) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span
            className={cn(
              "font-semibold uppercase tracking-[0.1em]",
              isCompleted ? "text-success" : "text-muted",
            )}
          >
            {getWatchStatusLabel(entry.status)}
          </span>
        </div>

        <h3 className="mt-0.5 line-clamp-1 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong" title={entry.title}>
          <Link href={`/screen/${entry.mediaType}/${entry.tmdbId}`}>
            {entry.title}
          </Link>
        </h3>

        {entry.mediaType === "movie" && entry.watched ? (
          <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-success">
            <CheckIcon className="h-3 w-3" />
            <span>Watched</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ScreenLibrary({ items }: { items: TmdbLibraryItem[] }) {
  const [kind, setKind] = useState<KindFilter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      movie: items.filter((item) => item.entry.mediaType === "movie").length,
      tv: items.filter((item) => item.entry.mediaType === "tv").length,
    }),
    [items],
  );

  const visible = useMemo(
    () =>
      kind === "all"
        ? items
        : items.filter((item) => item.entry.mediaType === kind),
    [items, kind],
  );

  if (items.length === 0) return null;

  return (
    <section aria-label="Films and TV library" className="border-t border-border pt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            TMDB Archive · Film &amp; TV
          </span>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Films &amp; Series
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            Cinema and television tracked separately from anime and manga.
          </p>
        </div>

        <div className="inline-flex border border-border bg-surface/40 p-0.5">
          {(
            [
              ["all", `All (${counts.all})`],
              ["movie", `Films (${counts.movie})`],
              ["tv", `TV (${counts.tv})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "h-8 border-r border-border last:border-r-0 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                kind === value
                  ? "bg-accent text-accent-contrast"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<FilmIcon className="h-6 w-6 text-faint" />}
          title={kind === "movie" ? "No films yet" : "No TV shows yet"}
          description="Search movies and TV in Discover to add something to this shelf."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((item) => (
            <ScreenLibraryCard key={item.entry.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
