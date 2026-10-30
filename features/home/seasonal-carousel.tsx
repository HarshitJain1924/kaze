"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

interface SeasonalCarouselProps {
  title: string;
  description?: string;
  actionHref?: string;
  items: AnimeSummary[] | null;
  error?: boolean;
}

export function SeasonalCarousel({
  title,
  description,
  actionHref,
  items,
  error,
}: SeasonalCarouselProps) {
  const { preferences } = usePreferences();
  const { entryFor, requestAdd } = useLibrary();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === "left" ? -460 : 460;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  if (error || !items) {
    return null;
  }

  return (
    <section aria-label={title} className="space-y-3.5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-fg sm:text-lg">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted">{description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-accent-strong"
            >
              <span>View all</span>
              <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}

          {/* Left/Right carousel buttons */}
          <div className="hidden items-center gap-1 sm:flex ml-2">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              aria-label="Scroll left"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition-colors hover:border-border hover:bg-surface-3 hover:text-fg active:scale-95"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              aria-label="Scroll right"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition-colors hover:border-border hover:bg-surface-3 hover:text-fg active:scale-95"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontally scrollable carousel */}
      <div
        ref={scrollRef}
        className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 py-1.5 sm:-mx-1 sm:px-1"
      >
        {items.map((anime) => {
          const displayTitle = getDisplayTitle(
            anime.title,
            preferences.titleLanguage === "english",
          );
          const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
          const score = formatScore(anime.averageScore);
          const formatLabel = formatFormat(anime.format);
          const entry = entryFor(anime.id);

          return (
            <article
              key={anime.id}
              className="group relative aspect-[2/3] w-[145px] sm:w-[160px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl"
            >
              {cover && isHttpUrl(cover) ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  unoptimized
                  sizes="170px"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-3" />
              )}

              {/* Ambient Dark Scrim */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />

              {/* Clickable Full Link */}
              <Link
                href={`/anime/${anime.id}`}
                aria-label={`View details for ${displayTitle}`}
                className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent"
              />

              {/* Top-left score badge */}
              {score ? (
                <span className="pointer-events-none absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 tabular-nums shadow-xs backdrop-blur-md">
                  <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{score}</span>
                </span>
              ) : null}

              {/* Top-right format badge or quick-track button */}
              <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                {entry ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md border border-accent/40 bg-accent/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-xs">
                    <CheckIcon className="h-2.5 w-2.5" />
                    <span className="capitalize">{entry.status}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      requestAdd(anime);
                    }}
                    aria-label={`Track ${displayTitle}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white shadow-md opacity-90 transition-all hover:scale-110 hover:border-accent hover:bg-accent hover:text-accent-contrast active:scale-95 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Bottom metadata overlaid inside the poster */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2.5 pt-8 space-y-0.5">
                {formatLabel && !entry ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                    {formatLabel} {anime.episodes ? `· ${anime.episodes} eps` : ""}
                  </span>
                ) : null}

                <h3
                  className="line-clamp-2 font-display text-xs sm:text-[13px] font-bold leading-snug text-white transition-colors group-hover:text-accent-strong drop-shadow-sm"
                  title={displayTitle}
                >
                  {displayTitle}
                </h3>

                <p className="text-[10px] font-medium text-white/70">
                  {formatLabel} {anime.seasonYear ? `· ${anime.seasonYear}` : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
