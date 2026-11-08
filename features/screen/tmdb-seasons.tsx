import Image from "next/image";

import {
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  MonitorIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn, isHttpUrl } from "@/lib/utils";
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
  const visibleSeasons = [...seasons].sort((a, b) => {
    if (a.seasonNumber === 0) return 1;
    if (b.seasonNumber === 0) return -1;
    return a.seasonNumber - b.seasonNumber;
  });

  return (
    <section aria-labelledby="seasons-heading" className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="seasons-heading"
              className="font-display text-lg font-semibold text-fg"
            >
              Seasons &amp; Episodes
            </h2>
            <span className="border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {visibleSeasons.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Expand one season at a time to browse episodes and update progress.
          </p>
        </div>
        {entry ? (
          <span className="shrink-0 text-xs tabular-nums text-faint">
            {watchedCount} episodes watched
          </span>
        ) : null}
      </div>

      {visibleSeasons.length === 0 ? (
        <p className="optical-glass p-4 text-sm text-white/70">
          TMDB has no season data for this series yet.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          const percent =
            seasonEpisodes.length > 0
              ? Math.round((seasonWatched / seasonEpisodes.length) * 100)
              : 0;
          const defaultLabel =
            season.seasonNumber === 0
              ? "Specials"
              : `Season ${season.seasonNumber}`;
          const episodeLabel = `${season.episodeCount} ${
            season.episodeCount === 1 ? "episode" : "episodes"
          }`;
          const seasonName = season.name?.trim();
          const distinctName =
            seasonName && seasonName !== defaultLabel ? seasonName : null;
          const seasonTitle = distinctName ?? episodeLabel;
          const poster =
            season.posterUrl && isHttpUrl(season.posterUrl)
              ? season.posterUrl
              : null;
          const panelId = `season-panel-${season.seasonNumber}`;

          return (
            <div
              key={season.seasonNumber}
              className={cn(
                "group relative overflow-hidden border transition-colors duration-200",
                open
                  ? "border-white/30 bg-[rgba(14,17,24,0.55)] sm:col-span-2"
                  : "border-white/10 bg-[rgba(14,17,24,0.35)] hover:border-white/20 hover:bg-[rgba(14,17,24,0.5)]",
              )}
            >
              <button
                type="button"
                onClick={() => onLoadSeason(season)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex w-full items-center gap-3.5 p-3 text-left"
              >
                <span className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden border border-white/15 bg-white/5 transition-transform duration-200 group-hover:scale-102">
                  {poster ? (
                    <Image
                      src={poster}
                      alt=""
                      fill
                      unoptimized
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <MonitorIcon className="h-5 w-5 text-white/40" />
                    </span>
                  )}

                  {open ? (
                    <span className="absolute inset-x-0 bottom-0 bg-white py-0.5 text-center text-[8px] font-bold uppercase tracking-[0.16em] text-slate-900">
                      Open
                    </span>
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]",
                        open
                          ? "bg-white text-slate-900"
                          : "border border-white/15 bg-white/10 text-white/60",
                      )}
                    >
                      {defaultLabel}
                    </span>
                    {season.airDate ? (
                      <span className="text-[11px] text-white/45">
                        {season.airDate.slice(0, 4)}
                      </span>
                    ) : null}
                  </span>

                  <span
                    className="mt-1 block line-clamp-1 text-xs font-semibold text-white sm:text-[13px]"
                    title={seasonTitle}
                  >
                    {seasonTitle}
                  </span>

                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                    {distinctName ? <span>{episodeLabel}</span> : null}
                    {distinctName && entry && data ? (
                      <span className="text-white/30">·</span>
                    ) : null}
                    {entry && data ? (
                      <span className="tabular-nums">
                        {seasonWatched}/{seasonEpisodes.length} watched
                      </span>
                    ) : null}
                  </span>

                  {entry && data && seasonEpisodes.length > 0 ? (
                    <span className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden bg-white/15">
                      <span
                        className={cn(
                          "block h-full transition-all duration-300",
                          allWatched ? "bg-emerald-400" : "bg-white",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                  ) : null}
                </span>

                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/45 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open ? (
                <div
                  id={panelId}
                  className="border-t border-white/10 p-3"
                >
                  {seasonLoading === season.seasonNumber ? (
                    <p className="flex items-center gap-2 p-2 text-xs text-white/55">
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
                            {allWatched
                              ? "Unmark season"
                              : "Mark season watched"}
                          </Button>
                        </div>
                      ) : null}

                      <ul className="divide-y divide-white/10">
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
                                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border transition-colors disabled:opacity-40",
                                  isWatched
                                    ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                                    : "border-white/20 text-transparent hover:border-white/60 hover:text-white/60",
                                )}
                              >
                                <CheckIcon className="h-3.5 w-3.5" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-[13px] font-medium",
                                    isWatched ? "text-white/50" : "text-white",
                                  )}
                                >
                                  {episode.episodeNumber}. {episode.name}
                                </p>
                                {episode.airDate || episode.runtime ? (
                                  <p className="mt-0.5 text-[11px] text-white/45">
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
                  ) : (
                    <p className="p-2 text-xs text-white/50">
                      TMDB has no episode data for this season yet.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
