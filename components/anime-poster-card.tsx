"use client";

import Image from "next/image";
import Link from "next/link";

import { PlusIcon, StarIcon } from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatEpisodeCount,
  formatFormat,
  formatScore,
  getDisplayTitle,
  getSecondaryTitle,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

function isHexColor(value: string | null): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function PosterFallback({ color }: { color: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isHexColor(color)
          ? `radial-gradient(120% 90% at 20% 0%, ${color}55 0%, #12121a 65%)`
          : "radial-gradient(120% 90% at 20% 0%, #2a2140 0%, #12121a 70%)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-10 w-10 text-white/15"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
      >
        <path d="M4 19V5h16v14H4Z" />
        <path d="m7 16 3.5-4 2.5 3 2.5-3 2.5 4" />
        <circle cx="9" cy="9" r="1.4" />
      </svg>
    </div>
  );
}

export interface AnimePosterCardProps {
  anime: AnimeSummary;
  /** `below` keeps the title outside the artwork (used in the library). */
  metaMode?: "overlay" | "below";
  priority?: boolean;
  showQuickAdd?: boolean;
  className?: string;
  sizes?: string;
}

export function AnimePosterCard({
  anime,
  metaMode = "overlay",
  priority = false,
  showQuickAdd = true,
  className,
  sizes = "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 22vw, 17vw",
}: AnimePosterCardProps) {
  const { entryFor, requestAdd, pendingIds } = useLibrary();
  const { preferences } = usePreferences();

  const entry = entryFor(anime.id);
  const title = getDisplayTitle(
    anime.title,
    preferences.titleLanguage === "english",
  );
  const secondary = getSecondaryTitle(anime.title, title);
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const score = formatScore(anime.averageScore);
  const formatLabel = formatFormat(anime.format);
  const meta = [formatLabel, anime.seasonYear ? String(anime.seasonYear) : null]
    .filter(Boolean)
    .join(" · ");

  const totalEpisodes = anime.episodes;
  const percent =
    entry && totalEpisodes && totalEpisodes > 0
      ? Math.min(100, Math.round((entry.progress / totalEpisodes) * 100))
      : 0;

  return (
    <article className={cn("group relative flex flex-col transition-transform duration-200 ease-out hover:-translate-y-1", className)}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm transition-all duration-200 ease-out group-hover:border-border group-hover:shadow-md">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <PosterFallback color={anime.coverImage.color} />
        )}

        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0",
            metaMode === "overlay"
              ? "bg-gradient-to-t from-black/90 via-black/30 to-black/5"
              : "bg-gradient-to-t from-black/60 via-transparent to-transparent",
          )}
        />

        <Link
          href={`/anime/${anime.id}`}
          aria-label={`View details for ${title}`}
          className="absolute inset-0 z-10 rounded-xl"
        />

        {score ? (
          <span className="pointer-events-none absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300 tabular-nums shadow-sm">
            <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
            {score}
          </span>
        ) : null}

        {showQuickAdd && !entry ? (
          <button
            type="button"
            onClick={() => requestAdd(anime)}
            aria-label={`Add ${title} to your library`}
            className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white transition-all duration-150 hover:scale-105 hover:border-accent hover:bg-accent hover:text-accent-contrast focus-visible:opacity-100 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        ) : null}

        {entry ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2.5 pb-2.5">
            {totalEpisodes && totalEpisodes > 0 ? (
              <div className="space-y-1">
                <div className="h-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-accent-strong"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                {metaMode === "below" ? (
                  <p className="text-[10px] font-medium text-white/80">
                    {entry.progress} / {totalEpisodes} episodes
                  </p>
                ) : null}
              </div>
            ) : entry.progress > 0 && metaMode === "below" ? (
              <p className="text-[10px] font-medium text-white/80">
                {formatEpisodeCount(entry.progress, { short: true })} watched
              </p>
            ) : null}
          </div>
        ) : null}

        {metaMode === "overlay" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-1 p-2.5 pt-12">
            {entry ? (
              <StatusBadge
                status={entry.status}
                className="border-white/15 bg-black/55 text-white/90 backdrop-blur-sm"
              />
            ) : null}
            <h3 className="line-clamp-2-safe font-display text-[13px] font-semibold leading-snug text-white sm:text-sm">
              {title}
            </h3>
            <p className="text-[11px] font-medium text-white/70">
              {meta}
              {entry && totalEpisodes
                ? ` · ${entry.progress}/${totalEpisodes}`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      {metaMode === "below" ? (
        <div className="mt-2 space-y-0.5">
          <Link
            href={`/anime/${anime.id}`}
            className="line-clamp-1 block text-[13px] font-semibold leading-snug text-fg transition-colors hover:text-accent-strong sm:text-sm"
          >
            {title}
          </Link>
          {secondary && secondary !== title ? (
            <p className="line-clamp-1 text-[11px] text-faint">{secondary}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted pt-0.5">
            {entry ? <StatusBadge status={entry.status} /> : null}
            {entry?.score ? (
              <span className="inline-flex items-center gap-1 text-warning">
                <StarIcon className="h-3 w-3 fill-current" />
                {entry.score}
              </span>
            ) : null}
            {meta ? <span>{meta}</span> : null}
          </div>
        </div>
      ) : null}

      {pendingIds.has(anime.id) ? (
        <span className="sr-only" role="status">
          Updating {title}
        </span>
      ) : null}
    </article>
  );
}
