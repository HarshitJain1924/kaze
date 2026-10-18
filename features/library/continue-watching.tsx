"use client";

import Image from "next/image";
import Link from "next/link";

import { CheckIcon, PlayIcon, PlusIcon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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

function getNextEpisodeNumber(
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
  const atEnd = total !== null && total > 0 && (progress >= total || nextEp > total);
  return { nextEp, atEnd };
}

interface SingleWatchingCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  watchedEpisodes: number[];
  isPending: boolean;
  titleLanguage: "english" | "romaji";
  onIncrement: (id: number) => void;
}

function SingleWatchingCard({
  item,
  watchedEpisodes,
  isPending,
  titleLanguage,
  onIncrement,
}: SingleWatchingCardProps) {
  const { entry, anime } = item;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const total = anime.episodes;
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    watchedEpisodes,
    total,
  );
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : 0;

  return (
    <div className="w-full rounded-2xl border border-border-subtle bg-surface p-5 transition-colors hover:border-border sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href={`/anime/${anime.id}`}
          className="relative mx-auto block aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm sm:mx-0 sm:w-36 group/poster"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 112px, 144px"
              className="object-cover transition-transform duration-300 group-hover/poster:scale-105"
            />
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                Currently Watching
              </span>
              {total !== null && total > 0 ? (
                <span className="text-xs text-muted">
                  {percent}% complete
                </span>
              ) : null}
            </div>

            <Link
              href={`/anime/${anime.id}`}
              className="mt-2 block font-display text-base font-semibold leading-snug text-fg transition-colors hover:text-accent-strong sm:text-lg"
            >
              {title}
            </Link>

            <p className="mt-1 text-xs text-muted">
              {total !== null
                ? formatEpisodeCount(total, { short: true })
                : "Episode count unknown"}
              {anime.seasonYear ? ` · ${anime.seasonYear}` : ""}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold tabular-nums text-fg">
                Episode {entry.progress}
                {total ? (
                  <span className="font-normal text-muted"> of {total}</span>
                ) : null}
              </span>
              {total !== null && total > 0 ? (
                <span className="text-xs font-semibold text-accent-strong tabular-nums">
                  {percent}%
                </span>
              ) : null}
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <Button
                variant="primary"
                size="sm"
                className="flex-1 sm:flex-initial"
                disabled={isPending || atEnd}
                onClick={() => onIncrement(anime.id)}
              >
                {atEnd ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5" />
                    All caught up
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-3.5 w-3.5" />
                    Mark Episode {nextEp} watched
                  </>
                )}
              </Button>
              <Link
                href={`/anime/${anime.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:border-border hover:bg-surface-3"
              >
                Episode tracker
              </Link>
            </div>
          </div>
        </div>
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
      ) : watching.length === 1 && watching[0] ? (
        <SingleWatchingCard
          item={watching[0]}
          watchedEpisodes={watchedEpisodesFor(watching[0].anime.id)}
          isPending={pendingIds.has(watching[0].anime.id)}
          titleLanguage={preferences.titleLanguage}
          onIncrement={(id) => void incrementProgress(id)}
        />
      ) : (
        <div
          className={cn(
            "grid gap-3.5",
            watching.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {watching.map(({ entry, anime }) => {
            const title = getDisplayTitle(
              anime.title,
              preferences.titleLanguage === "english",
            );
            const cover =
              anime.coverImage.extraLarge ?? anime.coverImage.large;
            const total = anime.episodes;
            const watchedList = watchedEpisodesFor(anime.id);
            const { nextEp, atEnd } = getNextEpisodeNumber(
              entry.progress,
              watchedList,
              total,
            );
            const percent =
              total && total > 0
                ? Math.min(100, Math.round((entry.progress / total) * 100))
                : 0;
            const isPending = pendingIds.has(anime.id);

            return (
              <div
                key={entry.id}
                className="group relative flex gap-3.5 rounded-2xl border border-border-subtle bg-surface p-3 transition-colors hover:border-border"
              >
                <Link
                  href={`/anime/${anime.id}`}
                  className="relative block h-[112px] w-[76px] sm:w-[80px] shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm"
                  aria-label={`Open ${title}`}
                >
                  {cover && isHttpUrl(cover) ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <Link
                      href={`/anime/${anime.id}`}
                      className="line-clamp-1 font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
                      title={title}
                    >
                      {title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {total !== null
                        ? formatEpisodeCount(total, { short: true })
                        : "Episode count unknown"}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold tabular-nums text-fg">
                        Ep {entry.progress}
                        {total ? (
                          <span className="font-normal text-muted"> / {total}</span>
                        ) : null}
                      </span>
                      {total !== null && total > 0 ? (
                        <span className="text-[11px] font-semibold text-accent-strong tabular-nums">
                          {percent}%
                        </span>
                      ) : null}
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isPending || atEnd}
                      onClick={() => void incrementProgress(anime.id)}
                      className={cn(
                        "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                        atEnd
                          ? "cursor-default border border-border bg-surface-2 text-muted"
                          : "border border-accent/30 bg-accent-soft text-accent-strong hover:bg-accent hover:text-accent-contrast",
                      )}
                    >
                      {atEnd ? (
                        <>
                          <CheckIcon className="h-3 w-3 text-success" />
                          Caught up
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-3 w-3" />
                          Mark Ep {nextEp} watched
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
