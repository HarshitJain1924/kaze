"use client";

import Link from "next/link";
import { useState } from "react";

import { BookmarkIcon, CheckIcon, ExternalIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { AddToListModal } from "@/components/add-to-list-modal";
import { RatingControl } from "@/components/rating-control";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { WatchProgressControl } from "@/components/watch-progress-control";
import { WatchStatusSelector } from "@/components/watch-status-selector";
import { useLibrary } from "@/features/library/library-provider";
import { MAX_NOTES_LENGTH, type WatchStatus } from "@/types/library";
import { formatIsoDate } from "@/lib/utils";
import type { Anime } from "@/types/anime";

export function AnimeLibraryPanel({ anime }: { anime: Anime }) {
  const {
    canWrite,
    entryFor,
    addToLibrary,
    updateEntry,
    requestRemove,
    pendingIds,
  } = useLibrary();

  const entry = entryFor(anime.id);
  const pending = pendingIds.has(anime.id);
  const manga = anime.mediaType === "manga";
  const totalUnits = manga ? (anime.chapters ?? null) : anime.episodes;
  const totalVolumes = manga ? (anime.volumes ?? null) : null;
  const unitLabel = manga ? "Chapter" : "Episode";
  const unitVerb = manga ? "Read" : "Watched";

  const [addStatus, setAddStatus] = useState<WatchStatus>("planning");
  const [adding, setAdding] = useState(false);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);

  const notes = draftNotes ?? entry?.notes ?? "";
  const notesDirty =
    draftNotes !== null && draftNotes !== (entry?.notes ?? "");

  const handleAdd = async () => {
    setAdding(true);
    await addToLibrary(anime, addStatus);
    setAdding(false);
  };

  const handleSaveNotes = async () => {
    const saved = await updateEntry(anime.id, {
      notes: notes.trim() ? notes : null,
    });
    if (saved) {
      setDraftNotes(null);
    }
  };

  const isCompleted =
    entry !== null &&
    totalUnits !== null &&
    totalUnits > 0 &&
    entry.progress >= totalUnits;

  const notYetAired = anime.status === "NOT_YET_RELEASED";

  return (
    <OpticalGlass
      as="section"
      variant="card"
      aria-label="Personal tracking workspace"
      className="space-y-5 p-5 sm:p-6"
    >
      {/* 1. Workspace Header & Library Status */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Tracking Workspace
          </span>
          <h2 className="mt-0.5 font-display text-base font-semibold text-white">
            Your Library
          </h2>
        </div>
        {entry ? (
          <StatusBadge status={entry.status} mediaType={anime.mediaType} />
        ) : (
          <span className="border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
            Not tracked
          </span>
        )}
      </div>

      {!canWrite ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-white/55">
            Sign in to track progress, rate this title, and keep personal notes.
            Your library syncs across your devices.
          </p>
          <LinkButton
            href={`/login?next=${encodeURIComponent(`/media/${anime.id}`)}`}
            variant="primary"
            className="w-full text-xs font-semibold uppercase tracking-wider"
          >
            Sign in to track
          </LinkButton>
          <Link
            href="/discover"
            className="block text-center text-xs text-white/45 transition-colors hover:text-white"
          >
            Keep browsing instead
          </Link>
        </div>
      ) : !entry ? (
        /* Not yet in library: prominent add workflow */
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-white/55">
            Add this title to your library to log progress, save personal ratings, and write archive notes.
          </p>
          <WatchStatusSelector
            value={addStatus}
            onChange={setAddStatus}
            label="Add to library as"
            id="add-status"
            mediaType={anime.mediaType}
          />
          <Button
            variant="primary"
            className="w-full justify-center gap-1.5 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-sm"
            onClick={handleAdd}
            disabled={adding}
          >
            <PlusIcon className="h-4 w-4" />
            <span>{adding ? "Adding…" : "Add to library"}</span>
          </Button>
          <p className="text-[11px] leading-relaxed text-white/45">
            You can modify the status, progress, and private rating at any time.
          </p>
        </div>
      ) : (
        /* In library: clear editorial tracking hierarchy */
        <div className="space-y-5">
          {/* Status selector */}
          <WatchStatusSelector
            value={entry.status}
            onChange={(status) => void updateEntry(anime.id, { status })}
            disabled={pending}
            id="entry-status"
            mediaType={anime.mediaType}
          />

          {/* 2. Primary Progress Action */}
          {isCompleted ? (
            <div className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-300">
              <CheckIcon className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>
                All {totalUnits} {manga ? "chapters read" : "episodes completed"}
              </span>
            </div>
          ) : notYetAired ? (
            <div className="rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning font-medium">
              <span>This series has not yet started broadcasting.</span>
            </div>
          ) : (
            <Button
              variant="primary"
              className="w-full justify-center gap-2 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-sm"
              onClick={() =>
                void updateEntry(anime.id, { progress: entry.progress + 1 })
              }
              disabled={pending}
            >
              <PlusIcon className="h-4 w-4" />
              <span>
                Mark {unitLabel} {entry.progress + 1} {unitVerb}
              </span>
            </Button>
          )}

          {/* 3. Progress Bar & Stepper Controls */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            {totalUnits && totalUnits > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">
                    {manga ? "Reading completion" : "Watch completion"}
                  </span>
                  <span className="font-semibold tabular-nums text-white">
                    {Math.round((entry.progress / totalUnits) * 100)}%
                    <span className="ml-1 font-normal text-white/50">
                      ({entry.progress}/{totalUnits})
                    </span>
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden bg-white/15">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (entry.progress / totalUnits) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <WatchProgressControl
              progress={entry.progress}
              episodes={totalUnits}
              unit={manga ? "chapter" : "episode"}
              disabled={pending}
              compact
              onChange={(progress) => void updateEntry(anime.id, { progress })}
            />

            {manga && (totalVolumes === null || totalVolumes > 0) ? (
              <WatchProgressControl
                progress={entry.volumesProgress ?? 0}
                episodes={totalVolumes}
                unit="volume"
                disabled={pending}
                compact
                onChange={(volumesProgress) =>
                  void updateEntry(anime.id, { volumesProgress })
                }
              />
            ) : null}
          </div>

          {/* 4. Personal Rating */}
          <div className="border-t border-white/10 pt-4">
            <RatingControl
              score={entry.score}
              disabled={pending}
              onChange={(score) => void updateEntry(anime.id, { score })}
            />
          </div>

          {/* 5. Personal Notes */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="entry-notes"
                className="text-xs font-medium text-white/55"
              >
                Personal notes
              </label>
              <span className="text-[11px] tabular-nums text-white/40">
                {notes.length} / {MAX_NOTES_LENGTH}
              </span>
            </div>
            <Textarea
              id="entry-notes"
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              disabled={pending}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Private notes, thoughts, favourite scenes…"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-white/40">
                {formatIsoDate(entry.updatedAt)
                  ? `Saved ${formatIsoDate(entry.updatedAt)}`
                  : "Not saved yet"}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!notesDirty || pending}
                onClick={() => void handleSaveNotes()}
              >
                {pending ? "Saving…" : "Save notes"}
              </Button>
            </div>
          </div>

          {/* 6. Secondary Actions & Curated List */}
          <div className="space-y-3 border-t border-white/10 pt-3">
            <button
              type="button"
              onClick={() => setIsListModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white"
            >
              <BookmarkIcon className="h-3.5 w-3.5 text-white/70" />
              <span>Add to Curated List</span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1">
              <a
                href={`https://anilist.co/${manga ? "manga" : "anime"}/${anime.id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white"
              >
                AniList
                <ExternalIcon className="h-3 w-3" />
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger-soft hover:text-danger text-xs"
                onClick={() => requestRemove(anime.id)}
                disabled={pending}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddToListModal
        anime={anime}
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
      />
    </OpticalGlass>
  );
}
