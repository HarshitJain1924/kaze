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
  const unitShort = manga ? "Ch" : "Ep";

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

  return (
    <section
      aria-label="Your library actions"
      className="liquid-glass rounded-3xl p-6 border border-border shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <h2 className="font-display text-base font-semibold text-fg">
            Your library
          </h2>
        </div>
        {entry ? (
          <StatusBadge status={entry.status} mediaType={anime.mediaType} />
        ) : null}
      </div>

      {!canWrite ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted">
            Sign in to track progress, rate this title and keep personal notes.
            Your library syncs across your devices.
          </p>
          <LinkButton
            href={`/login?next=${encodeURIComponent(`/media/${anime.id}`)}`}
            variant="primary"
            className="w-full"
          >
            Sign in to track
          </LinkButton>
          <Link
            href="/discover"
            className="block text-center text-xs text-faint transition-colors hover:text-fg"
          >
            Keep browsing instead
          </Link>
        </div>
      ) : !entry ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            Add this title to keep track of your progress, personal ratings and
            notes.
          </p>
          <WatchStatusSelector
            value={addStatus}
            onChange={setAddStatus}
            label="Add as"
            id="add-status"
            mediaType={anime.mediaType}
          />
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? "Adding…" : "Add to library"}
          </Button>
          <p className="text-[11px] leading-relaxed text-faint">
            You can change the status, progress and rating at any time.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <WatchStatusSelector
            value={entry.status}
            onChange={(status) => void updateEntry(anime.id, { status })}
            disabled={pending}
            id="entry-status"
            mediaType={anime.mediaType}
          />

          {/* Quick Log Next Episode Action */}
          {entry.status === "watching" &&
          (totalUnits === null || entry.progress < totalUnits) ? (
            <Button
              variant="primary"
              className="w-full justify-center gap-1.5 shadow-xs"
              onClick={() =>
                void updateEntry(anime.id, { progress: entry.progress + 1 })
              }
              disabled={pending}
            >
              <PlusIcon className="h-4 w-4" />
              <span>
                Mark {unitShort} {entry.progress + 1}{" "}
                {manga ? "Read" : "Watched"}
              </span>
            </Button>
          ) : null}

          {/* Visual Progress Bar with Percentage */}
          {totalUnits && totalUnits > 0 ? (
            <div className="space-y-1.5 rounded-xl border border-border-subtle bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-fg">
                  {manga ? "Reading progress" : "Watch progress"}
                </span>
                <span className="font-semibold tabular-nums text-accent-strong">
                  {Math.round((entry.progress / totalUnits) * 100)}%
                  <span className="ml-1 font-normal text-muted">
                    ({entry.progress}/{totalUnits} {manga ? "ch" : "eps"})
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (entry.progress / totalUnits) * 100,
                    )}%`,
                  }}
                />
              </div>
              {entry.progress >= totalUnits ? (
                <p className="flex items-center gap-1 pt-0.5 text-[11px] font-medium text-success">
                  <CheckIcon className="h-3.5 w-3.5" />
                  All {manga ? "chapters read" : "episodes completed"}
                </p>
              ) : null}
            </div>
          ) : null}

          <WatchProgressControl
            progress={entry.progress}
            episodes={totalUnits}
            unit={manga ? "chapter" : "episode"}
            disabled={pending}
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

          <RatingControl
            score={entry.score}
            disabled={pending}
            onChange={(score) => void updateEntry(anime.id, { score })}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="entry-notes"
                className="text-xs font-medium text-muted"
              >
                Personal notes
              </label>
              <span className="text-[11px] tabular-nums text-faint">
                {notes.length} / {MAX_NOTES_LENGTH}
              </span>
            </div>
            <Textarea
              id="entry-notes"
              rows={4}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              disabled={pending}
              onChange={(event) => setDraftNotes(event.target.value)}
              placeholder="Episode thoughts, favourite moments, where you left off…"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-faint">
                {formatIsoDate(entry.updatedAt)
                  ? `Updated ${formatIsoDate(entry.updatedAt)}`
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

          <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
            <a
              href={`https://anilist.co/${manga ? "manga" : "anime"}/${anime.id}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-fg"
            >
              AniList
              <ExternalIcon className="h-3 w-3" />
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => requestRemove(anime.id)}
              disabled={pending}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <button
          type="button"
          onClick={() => setIsListModalOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-xs font-semibold text-fg transition-all hover:bg-surface-3 hover:border-accent/40 active:scale-98 shadow-xs"
        >
          <BookmarkIcon className="h-3.5 w-3.5 text-accent" />
          <span>Add to Curated List</span>
        </button>
      </div>

      <AddToListModal
        anime={anime}
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
      />
    </section>
  );
}
