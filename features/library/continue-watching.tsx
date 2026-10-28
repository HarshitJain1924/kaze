"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  BookmarkIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PlayIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
import { seasonLabel } from "@/lib/season";
import type { AnimeSeason, AnimeSummary } from "@/types/anime";
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

export interface FeaturedAngularCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  watchedEpisodes: number[];
  isPending: boolean;
  titleLanguage: "english" | "romaji";
  onIncrement: (id: number) => void;
}

export function FeaturedAngularCard({
  item,
  watchedEpisodes,
  isPending,
  titleLanguage,
  onIncrement,
}: FeaturedAngularCardProps) {
  const { entry, anime } = item;
  const { requestAdd, requestRemove } = useLibrary();
  const { toast } = useToast();

  const [showMenu, setShowMenu] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

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
      : null;

  // Metadata chips
  const formatLabel = anime.format ? formatFormat(anime.format) : null;
  const animeSeason = (anime as unknown as { season?: AnimeSeason | null })
    .season;
  const seasonLabelText =
    animeSeason && anime.seasonYear
      ? `${seasonLabel(animeSeason)} ${anime.seasonYear}`
      : anime.seasonYear
        ? String(anime.seasonYear)
        : null;
  const genres = anime.genres ? anime.genres.slice(0, 2) : [];

  const handleToggleBookmark = () => {
    setIsBookmarked((prev) => {
      const next = !prev;
      toast({
        title: next ? "Pinned to favorites" : "Unpinned from favorites",
        description: title,
      });
      return next;
    });
  };

  return (
    <article
      aria-label={`Featured: ${title}`}
      className="group relative overflow-hidden rounded-[22px] border border-border/80 bg-[radial-gradient(ellipse_at_88%_0%,var(--accent-soft),transparent_44%),var(--surface)] shadow-[0_20px_55px_-38px_rgba(0,0,0,0.95)]"
    >
      <div className="flex flex-col gap-4 p-3 sm:flex-row sm:gap-5 sm:p-4">
        {/* Poster */}
        <Link
          href={`/anime/${anime.id}`}
          className="relative aspect-[2/3] w-full max-w-[190px] shrink-0 self-start overflow-hidden rounded-xl border border-border/80 bg-surface-2 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.8)] sm:w-32 md:w-36"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 45vw, 144px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <span className="absolute inset-0 bg-surface-3" />
          )}
        </Link>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
                  Continue watching
                </p>
                <Link
                  href={`/anime/${anime.id}`}
                  className="mt-1 line-clamp-1 block font-display text-xl font-semibold tracking-tight text-fg transition-colors hover:text-accent-strong sm:text-2xl"
                  title={title}
                >
                  {title}
                </Link>
                <p className="mt-1 text-xs font-medium text-muted sm:text-[13px]">
                  {total !== null && total > 0
                    ? `Up next: episode ${atEnd ? total : nextEp} of ${total}`
                    : `Up next: episode ${nextEp}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  aria-label={
                    isBookmarked ? "Remove bookmark" : "Bookmark anime"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    isBookmarked
                      ? "border-accent/50 bg-accent-soft text-accent-strong"
                      : "border-border bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg"
                  }`}
                >
                  <BookmarkIcon
                    className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
                  />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMenu((prev) => !prev)}
                    aria-label="More options"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </button>

                  {showMenu ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg"
                      onMouseLeave={() => setShowMenu(false)}
                    >
                      <Link
                        href={`/anime/${anime.id}`}
                        className="block rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
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
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-fg hover:bg-surface-2"
                      >
                        Edit progress / status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          requestRemove(anime.id);
                        }}
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-danger hover:bg-danger/10"
                      >
                        Remove from library
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Metadata chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {formatLabel ? (
                <span className="rounded-md border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  {formatLabel}
                </span>
              ) : null}

              {seasonLabelText ? (
                <span className="rounded-md border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  {seasonLabelText}
                </span>
              ) : null}

              {genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-md border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          <div>
            {/* Progress */}
            <div className="flex items-baseline justify-between text-xs sm:text-sm">
              <span className="text-muted">
                <span className="font-semibold tabular-nums text-fg">
                  {watchedCount}
                </span>
                {total && total > 0 ? ` / ${total}` : ""} episodes watched
              </span>
              <span className="font-semibold tabular-nums text-fg">
                {percent !== null ? `${percent}%` : "Total unknown"}
              </span>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ring-1 ring-inset ring-border-subtle">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isPending || atEnd}
                onClick={() => onIncrement(anime.id)}
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors active:scale-[0.99] sm:h-11 sm:text-sm ${
                  atEnd
                    ? "cursor-default border border-border bg-surface-2 text-muted"
                    : "bg-accent text-accent-contrast hover:bg-accent-hover disabled:opacity-60"
                }`}
              >
                {atEnd ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-success" />
                    <span>All caught up</span>
                  </>
                ) : isPending ? (
                  <span>Updating…</span>
                ) : (
                  <>
                    <PlayIcon className="h-3.5 w-3.5 fill-current" />
                    <span>Mark Episode {nextEp} Watched</span>
                  </>
                )}
              </button>

              <Link
                href={`/anime/${anime.id}`}
                className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-fg sm:h-11 sm:w-16"
                aria-label={`View details for ${title}`}
              >
                <EyeIcon className="h-4 w-4" />
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  View
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export interface CompanionCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  isActive: boolean;
  onSelect: () => void;
  onIncrement: (id: number) => void;
  isPending: boolean;
  titleLanguage: "english" | "romaji";
}

export function CompanionCard({
  item,
  isActive,
  onSelect,
  onIncrement,
  isPending,
  titleLanguage,
}: CompanionCardProps) {
  const { entry, anime } = item;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;

  const total = anime.episodes;
  const { nextEp, atEnd } = getNextEpisodeNumber(entry.progress, [], total);
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : null;

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border p-2.5 transition-colors ${
        isActive
          ? "border-accent/50 bg-accent-soft"
          : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={`Show ${title} in main viewer`}
      >
        <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-2">
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-surface-3" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-1 text-xs font-semibold text-fg transition-colors group-hover:text-accent-strong"
            title={title}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {total !== null && total > 0
              ? `Ep ${atEnd ? total : nextEp} of ${total}`
              : `Ep ${nextEp}`}
            {percent !== null ? ` · ${percent}%` : ""}
          </p>
        </div>
      </button>

      {/* Quick mark episode */}
      <button
        type="button"
        disabled={isPending || atEnd}
        onClick={(e) => {
          e.stopPropagation();
          onIncrement(anime.id);
        }}
        aria-label={`Mark episode ${nextEp} watched`}
        className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
          atEnd
            ? "border border-border bg-surface-2 text-faint"
            : "bg-accent-soft text-accent-strong hover:bg-accent hover:text-accent-contrast"
        }`}
      >
        {atEnd ? (
          <CheckIcon className="h-3 w-3 text-success" />
        ) : (
          <PlayIcon className="h-2.5 w-2.5 fill-current" />
        )}
        <span className="text-[11px]">
          {atEnd ? "Done" : `Ep ${nextEp}`}
        </span>
      </button>
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
    );

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const featuredItem =
    (selectedId !== null ? watching.find((it) => it.anime.id === selectedId) : null) ??
    watching[0] ??
    null;

  return (
    <section aria-label="Continue watching" className="space-y-3.5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <Link
          href="/library?status=watching"
          className="group inline-flex items-center gap-1 font-display text-base font-semibold tracking-tight text-fg transition-colors hover:text-accent-strong sm:text-lg"
        >
          <span>Continue watching</span>
          <ChevronRightIcon className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href="/library"
          className="group inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          <span>My library</span>
          <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Main content */}
      {!featuredItem ? (
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
        <div className="space-y-3.5">
          <FeaturedAngularCard
            item={featuredItem}
            watchedEpisodes={watchedEpisodesFor(featuredItem.anime.id)}
            isPending={pendingIds.has(featuredItem.anime.id)}
            titleLanguage={preferences.titleLanguage}
            onIncrement={(id) => void incrementProgress(id)}
          />

          {watching.length > 1 ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  More in progress ({watching.length})
                </span>
                <span className="text-[11px] text-faint">
                  Click a title to focus
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {watching.map((item) => (
                  <CompanionCard
                    key={item.entry.id}
                    item={item}
                    isActive={item.anime.id === featuredItem.anime.id}
                    onSelect={() => setSelectedId(item.anime.id)}
                    onIncrement={(id) => void incrementProgress(id)}
                    isPending={pendingIds.has(item.anime.id)}
                    titleLanguage={preferences.titleLanguage}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
