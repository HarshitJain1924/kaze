"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  FilmIcon,
  LoaderIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { RatingControl } from "@/components/rating-control";
import { TmdbAttribution } from "@/components/tmdb-attribution";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { WatchStatusSelector } from "@/components/watch-status-selector";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, isHttpUrl } from "@/lib/utils";
import type { WatchStatus } from "@/types/library";
import type {
  TmdbDetails,
  TmdbLibraryEntry,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

interface LibraryResponse {
  entry: TmdbLibraryEntry;
  watchedEpisodes: TmdbWatchedEpisode[];
}

function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}:${episodeNumber}`;
}

function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

export function ScreenDetail({
  details,
  initialEntry,
  initialEpisodes,
  canWrite,
}: {
  details: TmdbDetails;
  initialEntry: TmdbLibraryEntry | null;
  initialEpisodes: TmdbWatchedEpisode[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState<TmdbLibraryEntry | null>(initialEntry);
  const [watched, setWatched] = useState<Set<string>>(
    () =>
      new Set(
        initialEpisodes.map((episode) =>
          episodeKey(episode.seasonNumber, episode.episodeNumber),
        ),
      ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<WatchStatus>("planning");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasonData, setSeasonData] = useState<
    Record<number, TmdbSeasonDetails>
  >({});
  const [seasonLoading, setSeasonLoading] = useState<number | null>(null);

  const isTv = details.kind === "tv";
  const totalEpisodes =
    entry?.totalEpisodes ?? details.numberOfEpisodes ?? 0;
  const watchedCount = watched.size;
  const percent =
    totalEpisodes > 0
      ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
      : 0;
  const seasons = useMemo(
    () => details.seasons.filter((season) => season.seasonNumber > 0),
    [details.seasons],
  );
  const primaryRuntime = isTv
    ? (details.episodeRuntime[0] ?? null)
    : details.runtime;

  function messageFor(cause: unknown): string {
    if (cause instanceof ApiRequestError) {
      if (cause.status === 401) {
        return "Sign in to save films and TV shows to your library.";
      }
      return cause.message;
    }
    return "Something went wrong. Please try again.";
  }

  async function addEntry() {
    if (!canWrite) {
      setError("Sign in to add this title to your library.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ entry: TmdbLibraryEntry }>(
        "/api/tmdb/library",
        {
          method: "POST",
          body: JSON.stringify({
            kind: details.kind,
            tmdbId: details.tmdbId,
            status: addStatus,
          }),
        },
      );
      setEntry(data.entry);
      setNotes(data.entry.notes ?? "");
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function patchEntry(patch: Record<string, unknown>) {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<LibraryResponse>(
        `/api/tmdb/library/${details.kind}/${details.tmdbId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setEntry(data.entry);
      setWatched(
        new Set(
          data.watchedEpisodes.map((episode) =>
            episodeKey(episode.seasonNumber, episode.episodeNumber),
          ),
        ),
      );
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry() {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ removed: boolean }>(
        `/api/tmdb/library/${details.kind}/${details.tmdbId}`,
        { method: "DELETE" },
      );
      setEntry(null);
      setWatched(new Set());
      setNotes("");
      setConfirmRemove(false);
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function loadSeason(season: TmdbSeasonSummary) {
    if (openSeason === season.seasonNumber) {
      setOpenSeason(null);
      return;
    }
    setOpenSeason(season.seasonNumber);
    if (seasonData[season.seasonNumber]) return;

    setSeasonLoading(season.seasonNumber);
    setError(null);
    try {
      const data = await apiFetch<TmdbSeasonDetails>(
        `/api/tmdb/tv/${details.tmdbId}/season/${season.seasonNumber}`,
      );
      setSeasonData((current) => ({
        ...current,
        [season.seasonNumber]: data,
      }));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSeasonLoading(null);
    }
  }

  async function writeEpisodes(
    refs: Array<{ seasonNumber: number; episodeNumber: number }>,
    watchedState: boolean,
  ) {
    if (!entry || refs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<LibraryResponse>(
        `/api/tmdb/library/tv/${details.tmdbId}/episodes`,
        {
          method: "POST",
          body: JSON.stringify({ episodes: refs, watched: watchedState }),
        },
      );
      setEntry(data.entry);
      setWatched(
        new Set(
          data.watchedEpisodes.map((episode) =>
            episodeKey(episode.seasonNumber, episode.episodeNumber),
          ),
        ),
      );
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEpisode(
    seasonNumber: number,
    episodeNumber: number,
    nextWatched: boolean,
  ) {
    await writeEpisodes([{ seasonNumber, episodeNumber }], nextWatched);
  }

  const statusOptions = WATCH_STATUS_ORDER;

  return (
    <div className="space-y-8">
      <Link
        href="/screen"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
      >
        ← Films &amp; TV
      </Link>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <header className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface/85">
        {details.backdropUrl && isHttpUrl(details.backdropUrl) ? (
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={details.backdropUrl}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
          </div>
        ) : null}

        <div className="relative grid gap-6 p-5 sm:p-6 md:grid-cols-[190px_1fr] md:p-8">
          <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-2xl border border-white/10 bg-surface-3 shadow-2xl md:mx-0 md:w-full">
            {details.posterUrl && isHttpUrl(details.posterUrl) ? (
              <Image
                src={details.posterUrl}
                alt=""
                fill
                priority
                unoptimized
                sizes="190px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <FilmIcon className="h-8 w-8 text-faint/60" />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
                {isTv ? "Television" : "Film"}
              </span>
              {details.status ? (
                <span className="text-[11px] font-medium text-faint">
                  {details.status}
                </span>
              ) : null}
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
                {details.title}
              </h1>
              {details.originalTitle &&
              details.originalTitle !== details.title ? (
                <p className="mt-1 text-sm text-muted">{details.originalTitle}</p>
              ) : null}
              {details.tagline ? (
                <p className="mt-2 text-sm italic text-muted">
                  “{details.tagline}”
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
              {details.year ? <span>{details.year}</span> : null}
              {primaryRuntime ? (
                <span>{formatRuntime(primaryRuntime)}</span>
              ) : null}
              {isTv && details.numberOfSeasons ? (
                <span>
                  {details.numberOfSeasons}{" "}
                  {details.numberOfSeasons === 1 ? "season" : "seasons"}
                </span>
              ) : null}
              {isTv && totalEpisodes > 0 ? (
                <span>{totalEpisodes} episodes</span>
              ) : null}
              {details.voteAverage && details.voteAverage > 0 ? (
                <span className="inline-flex items-center gap-1 text-warning">
                  <StarIcon className="h-3.5 w-3.5 fill-current" />
                  {details.voteAverage.toFixed(1)}
                  {details.voteCount ? (
                    <span className="text-faint">
                      ({details.voteCount.toLocaleString()})
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {details.genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {details.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-border-subtle bg-surface-2/70 px-2.5 py-1 text-[11px] text-muted"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            ) : null}

            {details.overview ? (
              <p className="max-w-3xl text-sm leading-relaxed text-muted">
                {details.overview}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {isTv ? (
            <section aria-label="Seasons and episodes" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-fg">
                  Seasons
                </h2>
                {entry ? (
                  <span className="text-xs tabular-nums text-faint">
                    {watchedCount}
                    {totalEpisodes ? ` / ${totalEpisodes}` : ""} watched
                  </span>
                ) : null}
              </div>

              {seasons.length === 0 ? (
                <p className="rounded-2xl border border-border-subtle bg-surface-2/50 p-4 text-sm text-muted">
                  TMDB has no season data for this series yet.
                </p>
              ) : null}

              <div className="space-y-2">
                {seasons.map((season) => {
                  const open = openSeason === season.seasonNumber;
                  const data = seasonData[season.seasonNumber];
                  const seasonEpisodes = data?.episodes ?? [];
                  const seasonWatched = seasonEpisodes.filter((episode) =>
                    watched.has(
                      episodeKey(season.seasonNumber, episode.episodeNumber),
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
                        onClick={() => void loadSeason(season)}
                        aria-expanded={open}
                        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface-2/60"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-fg">
                            {season.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-faint">
                            {season.episodeCount} episodes
                            {season.airDate
                              ? ` · ${season.airDate.slice(0, 4)}`
                              : ""}
                            {entry && open
                              ? ` · ${seasonWatched} watched`
                              : ""}
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
                                      void writeEpisodes(
                                        seasonEpisodes.map((episode) => ({
                                          seasonNumber:
                                            episode.seasonNumber,
                                          episodeNumber:
                                            episode.episodeNumber,
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

                              <ul className="divide-y divide-border-subtle">
                                {seasonEpisodes.map((episode) => {
                                  const isWatched = watched.has(
                                    episodeKey(
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
                                          void toggleEpisode(
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
                                            isWatched
                                              ? "text-muted"
                                              : "text-fg",
                                          )}
                                        >
                                          {episode.episodeNumber}.{" "}
                                          {episode.name}
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
          ) : (
            <section className="rounded-2xl border border-border-subtle bg-surface/70 p-5">
              <h2 className="font-display text-lg font-semibold text-fg">
                About this film
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {details.overview ||
                  "TMDB has no synopsis for this film yet."}
              </p>
              <p className="mt-4 text-xs text-faint">
                Films are tracked as a single watched state — no episode or
                season progress.
              </p>
            </section>
          )}

          <TmdbAttribution />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface/80 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-fg">
                Your library
              </h2>
              {entry ? (
                <span className="text-[11px] font-medium text-emerald-400 light:text-emerald-700">
                  Saved
                </span>
              ) : null}
            </div>

            {!entry ? (
              <>
                <p className="text-xs leading-relaxed text-muted">
                  Add this {isTv ? "series" : "film"} to keep its status,
                  rating and notes with the rest of your archive.
                </p>
                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-muted">
                    Status
                  </span>
                  <Select
                    value={addStatus}
                    onChange={(event) =>
                      setAddStatus(event.target.value as WatchStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {WATCH_STATUS_META[status].label}
                      </option>
                    ))}
                  </Select>
                </label>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={busy || !canWrite}
                  onClick={() => void addEntry()}
                >
                  {busy ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlusIcon className="h-4 w-4" />
                  )}
                  {canWrite ? "Add to library" : "Sign in to add"}
                </Button>
              </>
            ) : (
              <>
                <WatchStatusSelector
                  value={entry.status}
                  disabled={busy}
                  onChange={(status) => void patchEntry({ status })}
                />

                {!isTv ? (
                  <div className="rounded-xl border border-border-subtle bg-surface-2/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-fg">
                          Watched
                        </p>
                        <p className="mt-0.5 text-[11px] text-faint">
                          {entry.watched
                            ? "Marked as watched"
                            : "Not watched yet"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={entry.watched ? "secondary" : "primary"}
                        disabled={busy}
                        onClick={() =>
                          void patchEntry({ watched: !entry.watched })
                        }
                      >
                        {entry.watched ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5" />
                            Watched
                          </>
                        ) : (
                          "Mark watched"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Episode progress</span>
                      <span className="tabular-nums text-fg">
                        {watchedCount}
                        {totalEpisodes ? ` / ${totalEpisodes}` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          percent >= 100
                            ? "bg-emerald-400"
                            : "bg-accent-strong",
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-faint">
                        {percent}% complete
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || watchedCount === 0}
                        onClick={() =>
                          void apiFetch<LibraryResponse>(
                            `/api/tmdb/library/tv/${details.tmdbId}/episodes`,
                            {
                              method: "POST",
                              body: JSON.stringify({ action: "clearAll" }),
                            },
                          )
                            .then((data) => {
                              setEntry(data.entry);
                              setWatched(new Set());
                              router.refresh();
                            })
                            .catch((cause) => setError(messageFor(cause)))
                        }
                      >
                        Clear progress
                      </Button>
                    </div>
                  </div>
                )}

                <RatingControl
                  score={entry.score}
                  disabled={busy}
                  onChange={(score) => void patchEntry({ score })}
                />

                <label className="block space-y-1.5">
                  <span className="block text-xs font-medium text-muted">
                    Personal notes
                  </span>
                  <Textarea
                    value={notes}
                    maxLength={5000}
                    rows={5}
                    placeholder="Private notes about this title…"
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  disabled={busy || notes === (entry.notes ?? "")}
                  onClick={() => void patchEntry({ notes })}
                >
                  Save notes
                </Button>

                {confirmRemove ? (
                  <div className="space-y-2 rounded-xl border border-danger/30 bg-danger-soft p-3">
                    <p className="text-xs text-danger">
                      Remove this title and its episode history?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void removeEntry()}
                      >
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmRemove(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-danger hover:bg-danger-soft"
                    disabled={busy}
                    onClick={() => setConfirmRemove(true)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Remove from library
                  </Button>
                )}
              </>
            )}

            <p className="text-[11px] text-faint">
              TMDB id {details.tmdbId} · metadata is cached; your progress
              never leaves Kaze.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
