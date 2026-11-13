"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CheckIcon,
  ChevronRightIcon,
  FilmIcon,
  LoaderIcon,
  PlayIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { ScreenLibraryCard } from "@/features/screen/screen-library";
import { apiFetch } from "@/lib/http";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbLibraryItem, TmdbWatchedEpisode } from "@/types/tmdb";

/**
 * Estimates the next episode to watch: the first gap in the latest season the
 * viewer has touched, falling back to the episode after the last one recorded.
 * Season episode counts are not stored on the library row, so the season
 * boundaries stay approximate and the detail page remains the exact editor.
 */
function nextEpisodeFor(
  watched: TmdbWatchedEpisode[],
  total: number,
  watchedCount: number,
): { seasonNumber: number; episodeNumber: number } | null {
  if (total > 0 && watchedCount >= total) return null;
  if (watched.length === 0) return { seasonNumber: 1, episodeNumber: 1 };

  let latestSeason = watched[0]?.seasonNumber ?? 1;
  for (const episode of watched) {
    if (episode.seasonNumber > latestSeason) latestSeason = episode.seasonNumber;
  }

  const seen = new Set(
    watched
      .filter((episode) => episode.seasonNumber === latestSeason)
      .map((episode) => episode.episodeNumber),
  );

  let episodeNumber = 1;
  while (seen.has(episodeNumber)) episodeNumber += 1;

  return { seasonNumber: latestSeason, episodeNumber };
}

function ScreenContinueCard({ item }: { item: TmdbLibraryItem }) {
  const { entry, watchedEpisodes, watchedCount } = item;
  const router = useRouter();
  const { toast } = useToast();

  const [watched, setWatched] = useState<TmdbWatchedEpisode[]>(watchedEpisodes);
  const [pending, setPending] = useState(false);

  const total = entry.totalEpisodes ?? 0;
  const count = Math.max(watchedCount, watched.length);
  const percent = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  const next = nextEpisodeFor(watched, total, count);

  async function markNextWatched() {
    if (!next || pending) return;
    setPending(true);
    const { seasonNumber, episodeNumber } = next;
    try {
      const data = await apiFetch<{ watchedEpisodes: TmdbWatchedEpisode[] }>(
        `/api/tmdb/library/tv/${entry.tmdbId}/episodes`,
        {
          method: "POST",
          body: JSON.stringify({
            episodes: [{ seasonNumber, episodeNumber }],
            watched: true,
          }),
        },
      );
      setWatched(data.watchedEpisodes);
      toast({
        title: `S${seasonNumber}E${episodeNumber} watched`,
        description: entry.title,
        tone: "success",
      });
      router.refresh();
    } catch (cause) {
      toast({
        title: "Could not save that episode",
        description:
          cause instanceof Error
            ? cause.message
            : "Film and TV tracking is unavailable right now.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="group relative flex min-w-0 flex-col">
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
        {entry.posterPath && isHttpUrl(entry.posterPath) ? (
          <Image
            src={entry.posterPath}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 30vw, 180px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
            <FilmIcon className="h-7 w-7 text-faint/60" />
          </div>
        )}

        <Link
          href={`/screen/tv/${entry.tmdbId}`}
          aria-label={`View ${entry.title}`}
          className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />

        <span className="pointer-events-none absolute right-0 top-0 z-20 bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
          TV
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between bg-gradient-to-t from-bg/95 via-bg/75 to-transparent px-2 pb-1.5 pt-3">
            <span className="font-mono text-[10px] font-medium tabular-nums text-fg">
              {count}
              {total ? `/${total}` : ""} eps
            </span>
            <span className="font-mono text-[9px] tabular-nums text-faint">
              {percent}%
            </span>
          </div>
          <div className="h-[2px] w-full bg-border">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <h3
        className="mt-2 line-clamp-1 font-display text-[13px] font-medium leading-snug text-fg"
        title={entry.title}
      >
        <Link href={`/screen/tv/${entry.tmdbId}`}>{entry.title}</Link>
      </h3>
      <p className="mt-0.5 truncate text-[10px] text-muted">
        {next
          ? `Next S${next.seasonNumber} · E${next.episodeNumber}`
          : count > 0
            ? "Caught up"
            : "Not started"}
      </p>

      <button
        type="button"
        disabled={pending || next === null}
        onClick={() => void markNextWatched()}
        aria-label={
          next
            ? `Mark season ${next.seasonNumber} episode ${next.episodeNumber} of ${entry.title} as watched`
            : `${entry.title} is caught up`
        }
        className={cn(
          "mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 border px-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-60",
          next
            ? "border-border text-fg hover:border-accent hover:bg-accent hover:text-accent-contrast"
            : "border-border/60 text-faint",
        )}
      >
        {next === null ? (
          <CheckIcon className="h-3 w-3 text-success" />
        ) : pending ? (
          <LoaderIcon className="h-3 w-3 animate-spin" />
        ) : (
          <PlayIcon className="h-2.5 w-2.5 fill-current" />
        )}
        <span>
          {next === null ? "Caught up" : pending ? "Saving…" : "Mark watched"}
        </span>
      </button>
    </article>
  );
}

/**
 * Film and TV continuation shelf for the dashboard. Series cards mark their next
 * episode in place; films keep the read-only library card.
 */
export function ScreenContinueShelf({
  heading,
  description,
  items,
  emptyTitle,
  emptyDescription,
}: {
  heading: string;
  description: string;
  items: TmdbLibraryItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <section aria-label={heading} className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            {heading}
          </p>
          <p className="mt-1 text-[11px] text-muted">{description}</p>
        </div>
        <Link
          href="/library"
          className="group inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
        >
          Films &amp; series
          <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<FilmIcon className="h-5 w-5" />}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link
              href="/screen"
              className="inline-flex h-8 items-center border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
            >
              Browse films &amp; TV
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((item) =>
            item.entry.mediaType === "tv" ? (
              <ScreenContinueCard
                key={`${item.entry.id}-${item.entry.updatedAt}`}
                item={item}
              />
            ) : (
              <ScreenLibraryCard key={item.entry.id} item={item} />
            ),
          )}
        </div>
      )}
    </section>
  );
}
