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

/**
 * Scalable SVG vector base defining the outer angular silhouette, surface, and glow.
 */
function AngularCardBase() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none"
      viewBox="0 0 1000 360"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="angular-card-surface"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#0b0b14" />
          <stop offset="50%" stopColor="#0e0e1a" />
          <stop offset="100%" stopColor="#121025" />
        </linearGradient>

        <linearGradient
          id="angular-card-border"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.75" />
          <stop offset="30%" stopColor="#a855f7" stopOpacity="0.6" />
          <stop offset="68%" stopColor="#6d28d9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#c084fc" stopOpacity="0.85" />
        </linearGradient>

        <filter
          id="angular-card-glow"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
        >
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="6"
            floodColor="#8b5cf6"
            floodOpacity="0.25"
          />
        </filter>
      </defs>

      {/* Outer Card Silhouette Path */}
      <path
        d="M 0,24
           C 0,10.7 10.7,0 24,0
           L 680,0
           L 705,7
           L 966,7
           L 1000,41
           L 1000,318
           L 958,360
           L 24,360
           C 10.7,360 0,349.3 0,336
           Z"
        fill="url(#angular-card-surface)"
        stroke="url(#angular-card-border)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        filter="url(#angular-card-glow)"
      />
    </svg>
  );
}

/**
 * Foreground SVG overlay for high-precision vector accents:
 * - Inner angled chevron divider separating artwork and content
 * - Top joint purple tab
 * - Bottom-right glowing chamfer accent strip
 */
function AngularCardOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none"
      viewBox="0 0 1000 360"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top Joint Accent Tab where artwork meets content */}
      <rect x="338" y="0" width="4" height="12" fill="#c084fc" rx="1" />

      {/* Bottom-Right Chamfer Accent Strip */}
      <line
        x1="958"
        y1="360"
        x2="1000"
        y2="318"
        stroke="#c084fc"
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Inner Angular Divider Line (< chevron slant) */}
      <path
        d="M 340,0
           L 340,12
           L 275,178
           L 358,360"
        stroke="#a855f7"
        strokeOpacity="0.8"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
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

  // Metadata chips
  const formatLabel = anime.format ? formatFormat(anime.format) : null;
  const animeSeason = (anime as unknown as { season?: AnimeSeason | null }).season;
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
      className="group relative min-h-[300px] w-full overflow-hidden transition-all duration-300 sm:min-h-[320px] md:min-h-[330px]"
    >
      {/* SVG Vector Base Frame with Custom Asymmetric Chamfers and Outline */}
      <AngularCardBase />

      {/* SVG Vector Foreground Overlay for glowing inner divider and accent tabs */}
      <AngularCardOverlay />

      {/* Subtle Atmospheric Artwork Watermark in bottom-right corner matching Image 1 */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-0 h-44 w-52 overflow-hidden opacity-15 mix-blend-screen select-none">
        <Image
          src="/hero-banner.jpg"
          alt=""
          fill
          sizes="200px"
          className="object-cover object-[70%_50%]"
        />
      </div>

      {/* Left Artwork Panel: edge-to-edge with matching angular inner slant */}
      <div
        className="absolute bottom-0 left-0 top-0 z-10 w-[36%] overflow-hidden rounded-l-2xl sm:w-[35%] md:w-[34%]"
        style={{
          clipPath: "polygon(0 0, 95% 0, 95% 4%, 77% 49.5%, 100% 100%, 0 100%)",
        }}
      >
        {cover && isHttpUrl(cover) ? (
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 38vw, (max-width: 1024px) 35vw, 320px"
            className="object-cover object-[center_20%] transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-[#19192b]" />
        )}

        {/* Ambient Dark Gradients over Artwork */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Content Area: safely starts to the right of the diagonal transition */}
      <div className="relative z-10 ml-[36%] flex min-h-[300px] flex-col justify-between py-5 pl-4 pr-6 sm:ml-[35%] sm:min-h-[320px] sm:py-6 sm:pl-6 sm:pr-8 md:ml-[34%] md:min-h-[330px] md:pl-7">
        {/* Top Section: Eyebrow, Title, Subtitle, and Top-Right Action Controls */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Eyebrow */}
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-[#a594fd] sm:text-[11px]">
                Continue Watching
              </p>

              {/* Title */}
              <Link
                href={`/anime/${anime.id}`}
                className="mt-1 line-clamp-1 block font-display text-xl font-bold tracking-wide text-white transition-colors hover:text-accent-strong sm:text-2xl md:text-[26px]"
                title={title}
              >
                {title}
              </Link>

              {/* Subtitle */}
              <p className="mt-0.5 text-xs font-medium text-white/65 sm:text-[13px]">
                {total !== null && total > 0
                  ? `Up next: episode ${atEnd ? total : nextEp} of ${total}`
                  : `Up next: episode ${nextEp}`}
              </p>
            </div>

            {/* Top-Right Bookmark & Overflow Actions */}
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5 sm:gap-2">
              <button
                type="button"
                onClick={handleToggleBookmark}
                aria-label={isBookmarked ? "Remove bookmark" : "Bookmark anime"}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all sm:h-10 sm:w-10 ${
                  isBookmarked
                    ? "border-accent/50 bg-accent/20 text-accent-strong"
                    : "border-white/10 bg-[#161626] text-white/60 hover:bg-[#1e1e32] hover:text-white"
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#161626] text-white/60 transition-colors hover:bg-[#1e1e32] hover:text-white sm:h-10 sm:w-10"
                >
                  <MoreHorizontalIcon className="h-4 w-4" />
                </button>

                {showMenu ? (
                  <div
                    className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-white/15 bg-[#141424]/95 p-1 shadow-2xl backdrop-blur-xl"
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
                      className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-white/90 hover:bg-white/10"
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

          {/* Metadata Chips Row: Format, Season/Year, Genres */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {formatLabel ? (
              <span className="rounded-lg border border-white/10 bg-[#161626] px-2.5 py-1 text-[11px] font-medium text-white/75 sm:text-xs">
                {formatLabel}
              </span>
            ) : null}

            {seasonLabelText ? (
              <span className="rounded-lg border border-white/10 bg-[#161626] px-2.5 py-1 text-[11px] font-medium text-white/75 sm:text-xs">
                {seasonLabelText}
              </span>
            ) : null}

            {genres.map((genre) => (
              <span
                key={genre}
                className="rounded-lg border border-white/10 bg-[#161626] px-2.5 py-1 text-[11px] font-medium text-white/75 sm:text-xs"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        {/* Lower Section: Progress Row, Progress Bar, and Action Buttons */}
        <div className="mt-4 sm:mt-5">
          {/* Progress Count & Percentage Row */}
          <div className="flex items-baseline justify-between text-xs sm:text-sm">
            <span className="text-white/65">
              <span className="font-bold tabular-nums text-white">
                {watchedCount}
              </span>
              {total && total > 0 ? ` / ${total}` : ""} episodes watched
            </span>
            <span className="font-bold tabular-nums text-white/90">
              {percent !== null ? `${percent}%` : "Total unknown"}
            </span>
          </div>

          {/* Full-width Progress Bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#181829]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] via-[#8b5cf6] to-[#a855f7] shadow-[0_0_12px_rgba(168,85,247,0.7)] transition-all duration-300"
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>

          {/* Actions Row: Large Primary Button + Secondary View Button */}
          <div className="mt-4 flex items-center gap-2.5 sm:mt-5 sm:gap-3">
            <button
              type="button"
              disabled={isPending || atEnd}
              onClick={() => onIncrement(anime.id)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-xs font-semibold text-white shadow-lg transition-all duration-150 active:scale-[0.98] sm:h-12 sm:text-sm ${
                atEnd
                  ? "cursor-default border border-white/10 bg-white/10 text-white/60"
                  : "bg-gradient-to-r from-[#5a21b6] via-[#6d28d9] to-[#7c3aed] shadow-[0_4px_18px_rgba(109,40,217,0.4)] hover:brightness-110"
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
                  <PlayIcon className="h-3.5 w-3.5 fill-white text-white" />
                  <span>Mark Episode {nextEp} Watched</span>
                </>
              )}
            </button>

            <Link
              href={`/anime/${anime.id}`}
              className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#161625] text-white/80 transition-all hover:bg-[#202035] hover:text-white sm:h-12 sm:w-16"
              aria-label={`View details for ${title}`}
            >
              <EyeIcon className="h-4 w-4" />
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/65">
                View
              </span>
            </Link>
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
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    [],
    total,
  );
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : null;

  return (
    <div
      className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border p-2.5 transition-all duration-200 ${
        isActive
          ? "border-accent bg-[#1c1433] shadow-[0_0_15px_rgba(124,58,237,0.2)] ring-1 ring-accent"
          : "border-white/10 bg-[#0d0d17] hover:border-white/20 hover:bg-[#141423]"
      }`}
    >
      {/* Clickable Card Body to select as featured */}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={`Show ${title} in main viewer`}
      >
        <div className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#161624]">
          {cover && isHttpUrl(cover) ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[#1e1d2c]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-1 text-xs font-semibold text-white group-hover:text-accent-strong transition-colors"
            title={title}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-white/55">
            {total !== null && total > 0
              ? `Ep ${atEnd ? total : nextEp} of ${total}`
              : `Ep ${nextEp}`}
            {percent !== null ? ` · ${percent}%` : ""}
          </p>
        </div>
      </button>

      {/* Quick Mark Episode Button */}
      <button
        type="button"
        disabled={isPending || atEnd}
        onClick={(e) => {
          e.stopPropagation();
          onIncrement(anime.id);
        }}
        aria-label={`Mark episode ${nextEp} watched`}
        className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-all ${
          atEnd
            ? "border border-white/10 bg-white/5 text-white/40"
            : "bg-accent/30 text-accent-strong hover:bg-accent hover:text-white"
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
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/library?status=watching"
          className="group inline-flex items-center gap-1 font-display text-base font-semibold tracking-tight text-white sm:text-lg transition-colors hover:text-accent-strong"
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
        <div className="space-y-3.5">
          {/* 1. Large Custom Angular Silhouette Featured Card */}
          <FeaturedAngularCard
            item={featuredItem}
            watchedEpisodes={watchedEpisodesFor(featuredItem.anime.id)}
            isPending={pendingIds.has(featuredItem.anime.id)}
            titleLanguage={preferences.titleLanguage}
            onIncrement={(id) => void incrementProgress(id)}
          />

          {/* 2. Companion In-Progress Rail when multiple series are tracked */}
          {watching.length > 1 ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  More in progress ({watching.length})
                </span>
                <span className="text-[11px] text-white/40">
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
