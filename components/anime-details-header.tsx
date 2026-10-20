import type { ReactNode } from "react";

import { StarIcon } from "@/components/icons";
import { seasonLabel } from "@/lib/season";
import {
  FORMAT_LABELS,
  RELEASE_STATUS_LABELS,
  formatEpisodeCount,
  formatPopularity,
  formatScore,
  getDisplayTitle,
  getSecondaryTitle,
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
  const season =
    anime.season && anime.seasonYear
      ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
      : anime.seasonYear
        ? String(anime.seasonYear)
        : null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {anime.status ? (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${
              STATUS_TONE[anime.status] ??
              "border-border-subtle bg-surface-2 text-muted"
            }`}
          >
            {RELEASE_STATUS_LABELS[anime.status]}
          </span>
        ) : null}
        {anime.format ? (
          <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
            {FORMAT_LABELS[anime.format]}
          </span>
        ) : null}
        {season ? (
          <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
            {season}
          </span>
        ) : null}
        <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted">
          {formatEpisodeCount(anime.episodes, { short: true })}
        </span>
      </div>

      <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-[32px]">
        {title}
      </h1>
      {secondary ? (
        <p className="mt-1.5 text-sm text-muted sm:text-[15px]">{secondary}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border-subtle pt-4">
        {score ? (
          <div>
            <p className="text-xs text-faint">Community</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-fg">
              <StarIcon className="h-4 w-4 fill-warning text-warning" />
              {score}
              <span className="text-xs font-normal text-faint">/ 10</span>
            </p>
          </div>
        ) : null}
        {popularity ? (
          <div>
            <p className="text-xs text-faint">Popularity</p>
            <p className="mt-0.5 text-sm font-semibold text-fg">
              {popularity} members
            </p>
          </div>
        ) : null}
        {anime.duration ? (
          <div>
            <p className="text-xs text-faint">Episode length</p>
            <p className="mt-0.5 text-sm font-semibold text-fg">
              {anime.duration} min
            </p>
          </div>
        ) : null}
        {anime.genres.length > 0 ? (
          <div className="min-w-0">
            <p className="text-xs text-faint">Genres</p>
            <p className="mt-0.5 truncate text-sm text-muted">
              {anime.genres.slice(0, 3).join(" · ")}
            </p>
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
