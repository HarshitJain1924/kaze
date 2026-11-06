"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  TmdbLibraryEntry,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
} from "@/types/tmdb";

export function tmdbEpisodeKey(
  seasonNumber: number,
  episodeNumber: number,
): string {
  return `${seasonNumber}:${episodeNumber}`;
}

interface TmdbSeasonsSectionProps {
  seasons: TmdbSeasonSummary[];
  entry: TmdbLibraryEntry | null;
  watched: Set<string>;
  openSeason: number | null;
  seasonData: Record<number, TmdbSeasonDetails>;
  seasonLoading: number | null;
  busy: boolean;
  watchedCount: number;
  onLoadSeason: (season: TmdbSeasonSummary) => void;
  onToggleEpisode: (
    seasonNumber: number,
    episodeNumber: number,
    watched: boolean,
  ) => void;
  onWriteEpisodes: (
    episodes: Array<{ seasonNumber: number; episodeNumber: number }>,
    watched: boolean,
  ) => void;
}

export function TmdbSeasonsSection({
  seasons,
  entry,
  watched,
  openSeason,
  seasonData,
  seasonLoading,
  busy,
  watchedCount,
  onLoadSeason,
  onToggleEpisode,
  onWriteEpisodes,
}: TmdbSeasonsSectionProps) {
  const visibleSeasons = seasons.filter((season) => season.seasonNumber > 0);

  return (
    <section aria-label="Seasons and episodes" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-fg">Seasons</h2>
        {entry ? (
          <span className="text-xs tabular-nums text-faint">
            {watchedCount} watched
          </span>
        ) : null}
      </div>

      {visibleSeasons.length === 0 ? (
        <p className="rounded-2xl border border-border-subtle bg-surface-2/50 p-4 text-sm text-muted">
          TMDB has no season data for this series yet.
        </p>
      ) : null}

      <div className="space-y-2">
        {visibleSeasons.map((season) => {
          const open = openSeason === season.seasonNumber;
          const data = seasonData[season.seasonNumber];
          const seasonEpisodes = data?.episodes ?? [];
          const seasonWatched = seasonEpisodes.filter((episode) =>
            watched.has(
              tmdbEpisodeKey(episode.seasonNumber, episode.episodeNumber),
            ),
          ).length;
          const allWatched =
            seasonEpisodes.length > 0 &&
            seasonWatched === seasonEpisodes.length;

          return (
            <div
              key={season.seasonNumber}
              className="overflow-hidden rounded-2xl border border-border-subtle bg-surface/70"
            >
              <button
                type="button"
                onClick={() => onLoadSeason(season)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-2/60"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">
                    {season.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-faint">
                    {season.episodeCount} episodes
                    {season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ""}
                    {entry && open ? ` · ${seasonWatched} watched` : ""}
                  </span>
                </span>
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 shrink-0 text-faint transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open ? (
                <div className="border-t border-border-subtle p-3">
                  {seasonLoading === season.seasonNumber ? (
                    <p className="flex items-center gap-2 p-2 text-xs text-faint">
                      <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      Loading episodes…
                    </p>
                  ) : null}

                  {seasonEpisodes.length > 0 ? (
                    <>
                      {entry ? (
                        <div className="mb-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              onWriteEpisodes(
                                seasonEpisodes.map((episode) => ({
                                  seasonNumber: episode.seasonNumber,
                                  episodeNumber: episode.episodeNumber,
                                })),
                                !allWatched,
                              )
                            }
                          >
                            {allWatched ? "Unmark season" : "Mark season watched"}
                          </Button>
                        </div>
                      ) : null}

                      <ul className="divide-y divide-border-subtle">
                        {seasonEpisodes.map((episode) => {
                          const isWatched = watched.has(
                            tmdbEpisodeKey(
                              episode.seasonNumber,
                              episode.episodeNumber,
                            ),
                          );
                          return (
                            <li
                              key={episode.episodeNumber}
                              className="flex items-start gap-3 py-2.5"
                            >
                              <button
                                type="button"
                                disabled={!entry || busy}
                                onClick={() =>
                                  onToggleEpisode(
                                    episode.seasonNumber,
                                    episode.episodeNumber,
                                    !isWatched,
                                  )
                                }
                                aria-pressed={isWatched}
                                aria-label={`${isWatched ? "Unmark" : "Mark"} episode ${episode.episodeNumber} ${
                                  isWatched ? "watched" : "as watched"
                                }`}
                                className={cn(
                                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
                                  isWatched
                                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                                    : "border-border text-transparent hover:border-accent hover:text-accent/60",
                                )}
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-[13px] font-medium",
                                    isWatched ? "text-muted" : "text-fg",
                                  )}
                                >
                                  {episode.episodeNumber}. {episode.name}
                                </p>
                                {episode.airDate || episode.runtime ? (
                                  <p className="mt-0.5 text-[11px] text-faint">
                                    {[
                                      episode.airDate,
                                      episode.runtime
                                        ? `${episode.runtime}m`
                                        : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
