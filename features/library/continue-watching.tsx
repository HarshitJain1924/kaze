"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BookmarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  GridIcon,
  ListIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PlayIcon,
  SlidersIcon,
} from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/components/providers/toast-provider";
import { useActiveTimeZone, usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import { formatAiringTime, toIsoDateString } from "@/lib/schedule";
import {
  cn,
  formatFormat,
  formatMediaKind,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";
import { seasonLabel } from "@/lib/season";
import type { AiringScheduleEntry, AnimeSeason, AnimeSummary } from "@/types/anime";
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
  airingToday?: AiringScheduleEntry | null;
  isPending: boolean;
  titleLanguage: "english" | "romaji";
  onIncrement: (id: number, targetEpisode?: number) => void;
  onPrevItem?: () => void;
  onNextItem?: () => void;
}

export function FeaturedAngularCard({
  item,
  watchedEpisodes,
  airingToday,
  isPending,
  titleLanguage,
  onIncrement,
  onPrevItem,
  onNextItem,
}: FeaturedAngularCardProps) {
  const { entry, anime } = item;
  const { requestAdd, requestRemove, updateEntry } = useLibrary();
  const { activeTimeZone } = useActiveTimeZone();
  const { toast } = useToast();

  const [showMenu, setShowMenu] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const banner = anime.bannerImage ?? null;
  const accentColor = anime.coverImage.color ?? null;

  const manga = isManga(anime);
  const total = manga ? (anime.chapters ?? null) : anime.episodes;
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    watchedEpisodes,
    total,
  );

  const watchedCount = Math.max(
    entry.progress,
    watchedEpisodes.length > 0 ? Math.max(...watchedEpisodes) : 0,
  );

  const percent =
    total && total > 0
      ? Math.min(100, Math.round((watchedCount / total) * 100))
      : null;

  // Metadata chips
  const formatLabel = manga
    ? formatMediaKind(anime)
    : anime.format
      ? formatFormat(anime.format)
      : null;
  const animeSeason = (anime as unknown as { season?: AnimeSeason | null })
    .season;
  const seasonLabelText =
    animeSeason && anime.seasonYear
      ? `${seasonLabel(animeSeason)} ${anime.seasonYear}`
      : anime.seasonYear
        ? String(anime.seasonYear)
        : null;
  const genres = anime.genres ? anime.genres.slice(0, 3) : [];

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

  const handleDecrement = async () => {
    if (entry.progress <= 0 || isPending) return;
    const prevEp = Math.max(0, entry.progress - 1);
    await updateEntry(anime.id, { progress: prevEp });
    toast({
      title: "Progress updated",
      description: `${title}: ${manga ? "Chapter" : "Episode"} ${prevEp}`,
    });
  };

  return (
    <article
      aria-label={`Featured: ${title}`}
      className="group relative isolate overflow-hidden border-y border-border bg-bg"
    >
      {/* Ambient Artwork Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 hidden select-none overflow-hidden"
      >
        {cover && isHttpUrl(cover) ? (
          <div className="absolute inset-0 scale-125 blur-3xl saturate-200 opacity-20 dark:opacity-35">
            <Image
              src={banner ?? cover}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : null}

        {banner && isHttpUrl(banner) ? (
          <div className="absolute inset-0">
            <Image
              src={banner}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[center_20%] sm:object-[center_25%] opacity-85 dark:opacity-80 transition-opacity duration-500"
            />
          </div>
        ) : cover && isHttpUrl(cover) ? (
          <div className="absolute right-0 top-0 bottom-0 w-2/3 sm:w-1/2 overflow-hidden pointer-events-none select-none">
            <div className="relative h-full w-full">
              <Image
                src={cover}
                alt=""
                fill
                sizes="(max-width: 640px) 66vw, 50vw"
                className="object-cover object-top opacity-35 dark:opacity-30 transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent" />
            </div>
          </div>
        ) : null}

        {/* Dynamic color tint */}
        {accentColor ? (
          <div
            className="absolute inset-0 opacity-20 dark:opacity-25 mix-blend-screen"
            style={{
              background: `radial-gradient(circle at 85% 25%, ${accentColor} 0%, transparent 65%)`,
            }}
          />
        ) : null}

        {/* Multi-directional gradients: protect text on the left, let artwork shine through clearly on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 via-45% to-surface/15 dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/85 via-surface/40 via-30% to-transparent sm:hidden" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:p-6">
        {/* Poster Card */}
        <Link
          href={`/media/${anime.id}`}
          className="group/poster relative aspect-[2/3] w-24 shrink-0 self-start overflow-hidden border border-border bg-surface-3 transition-colors sm:w-32 sm:self-center md:w-36"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 112px, 160px"
              className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
            />
          ) : (
            <span className="absolute inset-0 bg-surface-3" />
          )}

          {/* Floating next episode pill */}
          <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-accent-strong">
            <PlayIcon className="h-2.5 w-2.5 fill-current" />
            <span>Next: {manga ? "Ch" : "Ep"} {atEnd ? total : nextEp}</span>
          </span>
        </Link>

        {/* Info & Action Deck */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-accent-strong radar-live-dot" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
                    {manga ? "Continue Reading" : "Continue Watching"}
                  </p>
                  {!manga && airingToday ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
                      Episode {airingToday.episode} Airs Today ({formatAiringTime(airingToday.airingAt, activeTimeZone)})
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/media/${anime.id}`}
                  className="mt-1 line-clamp-1 block font-display text-xl font-bold tracking-tight text-fg transition-colors hover:text-accent-strong sm:text-2xl"
                  title={title}
                >
                  {title}
                </Link>

                <p className="mt-1 text-xs font-medium text-muted sm:text-[13px]">
                  {total !== null && total > 0
                    ? `Up next: ${manga ? "chapter" : "episode"} ${atEnd ? total : nextEp} of ${total}`
                    : `Up next: ${manga ? "chapter" : "episode"} ${nextEp}`}
                </p>
              </div>

              {/* Top Options Bar with Prev/Next series cycling */}
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                {onPrevItem && onNextItem ? (
                  <div className="flex items-center gap-0.5 mr-1">
                    <button
                      type="button"
                      onClick={onPrevItem}
                      aria-label="Previous series in queue"
                      title="Previous series"
                      className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onNextItem}
                      aria-label="Next series in queue"
                      title="Next series"
                      className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark anime"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl border transition-colors active:scale-95",
                    isBookmarked
                      ? "border-accent/50 bg-accent/20 text-accent-strong"
                      : "border-border-subtle bg-surface-3/60 text-muted hover:bg-surface-3 hover:text-fg",
                  )}
                >
                  <BookmarkIcon
                    className={cn("h-3.5 w-3.5", isBookmarked && "fill-current")}
                  />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMenu((prev) => !prev)}
                    aria-label="More options"
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-subtle bg-surface-3/60 text-muted transition-colors hover:bg-surface-3 hover:text-fg active:scale-95"
                  >
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </button>

                  {showMenu ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 w-48 border border-border bg-bg p-1 shadow-lg"
                      onMouseLeave={() => setShowMenu(false)}
                    >
                      <Link
                        href={`/media/${anime.id}`}
                        className="block px-2.5 py-2 text-xs font-medium text-fg hover:bg-surface-2"
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
                        className="w-full px-2.5 py-2 text-left text-xs font-medium text-fg hover:bg-surface-2"
                      >
                        Edit progress / status
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          requestRemove(anime.id);
                        }}
                        className="w-full px-2.5 py-2 text-left text-xs font-medium text-danger hover:bg-danger/10"
                      >
                        Remove from library
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {formatLabel ? (
                <span className="rounded-lg border border-border-subtle bg-surface-3/60 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {formatLabel}
                </span>
              ) : null}

              {seasonLabelText ? (
                <span className="rounded-lg border border-border-subtle bg-surface-3/60 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {seasonLabelText}
                </span>
              ) : null}

              {genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-lg border border-border-subtle bg-surface-3/60 px-2.5 py-0.5 text-[11px] font-medium text-faint"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          {/* Progress & Controls */}
          <div>
            <div className="flex items-baseline justify-between text-xs sm:text-sm">
              <span className="text-muted">
                <span className="font-bold tabular-nums text-fg">
                  {watchedCount}
                </span>
                {total && total > 0 ? ` / ${total}` : ""}{" "}
                {manga ? "chapters read" : "episodes watched"}
              </span>
              <span className="font-semibold tabular-nums text-accent-strong">
                {percent !== null ? `${percent}% Complete` : "Ongoing series"}
              </span>
            </div>

            {/* Glowing progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden bg-surface-3">
              <div
                className="h-full bg-accent-strong transition-[width] duration-300"
                style={{ width: `${percent ?? (watchedCount > 0 ? 30 : 0)}%` }}
              />
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isPending || atEnd}
                onClick={() => onIncrement(anime.id, nextEp)}
                className={cn(
                  "flex h-10 min-w-[190px] flex-1 items-center justify-center gap-2 px-5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors sm:h-11",
                  atEnd
                    ? "cursor-default border border-border text-muted"
                    : "bg-accent text-accent-contrast hover:bg-accent-hover hover:shadow-lg disabled:opacity-60",
                )}
              >
                {atEnd ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-success" />
                    <span>All caught up!</span>
                  </>
                ) : isPending ? (
                  <span>Updating progress…</span>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 fill-current" />
                    <span>
                      Mark {manga ? "Chapter" : "Episode"} {nextEp}{" "}
                      {manga ? "Read" : "Watched"}
                    </span>
                  </>
                )}
              </button>

              {/* Quick Undo / Decrement Stepper (-1 ep/ch) */}
              {entry.progress > 0 && !atEnd ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDecrement}
                  title={`Undo last ${manga ? "chapter" : "episode"} (-1)`}
                  className="flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:h-11 sm:w-11"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
              ) : null}

              {/* Quick Edit Progress Modal Trigger */}
              <button
                type="button"
                onClick={() => requestAdd(anime)}
                title="Adjust status & progress"
                className="flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:h-11 sm:w-11"
              >
                <SlidersIcon className="h-4 w-4" />
              </button>

              {/* View Details Link */}
              <Link
                href={`/media/${anime.id}`}
                className="inline-flex h-10 items-center gap-1.5 border border-border px-3.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-fg transition-colors hover:bg-surface-2 sm:h-11"
              >
                <EyeIcon className="h-3.5 w-3.5 text-muted" />
                <span>Details</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export interface QueueCardProps {
  item: LibraryItem & { anime: AnimeSummary };
  airingToday?: AiringScheduleEntry | null;
  isActive: boolean;
  onSelect: () => void;
  onIncrement: (id: number, targetEpisode?: number) => void;
  isPending: boolean;
  watchedEpisodes: number[];
  titleLanguage: "english" | "romaji";
}

export function QueueCard({
  item,
  airingToday,
  isActive,
  onSelect,
  onIncrement,
  isPending,
  watchedEpisodes,
  titleLanguage,
}: QueueCardProps) {
  const { entry, anime } = item;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const thumb = anime.coverImage.extraLarge ?? anime.coverImage.large;

  const manga = isManga(anime);
  const total = manga ? (anime.chapters ?? null) : anime.episodes;
  // Honour per-episode records so a gap (e.g. 1 and 3 watched) points at 2,
  // matching the featured player instead of skipping to progress + 1.
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    watchedEpisodes,
    total,
  );
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : null;

  return (
    <article
      onClick={onSelect}
      className={cn(
        "group/q relative flex cursor-pointer select-none flex-col justify-between overflow-hidden border transition-colors",
        isActive
          ? "border-accent bg-accent-soft/30"
          : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2",
      )}
    >
      {/* Artwork with integrated progress bar */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-3">
        {thumb && isHttpUrl(thumb) ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="192px"
            className="object-cover transition-transform duration-300 group-hover/q:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-surface-3" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Top-left next episode or Airing Today tag */}
        {!manga && airingToday ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/90 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
            <span>Ep {airingToday.episode} Today</span>
          </span>
        ) : (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
            <span>{manga ? "Ch" : "Ep"} {atEnd ? total : nextEp}</span>
          </span>
        )}

        {/* Active badge */}
        {isActive ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-xs">
            <span>Viewing</span>
          </span>
        ) : null}

        {/* Integrated Progress Bar along bottom of image */}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${percent ?? (entry.progress > 0 ? 30 : 0)}%` }}
          />
        </div>
      </div>

      {/* Info & 1-tap quick advance */}
      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-1 font-display text-xs font-bold text-fg transition-colors group-hover/q:text-accent-strong"
            title={title}
          >
            {title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {total ? `${entry.progress}/${total} ${manga ? "ch" : "eps"}` : `${entry.progress} ${manga ? "read" : "watched"}`}
            {percent !== null ? ` · ${percent}%` : ""}
          </p>
        </div>

        {/* Quick increment button */}
        <button
          type="button"
          disabled={isPending || atEnd}
          onClick={(e) => {
            e.stopPropagation();
            onIncrement(anime.id, nextEp);
          }}
          title={`Mark ${manga ? "chapter" : "episode"} ${nextEp} ${manga ? "read" : "watched"}`}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-all active:scale-95",
            atEnd
              ? "border border-border-subtle bg-surface-3 text-faint"
              : "border border-accent/40 bg-accent/20 text-accent-strong hover:bg-accent hover:text-accent-contrast shadow-xs",
          )}
        >
          {atEnd ? (
            <CheckIcon className="h-3 w-3 text-success" />
          ) : (
            <PlayIcon className="h-2.5 w-2.5 fill-current" />
          )}
          <span>{atEnd ? "Done" : `+${manga ? "Ch" : "Ep"}`}</span>
        </button>
      </div>
    </article>
  );
}

interface ContinueWatchingProps {
  todayEntries?: AiringScheduleEntry[] | null;
}

export function ContinueWatching({ todayEntries }: ContinueWatchingProps = {}) {
  const { items, incrementProgress, pendingIds, watchedEpisodesFor } =
    useLibrary();
  const { preferences } = usePreferences();
  const { activeTimeZone } = useActiveTimeZone();

  // Map of anime IDs releasing today in the active timezone
  const todayAiringMap = useMemo(() => {
    const map = new Map<number, AiringScheduleEntry>();
    if (!todayEntries || todayEntries.length === 0) return map;

    const todayIso = toIsoDateString(new Date(), activeTimeZone);
    for (const entry of todayEntries) {
      const entryIso = toIsoDateString(
        new Date(entry.airingAt * 1000),
        activeTimeZone,
      );
      if (entryIso === todayIso) {
        map.set(entry.mediaId, entry);
      }
    }
    return map;
  }, [todayEntries, activeTimeZone]);

  // Watching anime prioritized:
  // 1. Shows that have an episode airing TODAY come first!
  // 2. Shows with unwatched episodes sorted by last activity.
  // 3. Caught-up series.
  const watching = useMemo(() => {
    const list = items.filter(
      (item): item is LibraryItem & { anime: AnimeSummary } =>
        item.entry.status === "watching" && item.anime !== null,
    );

    return list.sort((a, b) => {
      const aAiring = todayAiringMap.get(a.anime.id);
      const bAiring = todayAiringMap.get(b.anime.id);

      // 1. Airing today priority
      if (aAiring && !bAiring) return -1;
      if (!aAiring && bAiring) return 1;
      if (aAiring && bAiring) {
        return aAiring.airingAt - bAiring.airingAt;
      }

      // 2. Uncompleted vs completed
      const aTotal = isManga(a.anime)
        ? (a.anime.chapters ?? null)
        : a.anime.episodes;
      const bTotal = isManga(b.anime)
        ? (b.anime.chapters ?? null)
        : b.anime.episodes;
      const aHasMore = aTotal === null || a.entry.progress < aTotal;
      const bHasMore = bTotal === null || b.entry.progress < bTotal;
      if (aHasMore && !bHasMore) return -1;
      if (!aHasMore && bHasMore) return 1;

      // 3. Most recently updated
      return (
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime()
      );
    });
  }, [items, todayAiringMap]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"shelf" | "grid">("shelf");
  const [showAllGrid, setShowAllGrid] = useState(false);
  const shelfScrollRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    if (!shelfScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = shelfScrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
  }, [watching.length, checkScroll]);

  const featuredItem =
    (selectedId !== null ? watching.find((it) => it.anime.id === selectedId) : null) ??
    watching[0] ??
    null;

  const handleShelfScroll = (direction: "left" | "right") => {
    if (!shelfScrollRef.current) return;
    const amount = direction === "left" ? -420 : 420;
    shelfScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(checkScroll, 350);
  };

  const handleCycleFocus = (direction: "prev" | "next") => {
    if (watching.length <= 1) return;
    const currentIndex = watching.findIndex(
      (it) => it.anime.id === featuredItem?.anime.id,
    );
    if (currentIndex === -1) return;
    const nextIndex =
      direction === "next"
        ? (currentIndex + 1) % watching.length
        : (currentIndex - 1 + watching.length) % watching.length;
    const target = watching[nextIndex];
    if (target) {
      setSelectedId(target.anime.id);
    }
  };

  const todayAiringCount = useMemo(() => {
    return watching.filter((it) => todayAiringMap.has(it.anime.id)).length;
  }, [watching, todayAiringMap]);

  const gridItems = showAllGrid ? watching : watching.slice(0, 6);

  const hasAnime = watching.some((it) => !isManga(it.anime));
  const hasManga = watching.some((it) => isManga(it.anime));
  const sectionTitle =
    hasAnime && hasManga
      ? "Continue watching & reading"
      : hasManga
        ? "Continue reading"
        : "Continue watching";

  return (
    <section aria-label={sectionTitle} className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/library?status=watching"
            className="group inline-flex items-center gap-1.5 font-display text-base font-bold tracking-tight text-fg transition-colors hover:text-accent-strong sm:text-lg"
          >
            <span>{sectionTitle}</span>
            <ChevronRightIcon className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
          {watching.length > 0 ? (
            <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong tabular-nums">
              {watching.length} active
            </span>
          ) : null}
          {todayAiringCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
              {todayAiringCount} airing today
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Shelf / Grid toggle */}
          {watching.length > 1 ? (
            <div className="inline-flex items-center border-b border-border text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode("shelf")}
                aria-label="Shelf view"
                className={cn(
                  "flex h-8 items-center gap-1.5 border-b-2 px-2.5 font-medium transition-colors",
                  viewMode === "shelf"
                    ? "border-accent text-accent-strong font-semibold"
                    : "border-transparent text-muted hover:text-fg",
                )}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Shelf</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all",
                  viewMode === "grid"
                    ? "border-accent text-accent-strong font-semibold"
                    : "border-transparent text-muted hover:text-fg",
                )}
              >
                <GridIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          ) : null}

          {/* Carousel Arrows (Shelf mode only) */}
          {viewMode === "shelf" && watching.length > 2 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleShelfScroll("left")}
                aria-label="Scroll queue left"
                className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleShelfScroll("right")}
                aria-label="Scroll queue right"
                className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <Link
            href="/library"
            className="group inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-fg ml-1"
          >
            <span>My library</span>
            <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      {!featuredItem ? (
        <EmptyState
          compact
          icon={<PlayIcon className="h-5 w-5" />}
          title="Nothing in progress"
          description="Mark an anime as Watching or a manga as Reading and it will appear here with one-tap updates."
          action={
            <Link
              href="/discover"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
            >
              Browse catalog
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* 1. Cinematic Featured Player Deck */}
          <FeaturedAngularCard
            item={featuredItem}
            watchedEpisodes={watchedEpisodesFor(featuredItem.anime.id)}
            airingToday={todayAiringMap.get(featuredItem.anime.id) ?? null}
            isPending={pendingIds.has(featuredItem.anime.id)}
            titleLanguage={preferences.titleLanguage}
            onIncrement={(id, ep) => void incrementProgress(id, ep)}
            onPrevItem={watching.length > 1 ? () => handleCycleFocus("prev") : undefined}
            onNextItem={watching.length > 1 ? () => handleCycleFocus("next") : undefined}
          />

          {/* 2. Up Next in Your Queue Shelf */}
          {watching.length > 1 ? (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Up next in your queue ({watching.length})
                  </span>
                  <span className="text-[11px] text-faint hidden sm:inline">
                    · Click any title to view
                  </span>
                </div>

                {/* Direct Shelf Arrows in row header */}
                {viewMode === "shelf" && watching.length > 2 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleShelfScroll("left")}
                      aria-label="Previous series in queue"
                      title="Scroll queue left"
                      className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShelfScroll("right")}
                      aria-label="Next series in queue"
                      title="Scroll queue right"
                      className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Shelf Carousel View with Floating Edge Navigation Arrows */}
              {viewMode === "shelf" ? (
                <div className="group/shelf relative">
                  {/* Floating Left Arrow */}
                  {canScrollLeft ? (
                    <button
                      type="button"
                      onClick={() => handleShelfScroll("left")}
                      aria-label="Scroll queue left"
                      className="absolute -left-3.5 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center border border-border bg-bg text-fg shadow-sm transition-colors hover:border-accent md:flex"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                  ) : null}

                  {/* Horizontal Scroll Track */}
                  <div
                    ref={shelfScrollRef}
                    tabIndex={0}
                    onScroll={checkScroll}
                    role="region"
                    aria-label="Queue shelf"
                    className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:-mx-0 sm:gap-3.5 sm:px-0 scroll-smooth snap-x snap-mandatory"
                  >
                    {watching.map((item) => {
                      const airingEntry = todayAiringMap.get(item.anime.id) ?? null;
                      return (
                        <div
                          key={item.entry.id}
                          className="w-44 sm:w-48 shrink-0 snap-start"
                        >
                          <QueueCard
                            item={item}
                            airingToday={airingEntry}
                            isActive={item.anime.id === featuredItem.anime.id}
                            onSelect={() => setSelectedId(item.anime.id)}
                            onIncrement={(id, ep) => void incrementProgress(id, ep)}
                            isPending={pendingIds.has(item.anime.id)}
                            watchedEpisodes={watchedEpisodesFor(item.anime.id)}
                            titleLanguage={preferences.titleLanguage}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Floating Right Arrow */}
                  {canScrollRight ? (
                    <button
                      type="button"
                      onClick={() => handleShelfScroll("right")}
                      aria-label="Scroll queue right"
                      className="absolute -right-3.5 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center border border-border bg-bg text-fg shadow-sm transition-colors hover:border-accent md:flex"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              ) : (
                /* Grid View */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {gridItems.map((item) => {
                      const airingEntry = todayAiringMap.get(item.anime.id) ?? null;
                      return (
                        <QueueCard
                          key={item.entry.id}
                          item={item}
                          airingToday={airingEntry}
                          isActive={item.anime.id === featuredItem.anime.id}
                          onSelect={() => setSelectedId(item.anime.id)}
                          onIncrement={(id, ep) => void incrementProgress(id, ep)}
                          isPending={pendingIds.has(item.anime.id)}
                          watchedEpisodes={watchedEpisodesFor(item.anime.id)}
                          titleLanguage={preferences.titleLanguage}
                        />
                      );
                    })}
                  </div>

                  {watching.length > 6 ? (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAllGrid((prev) => !prev)}
                        className="inline-flex h-8 items-center gap-1.5 border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted transition-colors hover:border-accent hover:text-fg"
                      >
                        <span>
                          {showAllGrid
                            ? "Show fewer"
                            : `Show all (${watching.length})`}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
