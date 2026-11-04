import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from "@/components/icons";
import { AnimeTrailerModal } from "@/features/anime/anime-trailer-modal";
import { seasonLabel } from "@/lib/season";
import {
  FORMAT_LABELS,
  RELEASE_STATUS_LABELS,
  cn,
  formatChapterCount,
  formatCountry,
  formatEpisodeCount,
  formatPopularity,
  formatScore,
  formatMediaKind,
  formatVolumeCount,
  getDisplayTitle,
  getSecondaryTitle,
  isManga,
} from "@/lib/utils";
import type { Anime } from "@/types/anime";

const STATUS_TONE: Record<string, string> = {
  RELEASING: "border-success/30 bg-success/10 text-success",
  NOT_YET_RELEASED: "border-warning/30 bg-warning/10 text-warning",
};

export function AnimeDetailsHeader({
  anime,
  children,
}: {
  anime: Anime;
  children?: ReactNode;
}) {
  const title = getDisplayTitle(anime.title, true);
  const secondary = getSecondaryTitle(anime.title, title);
  const score = formatScore(anime.averageScore);
  const popularity = formatPopularity(anime.popularity);
  const manga = isManga(anime);
  const country = formatCountry(anime.countryOfOrigin);
  const season =
    anime.season && anime.seasonYear
      ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
      : anime.seasonYear
        ? String(anime.seasonYear)
        : null;

  const prequel = anime.relations?.find((r) => r.relationType === "PREQUEL") ?? null;
  const sequel = anime.relations?.find((r) => r.relationType === "SEQUEL") ?? null;

  return (
    <div className="min-w-0">
      {/* 1. Status Badge & Editorial Metadata Strip */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
        {anime.status ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border",
              STATUS_TONE[anime.status] ??
                "border-border bg-surface-2/80 text-muted",
            )}
          >
            {RELEASE_STATUS_LABELS[anime.status]}
          </span>
        ) : null}
        <span className="inline-flex items-center rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-accent-strong">
          {formatMediaKind(anime)}
        </span>
        {anime.isAdult ? (
          <span className="inline-flex items-center rounded-md border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
            18+
          </span>
        ) : null}

        {/* Clean dot-separated metadata line without excessive button pill clutter */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {season ? <span>{season}</span> : null}
          {country && country !== "Japan" ? (
            <>
              <span className="text-faint">·</span>
              <span>{country}</span>
            </>
          ) : null}
          {anime.format && (!manga || anime.format === "ONE_SHOT") ? (
            <>
              <span className="text-faint">·</span>
              <span>{FORMAT_LABELS[anime.format]}</span>
            </>
          ) : null}
          {anime.studios && anime.studios.length > 0 && anime.studios[0] ? (
            <>
              <span className="text-faint">·</span>
              <span>{anime.studios[0].name}</span>
            </>
          ) : null}
          <span>
            <span className="text-faint">·</span>{" "}
            {manga
              ? formatChapterCount(anime.chapters)
              : formatEpisodeCount(anime.episodes, { short: true })}
          </span>
          {manga && anime.volumes ? (
            <>
              <span className="text-faint">·</span>
              <span>{formatVolumeCount(anime.volumes)}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* 2. Primary Title & Alternate Romaji Title */}
      <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.035em] text-fg sm:text-4xl lg:text-5xl drop-shadow-sm">
        {title}
      </h1>
      {secondary ? (
        <p className="mt-1.5 text-sm text-muted sm:text-base font-normal tracking-wide">
          {secondary}
        </p>
      ) : null}

      {/* 3. Metrics, Genres & Trailer Action */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {score ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Community</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-fg">
                <StarIcon className="h-4 w-4 fill-warning text-warning" />
                <span>{score}</span>
                <span className="text-xs font-normal text-faint">/ 10</span>
              </p>
            </div>
          ) : null}

          {popularity ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Popularity</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-fg">
                {popularity}
              </p>
            </div>
          ) : null}

          {anime.duration ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Length</p>
              <p className="mt-0.5 text-sm font-semibold text-fg">
                {anime.duration} min
              </p>
            </div>
          ) : null}

          {anime.genres.length > 0 ? (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Genres</p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {anime.genres.slice(0, 3).join(" · ")}
              </p>
            </div>
          ) : null}
        </div>

        {/* Intentionally aligned trailer action button */}
        {anime.trailer?.id && anime.trailer.site === "youtube" ? (
          <div className="shrink-0">
            <AnimeTrailerModal trailer={anime.trailer} title={title} />
          </div>
        ) : null}
      </div>

      {/* 4. Franchise navigation */}
      {prequel || sequel ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-faint mr-1">
            Franchise:
          </span>
          {prequel ? (
            <Link
              href={`/media/${prequel.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent-strong"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5 text-muted" />
              <span className="text-muted">Prev:</span>
              <span className="font-semibold text-fg truncate max-w-[140px] sm:max-w-[200px]">
                {getDisplayTitle(prequel.title, true)}
              </span>
            </Link>
          ) : null}

          <span className="rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
            Current
          </span>

          {sequel ? (
            <Link
              href={`/media/${sequel.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-accent hover:text-accent-strong"
            >
              <span className="text-muted">Next:</span>
              <span className="font-semibold text-fg truncate max-w-[140px] sm:max-w-[200px]">
                {getDisplayTitle(sequel.title, true)}
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
            </Link>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
