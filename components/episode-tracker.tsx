"use client";

import { useMemo, useState } from "react";

import { CheckIcon, PlayIcon, SparkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/features/library/library-provider";
import { cn } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryEntry } from "@/types/library";

interface EpisodeTrackerProps {
  anime: AnimeSummary;
  entry: LibraryEntry | null;
  className?: string;
  disabled?: boolean;
}

export function EpisodeTracker({
  anime,
  entry,
  className,
  disabled = false,
}: EpisodeTrackerProps) {
  const {
    canWrite,
    watchedEpisodesFor,
    toggleEpisode,
    markAllEpisodes,
    clearAllEpisodes,
    pendingIds,
  } = useLibrary();

  const isPending = pendingIds.has(anime.id) || disabled;
  const recordedEpisodes = watchedEpisodesFor(anime.id);

  // If there are no individual episode records yet but legacy progress exists,
  // we recognize legacy progress so the user sees their existing count.
  const hasRecorded = recordedEpisodes.length > 0;
  const watchedSet = useMemo(() => new Set(recordedEpisodes), [recordedEpisodes]);

  const total = anime.episodes ?? null;
  const watchedCount = hasRecorded
    ? recordedEpisodes.length
    : (entry?.progress ?? 0);

  const percent =
    total && total > 0
      ? Math.min(100, Math.round((watchedCount / total) * 100))
      : 0;

  // Compute next unwatched episode
  const nextUnwatchedEpisode = useMemo(() => {
    let next = 1;
    if (hasRecorded) {
      while (watchedSet.has(next)) {
        next += 1;
      }
    } else if (entry && entry.progress > 0) {
      next = entry.progress + 1;
    }
    if (total !== null && total > 0 && next > total) {
      return null;
    }
    return next;
  }, [entry, hasRecorded, total, watchedSet]);

  // Compute any skipped episodes (e.g. if ep 4 is watched but ep 2 is not)
  const skippedEpisodes = useMemo(() => {
    if (!hasRecorded || recordedEpisodes.length <= 1) {
      return [];
    }
    const maxEp = Math.max(...recordedEpisodes);
    const skipped: number[] = [];
    for (let i = 1; i < maxEp; i += 1) {
      if (!watchedSet.has(i)) {
        skipped.push(i);
      }
    }
    return skipped;
  }, [hasRecorded, recordedEpisodes, watchedSet]);

  // Number of episode buttons to display
  const [extraCount, setExtraCount] = useState(0);
  const displayLimit = useMemo(() => {
    if (total !== null && total > 0) {
      return total;
    }
    const maxWatched = hasRecorded
      ? Math.max(...recordedEpisodes, 0)
      : (entry?.progress ?? 0);
    return Math.max(maxWatched, 12) + extraCount;
  }, [entry?.progress, extraCount, hasRecorded, recordedEpisodes, total]);

  const episodeList = useMemo(() => {
    const list: number[] = [];
    for (let i = 1; i <= displayLimit; i += 1) {
      list.push(i);
    }
    return list;
  }, [displayLimit]);

  const [togglingEp, setTogglingEp] = useState<number | null>(null);

  const handleToggle = async (epNum: number, targetWatched?: boolean) => {
    if (isPending) return;
    setTogglingEp(epNum);
    await toggleEpisode(anime, epNum, targetWatched);
    setTogglingEp(null);
  };

  const handleMarkAll = async () => {
    if (isPending || !total || total <= 0) return;
    await markAllEpisodes(anime);
  };

  const handleClearAll = async () => {
    if (isPending) return;
    await clearAllEpisodes(anime.id);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-sm font-semibold text-fg">
              Episode tracking
            </h3>
            <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-strong">
              {watchedCount}
              {total ? ` / ${total}` : ""} watched
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {total && total > 0
              ? `${percent}% complete · Tap any episode to log or unmark`
              : "Tap an episode number to mark as watched"}
          </p>
        </div>

        {nextUnwatchedEpisode !== null && canWrite ? (
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => void handleToggle(nextUnwatchedEpisode, true)}
            className="self-start sm:self-auto"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            Watch Ep {nextUnwatchedEpisode}
          </Button>
        ) : null}
      </div>

      {/* Progress Bar */}
      {total && total > 0 ? (
        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {/* Skipped Episodes Notice */}
      {skippedEpisodes.length > 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
          <SparkIcon className="h-4 w-4 shrink-0 text-warning" />
          <span>
            Skipped {skippedEpisodes.length === 1 ? "episode" : "episodes"}:{" "}
            {skippedEpisodes.map((ep) => `Ep ${ep}`).join(", ")}
          </span>
        </div>
      ) : null}

      {/* Episode Grid */}
      <div className="mt-4">
        <div
          role="group"
          aria-label="Episodes"
          className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"
        >
          {episodeList.map((epNum) => {
            const isWatched = hasRecorded
              ? watchedSet.has(epNum)
              : (entry?.progress ?? 0) >= epNum;
            const isNext = epNum === nextUnwatchedEpisode;
            const isBusy = togglingEp === epNum;

            return (
              <button
                key={epNum}
                type="button"
                disabled={isPending}
                onClick={() => void handleToggle(epNum, !isWatched)}
                aria-pressed={isWatched}
                aria-label={`Episode ${epNum}: ${isWatched ? "Watched" : "Unwatched"}`}
                className={cn(
                  "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-xl border text-xs font-semibold transition-colors active:scale-95 disabled:pointer-events-none disabled:opacity-60",
                  isWatched
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-border-subtle bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg",
                  isNext && !isWatched && "border-accent/60 bg-accent-soft text-fg ring-1 ring-accent",
                )}
              >
                {isBusy ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <span className="tabular-nums">{epNum}</span>
                    {isWatched ? (
                      <CheckIcon className="absolute bottom-1 right-1 h-2.5 w-2.5 opacity-90 drop-shadow-sm" />
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic more episodes for unknown totals */}
        {total === null || total === 0 ? (
          <div className="mt-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExtraCount((prev) => prev + 6)}
              disabled={isPending}
            >
              + 6 more episodes
            </Button>
          </div>
        ) : null}
      </div>

      {/* Bulk actions */}
      {canWrite && entry ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/80 pt-3">
          <div className="flex items-center gap-2">
            {total && total > 0 && watchedCount < total ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleMarkAll()}
                disabled={isPending}
                className="text-xs text-muted hover:text-fg"
              >
                Mark all {total} watched
              </Button>
            ) : null}
            {watchedCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleClearAll()}
                disabled={isPending}
                className="text-xs text-muted hover:text-danger"
              >
                Reset episodes
              </Button>
            ) : null}
          </div>

          <span className="text-[11px] text-faint">
            {hasRecorded
              ? "Saved episode by episode"
              : "Legacy progress (tap any episode to convert)"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
