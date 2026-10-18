"use client";

import Image from "next/image";
import Link from "next/link";

import { CheckIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/empty-state";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatEpisodeCount,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryItem } from "@/types/library";

export function getNextEpisodeNumber(
  progress: number,
  watchedEpisodes: number[],
  total: number | null,
): { nextEp: number; atEnd: boolean } {
  const watchedSet = new Set(watchedEpisodes);
  let nextEp = 1;
  while (watchedSet.has(nextEp)) {
    nextEp += 1;
  }
  if (watchedSet.size === 0 && progress > 0) {
    nextEp = progress + 1;
  }
  const atEnd =
    total !== null &&
    total > 0 &&
    (progress >= total || (watchedSet.size >= total && nextEp > total));
  return { nextEp, atEnd };
}

interface ContinueWatchingCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  watchedEpisodes: number[];
  isPending: boolean;
  titleLanguage: "english" | "romaji";
  onIncrement: (id: number) => void;
}

function ContinueWatchingCard({
  item,
  watchedEpisodes,
  isPending,
  titleLanguage,
  onIncrement,
}: ContinueWatchingCardProps) {
  const { entry, anime } = item;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const total = anime.episodes;
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    watchedEpisodes,
    total,
  );

  const watchedCount =
    watchedEpisodes.length > 0 ? watchedEpisodes.length : entry.progress;

  const percent =
    total && total > 0
      ? Math.min(100, Math.round((watchedCount / total) * 100))
      : 0;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 transition-all duration-200 hover:border-border sm:p-4.5">
      {/* Top row: Poster + Info */}
      <div className="flex gap-3.5 sm:gap-4">
        {/* Poster */}
        <Link
          href={`/anime/${anime.id}`}
          className="relative aspect-[2/3] w-[84px] shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm transition-transform duration-200 group-hover:scale-[1.02] sm:w-[92px]"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="92px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-surface-3" />
          )}
        </Link>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <Link
              href={`/anime/${anime.id}`}
              className="line-clamp-1 font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong sm:text-base"
              title={title}
            >
              {title}
            </Link>

            <p className="mt-0.5 text-xs text-muted">
              {total !== null && total > 0
                ? `${formatEpisodeCount(total, { short: true })} · ${percent}%`
                : "Episode count unknown"}
            </p>
          </div>

          {/* Progress information + thin progress bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold tabular-nums text-fg">
                Ep {entry.progress}
                {total && total > 0 ? (
                  <span className="font-normal text-muted"> / {total}</span>
                ) : null}
              </span>
              <span className="text-[11px] font-medium text-muted tabular-nums">
                {atEnd ? (
                  <span className="font-semibold text-success">Completed</span>
                ) : watchedCount > 0 ? (
                  `${watchedCount} watched`
                ) : (
                  "Not started"
                )}
              </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="mt-3.5 pt-1">
        <button
          type="button"
          disabled={isPending || atEnd}
          onClick={() => onIncrement(anime.id)}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-150 disabled:opacity-50",
            atEnd
              ? "cursor-default border border-border-subtle bg-surface-2/40 text-muted"
              : "border border-accent/35 bg-accent-soft text-accent-strong hover:border-accent/60 hover:bg-accent hover:text-accent-contrast active:scale-[0.99]",
          )}
        >
          {atEnd ? (
            <>
              <CheckIcon className="h-3.5 w-3.5 text-success" />
              <span>All caught up</span>
            </>
          ) : isPending ? (
            <span>Updating…</span>
          ) : (
            <>
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Mark Episode {nextEp} watched</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function ContinueWatching() {
  const { items, incrementProgress, pendingIds, watchedEpisodesFor } =
    useLibrary();
  const { preferences } = usePreferences();

  const watching = items
    .filter(
      (item): item is LibraryItem & { anime: AnimeSummary } =>
        item.entry.status === "watching" && item.anime !== null,
    )
    .sort(
      (a, b) =>
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime(),
    )
    .slice(0, 6);

  return (
    <section aria-label="Continue watching">
      <SectionHeader
        title="Continue watching"
        action={watching.length > 0 ? "My library" : undefined}
        actionHref="/library"
      />

      {watching.length === 0 ? (
        <EmptyState
          icon={<PlayIcon className="h-5 w-5" />}
          title="Nothing in progress"
          description="Mark an anime as Watching and it will appear here with one-tap episode updates."
          action={
            <Link
              href="/discover"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
            >
              Browse anime
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {watching.map((item) => (
            <ContinueWatchingCard
              key={item.entry.id}
              item={item}
              watchedEpisodes={watchedEpisodesFor(item.anime.id)}
              isPending={pendingIds.has(item.anime.id)}
              titleLanguage={preferences.titleLanguage}
              onIncrement={(id) => void incrementProgress(id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
