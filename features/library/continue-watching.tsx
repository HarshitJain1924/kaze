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
  pluralize,
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
    <div className="relative group max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] bg-surface/80 backdrop-blur-xl p-5 sm:p-6 transition-all duration-300 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-accent/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link
          href={`/anime/${anime.id}`}
          className="relative mx-auto block aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-lg shadow-black/30 ring-1 ring-white/10 sm:mx-0 sm:w-32 group/poster"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 112px, 128px"
              className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
            />
          ) : null}
          {entry.progress > 0 ? (
            <div className="absolute top-2 left-2 rounded-md bg-black/75 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-accent-strong tabular-nums shadow-sm border border-white/10">
              Ep {entry.progress}
            </div>
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent-strong border border-accent/20">
                Currently Watching
              </span>
              {total !== null && total > 0 ? (
                <span className="text-xs font-medium text-muted">
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

            <p className="mt-1 text-xs text-faint">
              {total !== null
                ? formatEpisodeCount(total, { short: true })
                : "Episode count unknown"}
              {anime.seasonYear ? ` · ${anime.seasonYear}` : ""}
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold tabular-nums text-fg">
                Episode {entry.progress}
                {total ? <span className="text-muted font-normal"> of {total}</span> : ""}
              </span>
              <span className="text-[11px] font-semibold text-accent-strong">
                {entry.progress > 0
                  ? `${entry.progress} ${pluralize(entry.progress, "episode")} watched`
                  : "Not started yet"}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-surface-3/80 ring-1 ring-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent via-indigo-500 to-purple-400 shadow-sm shadow-accent/50 transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="flex-1 sm:flex-initial shadow-md shadow-accent/25"
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
                className="inline-flex h-8 items-center rounded-xl border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-3 hover:text-accent-strong"
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
        description="Pick up right where you left off with one-tap episode tracking."
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                className="group relative flex gap-3.5 rounded-2xl border border-white/[0.08] dark:border-white/[0.08] bg-surface/80 backdrop-blur-xl p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface hover:shadow-xl hover:shadow-accent/10 overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-accent/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <Link
                  href={`/anime/${anime.id}`}
                  className="relative block h-[120px] w-[82px] sm:w-[84px] shrink-0 overflow-hidden rounded-xl bg-surface-2 shadow-md shadow-black/30 ring-1 ring-white/10 group/poster"
                  aria-label={`Open ${title}`}
                >
                  {cover && isHttpUrl(cover) ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="84px"
                      className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
                    />
                  ) : null}
                  {entry.progress > 0 ? (
                    <div className="absolute top-1.5 left-1.5 rounded-md bg-black/75 backdrop-blur-md px-1.5 py-0.5 text-[10px] font-bold text-accent-strong tabular-nums shadow-sm border border-white/10">
                      Ep {entry.progress}
                    </div>
                  ) : null}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] opacity-0 transition-opacity duration-200 group-hover/poster:opacity-100">
                    <PlayIcon className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                </Link>

                <div className="relative flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <Link
                      href={`/anime/${anime.id}`}
                      className="line-clamp-1 font-display text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
                      title={title}
                    >
                      {title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <span>
                        {total !== null
                          ? formatEpisodeCount(total, { short: true })
                          : "Ep count unknown"}
                      </span>
                      {total !== null && total > 0 ? (
                        <>
                          <span className="text-faint">·</span>
                          <span className="font-semibold text-accent-strong">
                            {percent}%
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold tabular-nums text-fg">
                        Ep {entry.progress}
                        {total ? (
                          <span className="font-normal text-muted"> / {total}</span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          entry.progress > 0 ? "text-accent-strong" : "text-faint",
                        )}
                      >
                        {entry.progress > 0
                          ? `${entry.progress} watched`
                          : "Not started"}
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3/80 ring-1 ring-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent via-indigo-500 to-purple-400 shadow-sm shadow-accent/50 transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isPending || atEnd}
                      onClick={() => void incrementProgress(anime.id)}
                      className={cn(
                        "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50",
                        atEnd
                          ? "cursor-default border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-accent/30 bg-accent-soft text-accent-strong hover:border-accent hover:bg-accent hover:text-white hover:shadow-md hover:shadow-accent/25",
                      )}
                    >
                      {atEnd ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5" />
                          Caught up
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-3.5 w-3.5" />
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
