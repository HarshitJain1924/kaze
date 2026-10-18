"use client";

import { AlertIcon, TrashIcon } from "@/components/icons";
import { AnimePosterCard } from "@/components/anime-poster-card";
import { StatusBadge } from "@/components/ui/badge";
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
          <p className="text-[10px] text-faint">
            AniList ID {item.entry.anilistId}
          </p>
          <button
            type="button"
            onClick={() => requestRemove(item.entry.anilistId)}
            className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger-soft"
          >
            <TrashIcon className="h-3 w-3" />
            Remove
          </button>
        </div>
        <div className="mt-2.5 space-y-1">
          <p className="text-[13px] font-semibold text-muted">
            Untitled entry
          </p>
          <div className="flex items-center gap-2 text-[11px] text-faint">
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
    />
  );
}
