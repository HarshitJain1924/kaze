"use client";

import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { RatingControl } from "@/components/rating-control";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { WatchStatusSelector } from "@/components/watch-status-selector";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, isHttpUrl } from "@/lib/utils";
import type { WatchStatus } from "@/types/library";
import type { TmdbLibraryEntry } from "@/types/tmdb";

interface TmdbTrackingPanelProps {
  entry: TmdbLibraryEntry | null;
  isTv: boolean;
  canWrite: boolean;
  busy: boolean;
  addStatus: WatchStatus;
  onAddStatusChange: (status: WatchStatus) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  confirmRemove: boolean;
  onConfirmRemoveChange: (confirm: boolean) => void;
  watchedCount: number;
  totalEpisodes: number;
  percent: number;
  posterUrl: string | null;
  tmdbId: number;
  onAdd: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
  onClearProgress: () => void;
}

export function TmdbTrackingPanel({
  entry,
  isTv,
  canWrite,
  busy,
  addStatus,
  onAddStatusChange,
  notes,
  onNotesChange,
  confirmRemove,
  onConfirmRemoveChange,
  watchedCount,
  totalEpisodes,
  percent,
  posterUrl,
  tmdbId,
  onAdd,
  onPatch,
  onRemove,
  onClearProgress,
}: TmdbTrackingPanelProps) {
  return (
    <OpticalGlass
      as="section"
      variant="workspace"
      aria-label="Personal tracking workspace"
      className="space-y-4 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
            Tracking Workspace
          </span>
          <h2 className="mt-0.5 font-display text-base font-semibold text-fg">
            Your Library
          </h2>
        </div>
        {entry ? (
          <span className="text-[11px] font-medium text-emerald-400 light:text-emerald-700">
            Saved
          </span>
        ) : (
          <span className="rounded-md border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-faint">
            Not tracked
          </span>
        )}
      </div>

      {!entry ? (
        <>
          <p className="text-xs leading-relaxed text-muted">
            Add this {isTv ? "series" : "film"} to keep its status, rating and
            notes with the rest of your archive.
          </p>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted">Status</span>
            <Select
              value={addStatus}
              onChange={(event) =>
                onAddStatusChange(event.target.value as WatchStatus)
              }
            >
              {WATCH_STATUS_ORDER.map((status) => (
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
            onClick={onAdd}
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
            onChange={(status) => onPatch({ status })}
          />

          {!isTv ? (
            <div className="rounded-xl border border-border-subtle bg-surface-2/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-fg">Watched</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {entry.watched ? "Marked as watched" : "Not watched yet"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={entry.watched ? "secondary" : "primary"}
                  disabled={busy}
                  onClick={() => onPatch({ watched: !entry.watched })}
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
                    percent >= 100 ? "bg-emerald-400" : "bg-accent-strong",
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
                  onClick={onClearProgress}
                >
                  Clear progress
                </Button>
              </div>
            </div>
          )}

          <RatingControl
            score={entry.score}
            disabled={busy}
            onChange={(score) => onPatch({ score })}
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
              onChange={(event) => onNotesChange(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            disabled={busy || notes === (entry.notes ?? "")}
            onClick={() => onPatch({ notes })}
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
                  onClick={onRemove}
                >
                  Remove
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onConfirmRemoveChange(false)}
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
              onClick={() => onConfirmRemoveChange(true)}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Remove from library
            </Button>
          )}
        </>
      )}

      {posterUrl && isHttpUrl(posterUrl) ? (
        <p className="text-[11px] text-faint">
          TMDB id {tmdbId} · metadata is cached; your progress never leaves Kaze.
        </p>
      ) : (
        <p className="text-[11px] text-faint">
          TMDB id {tmdbId} · your progress never leaves Kaze.
        </p>
      )}
    </OpticalGlass>
  );
}
