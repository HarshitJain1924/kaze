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

function ScreenLibraryCard({ item }: { item: TmdbLibraryItem }) {
  const { entry, watchedCount } = item;
  const total = entry.totalEpisodes ?? 0;
  const percent =
    entry.mediaType === "tv" && total > 0
      ? Math.min(100, Math.round((watchedCount / total) * 100))
      : entry.mediaType === "movie" && entry.watched
        ? 100
        : 0;

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border-subtle bg-surface/70 p-2.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-border hover:bg-surface-2/80 hover:shadow-xl">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-3">
        {entry.posterPath && isHttpUrl(entry.posterPath) ? (
          <Image
            src={entry.posterPath}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
            <FilmIcon className="h-8 w-8 text-faint/60" />
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"
        />
        <Link
          href={`/screen/${entry.mediaType}/${entry.tmdbId}`}
          aria-label={`View ${entry.title}`}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between">
          {entry.score ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
              <StarIcon className="h-3 w-3 fill-current" />
              {entry.score}
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
            {labelForKind(entry.mediaType)}
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2.5 pb-2">
          <p className="text-[11px] font-medium text-white/90">
            {entry.mediaType === "movie"
              ? entry.watched
                ? "Watched"
                : "Not watched"
              : `${watchedCount}${total ? ` / ${total}` : ""} episodes`}
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                percent >= 100
                  ? "bg-emerald-400"
                  : "bg-accent-strong",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-1">
        <Link
          href={`/screen/${entry.mediaType}/${entry.tmdbId}`}
          className="line-clamp-1 font-display text-[13px] font-semibold text-fg transition-colors hover:text-accent-strong"
        >
          {entry.title}
        </Link>
        <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
          <span>
            {[
              entry.mediaType === "movie" ? "Film" : "Series",
              entry.releaseDate ? entry.releaseDate.slice(0, 4) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="truncate text-right">
            {getWatchStatusLabel(entry.status)}
          </span>
        </div>
        {entry.mediaType === "movie" && entry.watched ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 light:text-emerald-700">
            <CheckIcon className="h-3 w-3" />
            Watched
          </span>
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
    <section aria-label="Films and TV library" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">
            Films &amp; TV
          </h2>
          <p className="mt-1 text-xs text-muted">
            Cinema and series tracked separately from anime and manga.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface-2 p-1">
          {(
            [
              ["all", `All ${counts.all}`],
              ["movie", `Films ${counts.movie}`],
              ["tv", `TV ${counts.tv}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors",
                kind === value
                  ? "bg-accent text-accent-contrast"
                  : "text-muted hover:bg-surface-3 hover:text-fg",
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
