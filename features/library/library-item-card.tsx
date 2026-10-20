"use client";

import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { AnimePosterCard } from "@/components/anime-poster-card";
import { StatusBadge } from "@/components/ui/badge";
import { getNextEpisodeNumber } from "@/features/library/continue-watching";
import { useLibrary } from "@/features/library/library-provider";
import type { LibraryItem } from "@/types/library";

export function LibraryItemCard({ item }: { item: LibraryItem }) {
  const { requestRemove } = useLibrary();

  if (!item.anime) {
    return (
      <article className="flex flex-col">
        <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/60 p-3 text-center">
          <AlertIcon className="h-6 w-6 text-faint" />
          <p className="text-xs font-medium text-muted">Metadata unavailable</p>
          <p className="text-[11px] text-faint">
            AniList ID {item.entry.anilistId}
          </p>
          <button
            type="button"
            onClick={() => requestRemove(item.entry.anilistId)}
            className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            <TrashIcon className="h-3 w-3" />
            Remove
          </button>
        </div>
        <div className="mt-2.5 space-y-1">
          <p className="text-sm font-semibold text-muted">Untitled entry</p>
          <div className="flex items-center gap-2 text-xs text-faint">
            <StatusBadge status={item.entry.status} />
            <span className="tabular-nums">
              {item.entry.progress} watched
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <AnimePosterCard
      anime={item.anime}
      metaMode="below"
      showQuickAdd={false}
      footer={<NextEpisodeAction item={item} />}
    />
  );
}

/**
 * The library's most frequent job, on the card itself. Without it, logging a
 * single episode costs opening the details page every time.
 */
function NextEpisodeAction({ item }: { item: LibraryItem }) {
  const { incrementProgress, pendingIds, watchedEpisodesFor } = useLibrary();
  const total = item.anime?.episodes ?? null;
  const { nextEp, atEnd } = getNextEpisodeNumber(
    item.entry.progress,
    watchedEpisodesFor(item.entry.anilistId),
    total,
  );
  const pending = pendingIds.has(item.entry.anilistId);

  if (item.entry.status === "completed" || atEnd) {
    return (
      <p className="inline-flex h-10 items-center gap-1 text-xs text-success sm:h-8">
        <CheckIcon className="h-3 w-3 shrink-0" />
        {total ? `All ${total} episodes watched` : "Completed"}
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void incrementProgress(item.entry.anilistId)}
      className="mt-0.5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2 text-xs font-medium text-fg transition-[background-color,border-color,transform] duration-150 ease-out hover:border-border hover:bg-surface-3 active:scale-[0.98] disabled:opacity-60 sm:h-8"
      aria-label={`Mark episode ${nextEp} watched`}
    >
      {pending ? (
        "Saving…"
      ) : (
        <>
          <PlusIcon className="h-3 w-3" />
          Episode {nextEp}
        </>
      )}
    </button>
  );
}
