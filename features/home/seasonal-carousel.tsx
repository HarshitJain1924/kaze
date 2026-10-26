"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { formatFormat, formatScore, getDisplayTitle, isHttpUrl } from "@/lib/utils";
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
              className="group inline-flex items-center gap-0.5 text-xs font-medium text-muted transition-colors hover:text-fg"
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
        className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 py-1 sm:-mx-1 sm:px-1"
      >
        {items.map((anime) => {
          const displayTitle = getDisplayTitle(
            anime.title,
            preferences.titleLanguage === "english",
          );
          const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
          const score = formatScore(anime.averageScore);
          const meta = [
            anime.format ? formatFormat(anime.format) : null,
            anime.seasonYear ? String(anime.seasonYear) : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <article
              key={anime.id}
              className="group relative aspect-[2/3] w-[140px] shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm transition-all duration-200 hover:border-border sm:w-[155px]"
            >
              {cover && isHttpUrl(cover) ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-3" />
              )}

              {/* Gradient overlays */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

              {/* Top-left score badge */}
              {score ? (
                <span className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-warning tabular-nums shadow-sm backdrop-blur-md">
                  <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  {score}
                </span>
              ) : null}

              {/* Bottom metadata */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2.5 pt-8">
                <h3
                  className="line-clamp-1 font-display text-[13px] font-bold text-white transition-colors group-hover:text-accent-strong"
                  title={displayTitle}
                >
                  {displayTitle}
                </h3>
                {meta ? (
                  <p className="mt-0.5 text-[10px] font-medium text-white/70">
                    {meta}
                  </p>
                ) : null}
              </div>

              {/* Full link */}
              <Link
                href={`/anime/${anime.id}`}
                aria-label={`View details for ${displayTitle}`}
                className="absolute inset-0 z-20 rounded-xl"
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
