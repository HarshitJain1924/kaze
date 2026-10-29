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
import { cn, formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";
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

  const total = anime.episodes;
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
  const formatLabel = anime.format ? formatFormat(anime.format) : null;
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
      description: `${title}: Episode ${prevEp}`,
    });
  };

  return (
    <article
      aria-label={`Featured: ${title}`}
      className="group relative isolate overflow-hidden rounded-3xl border border-white/15 bg-surface-2 shadow-xl transition-all"
    >
      {/* Ambient Artwork Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden z-0"
      >
        {cover && isHttpUrl(cover) ? (
          <div className="absolute inset-0 scale-125 blur-3xl saturate-200 opacity-20 dark:opacity-30">
            <Image
              src={banner ?? cover}
              alt=""
              fill
              unoptimized
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
              unoptimized
              sizes="100vw"
              className="object-cover object-[center_30%] opacity-25"
            />
          </div>
        ) : null}

        {/* Dynamic color tint */}
        {accentColor ? (
          <div
            className="absolute inset-0 opacity-20 mix-blend-screen"
            style={{
              background: `radial-gradient(circle at 85% 25%, ${accentColor} 0%, transparent 65%)`,
            }}
          />
        ) : null}

        {/* Multi-directional gradients */}
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/95 via-45% to-surface/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:p-6">
        {/* Poster Card */}
        <Link
          href={`/anime/${anime.id}`}
          className="group/poster relative aspect-[2/3] w-28 shrink-0 self-start sm:self-center overflow-hidden rounded-2xl border border-white/20 bg-surface-3 shadow-xl ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.02] sm:w-36 md:w-40"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 640px) 112px, 160px"
              className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
            />
          ) : (
            <span className="absolute inset-0 bg-surface-3" />
          )}

          {/* Floating next episode pill */}
          <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-black/80 px-2 py-0.5 text-[10px] font-bold text-accent-strong backdrop-blur-md shadow-sm">
            <PlayIcon className="h-2.5 w-2.5 fill-current" />
            <span>Next: Ep {atEnd ? total : nextEp}</span>
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
                    Continue Watching
                  </p>
                  {airingToday ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/70 px-2 py-0.5 text-[10px] font-bold text-emerald-300 shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
                      Episode {airingToday.episode} Airs Today ({formatAiringTime(airingToday.airingAt, activeTimeZone)})
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/anime/${anime.id}`}
                  className="mt-1 line-clamp-1 block font-display text-xl font-bold tracking-tight text-white transition-colors hover:text-accent-strong sm:text-2xl"
                  title={title}
                >
                  {title}
                </Link>

                <p className="mt-1 text-xs font-medium text-white/70 sm:text-[13px]">
                  {total !== null && total > 0
                    ? `Up next: episode ${atEnd ? total : nextEp} of ${total}`
                    : `Up next: episode ${nextEp}`}
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
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                    >
                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onNextItem}
                      aria-label="Next series in queue"
                      title="Next series"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
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
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
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
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    <MoreHorizontalIcon className="h-4 w-4" />
                  </button>

                  {showMenu ? (
                    <div
                      className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-white/15 bg-surface p-1 shadow-2xl backdrop-blur-xl"
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

            {/* Metadata Badges */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {formatLabel ? (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                  {formatLabel}
                </span>
              ) : null}

              {seasonLabelText ? (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                  {seasonLabelText}
                </span>
              ) : null}

              {genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white/60"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          {/* Progress & Controls */}
          <div>
            <div className="flex items-baseline justify-between text-xs sm:text-sm">
              <span className="text-white/70">
                <span className="font-bold tabular-nums text-white">
                  {watchedCount}
                </span>
                {total && total > 0 ? ` / ${total}` : ""} episodes watched
              </span>
              <span className="font-semibold tabular-nums text-accent-strong">
                {percent !== null ? `${percent}% Complete` : "Ongoing series"}
              </span>
            </div>

            {/* Glowing progress bar */}
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-all duration-300"
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
                  "flex h-10 flex-1 min-w-[190px] items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold shadow-md transition-all active:scale-[0.98] sm:h-11 sm:text-sm",
                  atEnd
                    ? "cursor-default border border-white/10 bg-white/5 text-white/60"
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
                    <span>Mark Episode {nextEp} Watched</span>
                  </>
                )}
              </button>

              {/* Quick Undo / Decrement Stepper (-1 ep) */}
              {entry.progress > 0 && !atEnd ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDecrement}
                  title="Undo last episode (-1)"
                  className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
              ) : null}

              {/* Quick Edit Progress Modal Trigger */}
              <button
                type="button"
                onClick={() => requestAdd(anime)}
                title="Adjust status & progress"
                className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-all active:scale-95"
              >
                <SlidersIcon className="h-4 w-4" />
              </button>

              {/* View Details Link */}
              <Link
                href={`/anime/${anime.id}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 text-xs font-semibold text-white transition-all hover:bg-white/10 active:scale-95 sm:h-11"
              >
                <EyeIcon className="h-3.5 w-3.5 text-white/70" />
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
  titleLanguage: "english" | "romaji";
}

export function QueueCard({
  item,
  airingToday,
  isActive,
  onSelect,
  onIncrement,
  isPending,
  titleLanguage,
}: QueueCardProps) {
  const { entry, anime } = item;
  const title = getDisplayTitle(anime.title, titleLanguage === "english");
  const thumb = anime.coverImage.extraLarge ?? anime.coverImage.large;

  const total = anime.episodes;
  const { nextEp, atEnd } = getNextEpisodeNumber(entry.progress, [], total);
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : null;

  return (
    <article
      onClick={onSelect}
      className={cn(
        "group/q relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer select-none",
        isActive
          ? "border-accent ring-2 ring-accent/60 bg-accent/10 shadow-lg scale-[1.01]"
          : "border-white/10 bg-surface hover:border-white/20 hover:bg-surface-2",
      )}
    >
      {/* Artwork with integrated progress bar */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-3">
        {thumb && isHttpUrl(thumb) ? (
          <Image
            src={thumb}
            alt=""
            fill
            unoptimized
            sizes="192px"
            className="object-cover transition-transform duration-300 group-hover/q:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-surface-3" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Top-left next episode or Airing Today tag */}
        {airingToday ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/90 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
            <span>Ep {airingToday.episode} Today</span>
          </span>
        ) : (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
            <span>Ep {atEnd ? total : nextEp}</span>
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
            className="line-clamp-1 font-display text-xs font-bold text-white transition-colors group-hover/q:text-accent-strong"
            title={title}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-white/60">
            {total ? `${entry.progress}/${total} eps` : `${entry.progress} watched`}
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
          title={`Mark episode ${nextEp} watched`}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-all active:scale-95",
            atEnd
              ? "border border-white/10 bg-white/5 text-white/40"
              : "border border-accent/40 bg-accent/20 text-accent-strong hover:bg-accent hover:text-accent-contrast shadow-xs",
          )}
        >
          {atEnd ? (
            <CheckIcon className="h-3 w-3 text-success" />
          ) : (
            <PlayIcon className="h-2.5 w-2.5 fill-current" />
          )}
          <span>{atEnd ? "Done" : `+Ep`}</span>
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

      // 2. Unwatched vs completed
      const aHasMore = a.anime.episodes === null || a.entry.progress < a.anime.episodes;
      const bHasMore = b.anime.episodes === null || b.entry.progress < b.anime.episodes;
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

  return (
    <section aria-label="Continue watching" className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/library?status=watching"
            className="group inline-flex items-center gap-1.5 font-display text-base font-bold tracking-tight text-fg transition-colors hover:text-accent-strong sm:text-lg"
          >
            <span>Continue watching</span>
            <ChevronRightIcon className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>
          {watching.length > 0 ? (
            <span className="inline-flex items-center rounded-lg border border-accent/30 bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-strong tabular-nums">
              {watching.length} active
            </span>
          ) : null}
          {todayAiringCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
              {todayAiringCount} airing today
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Shelf / Grid toggle */}
          {watching.length > 1 ? (
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-surface-2 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("shelf")}
                aria-label="Shelf view"
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-all",
                  viewMode === "shelf"
                    ? "bg-accent text-accent-contrast shadow-xs font-semibold"
                    : "text-muted hover:text-fg",
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
                    ? "bg-accent text-accent-contrast shadow-xs font-semibold"
                    : "text-muted hover:text-fg",
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
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-muted transition-colors hover:border-white/20 hover:bg-surface-3 hover:text-fg active:scale-95"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleShelfScroll("right")}
                aria-label="Scroll queue right"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-muted transition-colors hover:border-white/20 hover:bg-surface-3 hover:text-fg active:scale-95"
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
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-white/70 hover:border-white/20 hover:bg-surface-3 hover:text-white transition-all active:scale-95"
                    >
                      <ChevronLeftIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShelfScroll("right")}
                      aria-label="Next series in queue"
                      title="Scroll queue right"
                      className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2 text-white/70 hover:border-white/20 hover:bg-surface-3 hover:text-white transition-all active:scale-95"
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
                      className="absolute -left-3.5 top-1/2 -translate-y-1/2 z-30 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/90 text-white shadow-2xl backdrop-blur-md transition-all hover:scale-110 hover:border-accent hover:bg-black active:scale-95"
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
                      className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-30 hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/90 text-white shadow-2xl backdrop-blur-md transition-all hover:scale-110 hover:border-accent hover:bg-black active:scale-95"
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
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-surface-2 px-4 text-xs font-semibold text-white/80 hover:bg-surface-3 hover:text-white transition-colors"
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
