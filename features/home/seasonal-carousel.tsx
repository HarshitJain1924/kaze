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
    scrollRef.current.scrollBy({
      left: direction === "left" ? -520 : 520,
      behavior: "smooth",
    });
  };

  if (error || !items) return null;

  return (
    <section
      aria-label={title}
      className="border-t border-border pt-6 sm:pt-7"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Seasonal catalogue
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs text-muted">{description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {actionHref ? (
            <Link
              href={actionHref}
              className="group hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-accent-strong sm:inline-flex"
            >
              All titles
              <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              aria-label="Scroll seasonal titles left"
              className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              aria-label="Scroll seasonal titles right"
              className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="region"
        aria-label={`${title} poster shelf`}
        tabIndex={0}
        className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-1 sm:px-1"
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
              className="group w-[142px] shrink-0 snap-start sm:w-[156px]"
            >
              <div className="relative aspect-[2/3] overflow-hidden border border-border-subtle bg-surface-2">
                {cover && isHttpUrl(cover) ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 142px, 156px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                  />
                ) : (
                  <span className="absolute inset-0" />
                )}

                <Link
                  href={`/media/${anime.id}`}
                  aria-label={`View details for ${displayTitle}`}
                  className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
                />

                {score ? (
                  <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg">
                    <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
                    {score}
                  </span>
                ) : null}

                {entry ? (
                  <span
                    className="pointer-events-none absolute bottom-0 right-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-accent-strong"
                    title={`In library: ${entry.status}`}
                  >
                    <CheckIcon className="h-2.5 w-2.5" />
                    Tracked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => requestAdd(anime)}
                    aria-label={`Track ${displayTitle}`}
                    title="Add to planning"
                    className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center bg-bg/90 text-fg transition-colors hover:bg-accent hover:text-accent-contrast focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <PlusIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="pt-2">
                <p className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-faint">
                  {formatLabel ?? "Anime"}
                  {anime.seasonYear ? ` · ${anime.seasonYear}` : ""}
                </p>
                <h3
                  className="mt-0.5 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong"
                  title={displayTitle}
                >
                  {displayTitle}
                </h3>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
