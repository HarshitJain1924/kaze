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
    <article className="border-y border-border bg-bg">
      <div className="grid gap-6 py-6 sm:grid-cols-[156px_minmax(0,1fr)] sm:items-start lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <Link
          href={`/media/${anime.id}`}
          className="group/poster relative aspect-[2/3] w-full max-w-[210px] justify-self-start overflow-hidden border border-border bg-surface-3 sm:max-w-none"
          aria-label={`Open ${title}`}
        >
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 210px, 264px"
              className="object-cover transition-transform duration-500 group-hover/poster:scale-[1.02]"
            />
          ) : (
            <span className="absolute inset-0 bg-surface-3" />
          )}

          <span className="absolute inset-x-0 bottom-0 bg-bg/90 px-2.5 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
            Next {manga ? "chapter" : "episode"}{" "}
            {atEnd ? total : nextEp}
          </span>
        </Link>

        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  {manga ? "Continue reading" : "Continue watching"}
                </p>
                <h2 className="mt-1.5 text-balance font-display text-[28px] font-semibold leading-[1.04] tracking-[-0.045em] text-fg sm:text-[34px] lg:text-[38px]">
                  <Link
                    href={`/media/${anime.id}`}
                    className="transition-colors hover:text-accent-strong"
                  >
                    {title}
                  </Link>
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {onPrevItem && onNextItem ? (
                  <>
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
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={handleToggleBookmark}
                  aria-label={isBookmarked ? "Remove bookmark" : "Bookmark title"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center border transition-colors",
                    isBookmarked
                      ? "border-accent/50 text-accent-strong"
                      : "border-border text-muted hover:bg-surface-2 hover:text-fg",
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
                    aria-expanded={showMenu}
                    className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
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

            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              {formatLabel ? <span>{formatLabel}</span> : null}
              {seasonLabelText ? (
                <>
                  <span className="text-border">/</span>
                  <span>{seasonLabelText}</span>
                </>
              ) : null}
              {genres.map((genre) => (
                <span key={genre} className="text-faint">
                  <span className="mr-2 text-border">/</span>
                  {genre}
                </span>
              ))}
            </p>

            {!manga && airingToday ? (
              <p className="mt-2 text-[10px] font-medium text-success">
                Episode {airingToday.episode} airs today ·{" "}
                {formatAiringTime(airingToday.airingAt, activeTimeZone)}
              </p>
            ) : null}

            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              {total !== null && total > 0
                ? `Up next: ${manga ? "chapter" : "episode"} ${atEnd ? total : nextEp} of ${total}.`
                : `Up next: ${manga ? "chapter" : "episode"} ${nextEp}.`}
            </p>

            <div className="mt-4 max-w-xl">
              <div className="flex items-baseline justify-between gap-4 text-[10px] uppercase tracking-[0.08em] text-faint">
                <span>
                  <span className="font-mono font-semibold tabular-nums text-fg">
                    {watchedCount}
                  </span>
                  {total && total > 0 ? ` / ${total}` : ""}{" "}
                  {manga ? "chapters read" : "episodes watched"}
                </span>
                <span className="font-mono tabular-nums text-accent-strong">
                  {percent !== null ? `${percent}%` : "Ongoing"}
                </span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden bg-surface-3">
                <div
                  className="h-full bg-accent-strong transition-[width] duration-300"
                  style={{
                    width: `${percent ?? (watchedCount > 0 ? 30 : 0)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isPending || atEnd}
              onClick={() => onIncrement(anime.id, nextEp)}
              className={cn(
                "flex h-11 min-w-[220px] flex-1 items-center justify-center gap-2 px-5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors sm:flex-none",
                atEnd
                  ? "cursor-default border border-border text-muted"
                  : "bg-accent text-accent-contrast hover:bg-accent-hover disabled:opacity-60",
              )}
            >
              {atEnd ? (
                <>
                  <CheckIcon className="h-4 w-4 text-success" />
                  All caught up
                </>
              ) : isPending ? (
                "Updating progress…"
              ) : (
                <>
                  <PlayIcon className="h-3.5 w-3.5 fill-current" />
                  Mark {manga ? "chapter" : "episode"} {nextEp}{" "}
                  {manga ? "read" : "watched"}
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              {entry.progress > 0 && !atEnd ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleDecrement}
                  title={`Undo last ${manga ? "chapter" : "episode"}`}
                  aria-label={`Undo last ${manga ? "chapter" : "episode"}`}
                  className="flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => requestAdd(anime)}
                title="Adjust status and progress"
                aria-label="Adjust status and progress"
                className="flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <SlidersIcon className="h-4 w-4" />
              </button>
              <Link
                href={`/media/${anime.id}`}
                className="inline-flex h-10 items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:text-fg"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                Details
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
      className={cn(
        "group/q relative flex items-center gap-3 border-b border-border px-1 py-3 transition-colors",
        isActive
          ? "border-l-2 border-l-accent bg-accent-soft/25 pl-2"
          : "hover:bg-surface/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Feature ${title}`}
        aria-pressed={isActive}
        className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-border bg-surface-2"
      >
        {thumb && isHttpUrl(thumb) ? (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 bg-surface-3" />
        )}
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate font-display text-xs font-medium text-fg transition-colors group-hover/q:text-accent-strong">
          {title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-muted">
          {total
            ? `${entry.progress}/${total} ${manga ? "ch" : "eps"}`
            : `${entry.progress} ${manga ? "read" : "watched"}`}
          {percent !== null ? ` · ${percent}%` : ""}
          {airingToday ? " · airs today" : ""}
        </span>
        <span className="mt-1.5 block h-[2px] w-full bg-surface-3">
          <span
            className="block h-full bg-accent-strong/80"
            style={{
              width: `${percent ?? (entry.progress > 0 ? 30 : 0)}%`,
            }}
          />
        </span>
      </button>

      <button
        type="button"
        disabled={isPending || atEnd}
        onClick={(e) => {
          e.stopPropagation();
          onIncrement(anime.id, nextEp);
        }}
        title={`Mark ${manga ? "chapter" : "episode"} ${nextEp} ${manga ? "read" : "watched"}`}
        aria-label={`Mark ${manga ? "chapter" : "episode"} ${nextEp} ${manga ? "read" : "watched"}`}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center border transition-colors",
          atEnd
            ? "border-border text-faint"
            : "border-border text-accent-strong hover:border-accent hover:bg-accent-soft",
        )}
      >
        {atEnd ? (
          <CheckIcon className="h-3 w-3 text-success" />
        ) : (
          <PlayIcon className="h-2.5 w-2.5 fill-current" />
        )}
      </button>
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
    <section aria-label={sectionTitle} className="space-y-4 sm:space-y-5 border-t border-border pt-4 sm:pt-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Personal activity
          </p>
          <Link
            href="/library?status=watching"
            className="group mt-1 inline-flex items-center gap-1.5 font-display text-2xl font-semibold tracking-[-0.035em] text-fg transition-colors hover:text-accent-strong sm:text-[28px]"
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
                    Supporting queue ({watching.length})
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
                          className="w-60 shrink-0 snap-start"
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
