"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  CheckIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  PlayIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { cn, getDisplayTitle, isHttpUrl } from "@/lib/utils";
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
  const hasRecords = watchedEpisodes.length > 0;
  const atEnd =
    total !== null &&
    total > 0 &&
    (hasRecords
      ? watchedEpisodes.length >= total || nextEp > total
      : progress >= total);
  return { nextEp, atEnd };
}

// Subtle asymmetric polygon cuts matching the mockup
const CARD_CLIPS = [
  "polygon(0 0, calc(100% - 14px) 0, 100% 16px, 100% 100%, 0 100%)",
  "polygon(14px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 14px) 100%, 0 100%, 0 16px)",
  "polygon(0 0, 100% 0, 100% calc(100% - 16px), calc(100% - 14px) 100%, 0 100%)",
  "polygon(0 16px, 14px 0, 100% 0, 100% 100%, 0 100%)",
];

interface ContinueWatchingCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  index: number;
  watchedEpisodes: number[];
  isPending: boolean;
  titleLanguage: "english" | "romaji";
  onIncrement: (id: number) => void;
}

function ContinueWatchingCard({
  item,
  index,
  watchedEpisodes,
  isPending,
  titleLanguage,
  onIncrement,
}: ContinueWatchingCardProps) {
  const { entry, anime } = item;
  const { requestAdd, requestRemove } = useLibrary();
  const [showMenu, setShowMenu] = useState(false);

  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover =
    (anime as unknown as { bannerImage?: string | null }).bannerImage ??
    anime.coverImage.extraLarge ??
    anime.coverImage.large;

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
      : null;

  const clipStyle = CARD_CLIPS[index % CARD_CLIPS.length];

  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d17] transition-all duration-200 hover:border-white/20 hover:shadow-xl"
      style={{ clipPath: clipStyle }}
    >
      {/* Upper Artwork Area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#161624]">
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover object-[center_25%] transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1a1928]" />
        )}

        {/* Gradient overlays to guarantee high contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d17] via-[#0d0d17]/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

        {/* Top-right percentage badge (only when total is known) */}
        {percent !== null ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center rounded-lg border border-white/15 bg-black/75 px-2 py-0.5 text-xs font-bold text-white shadow-md backdrop-blur-md">
            {percent}%
          </span>
        ) : null}

        {/* Anime Title & Episode metadata overlay */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-3 pt-6">
          <Link
            href={`/anime/${anime.id}`}
            className="line-clamp-1 font-display text-[14px] font-bold tracking-wide text-white transition-colors hover:text-accent-strong"
            title={title}
          >
            {title}
          </Link>

          <p className="mt-0.5 text-xs font-medium text-white/70">
            {total !== null && total > 0
              ? `Ep ${atEnd ? total : nextEp} of ${total}`
              : `Ep ${nextEp} · ? eps`}
          </p>
        </div>
      </div>

      {/* Lower Controls Area */}
      <div className="flex flex-col gap-2.5 p-3 pt-1">
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 shadow-[0_0_8px_rgba(124,58,237,0.7)]"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>

        {/* Action Row */}
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            disabled={isPending || atEnd}
            onClick={() => onIncrement(anime.id)}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-60",
              atEnd
                ? "border border-white/10 bg-white/5 text-white/50 cursor-default"
                : "bg-[#6329db] text-white hover:bg-[#7435f0] shadow-[0_2px_12px_rgba(99,41,219,0.35)]",
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
                <PlayIcon className="h-3 w-3 fill-current" />
                <span>Mark Ep {nextEp} watched</span>
              </>
            )}
          </button>

          {/* Overflow Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="More options"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#161625] text-white/70 transition-colors hover:border-white/20 hover:bg-[#1f1f33] hover:text-white"
            >
              <MoreHorizontalIcon className="h-4 w-4" />
            </button>

            {showMenu ? (
              <div
                className="absolute bottom-full right-0 z-50 mb-1.5 w-44 rounded-xl border border-white/15 bg-[#141424] p-1 shadow-2xl backdrop-blur-xl"
                onMouseLeave={() => setShowMenu(false)}
              >
                <Link
                  href={`/anime/${anime.id}`}
                  className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                  onClick={() => setShowMenu(false)}
                >
                  View details
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    requestAdd(anime);
                  }}
                  className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
                >
                  Edit progress / status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    requestRemove(anime.id);
                  }}
                  className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
                >
                  Remove from library
                </button>
              </div>
            ) : null}
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
    .slice(0, 4);

  return (
    <section aria-label="Continue watching" className="space-y-3.5">
      <div className="flex items-center justify-between">
        <Link
          href="/library?status=watching"
          className="group inline-flex items-center gap-1 font-display text-base font-semibold tracking-tight text-white sm:text-lg hover:text-accent-strong transition-colors"
        >
          <span>Continue watching</span>
          <ChevronRightIcon className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/library"
          className="group inline-flex items-center gap-1 text-xs font-medium text-white/60 transition-colors hover:text-white"
        >
          <span>My library</span>
          <ChevronRightIcon className="h-3 w-3 text-white/40 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {watching.length === 0 ? (
        <EmptyState
          compact
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
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {watching.map((item, index) => (
            <ContinueWatchingCard
              key={item.entry.id}
              item={item}
              index={index}
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
