"use client";

import { useState } from "react";
import { BookmarkIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { useCustomLists } from "@/features/lists/lists-provider";
import type { Anime } from "@/types/anime";
import {
  customListItemKey,
  type CustomListCandidate,
} from "@/types/custom-list";
import { getDisplayTitle } from "@/lib/utils";

interface AddToListModalProps {
  /** AniList title being curated. */
  anime?: Anime;
  /** Already-normalised film or TV candidate. */
  candidate?: CustomListCandidate;
  isOpen: boolean;
  onClose: () => void;
}

export function AddToListModal({
  anime,
  candidate,
  isOpen,
  onClose,
}: AddToListModalProps) {
  const { lists, addItemToList, removeItemFromList, isItemInList } =
    useCustomLists();
  const [notes, setNotes] = useState("");

  const target: CustomListCandidate | null =
    candidate ??
    (anime
      ? {
          anilistId: anime.id,
          title: getDisplayTitle(anime.title, true),
          mediaType: anime.mediaType ?? "anime",
          coverImage: anime.coverImage.large ?? anime.coverImage.extraLarge,
          bannerImage: anime.bannerImage ?? null,
          format: anime.format ?? null,
          averageScore: anime.averageScore ?? null,
        }
      : null);

  if (!isOpen || !target) return null;

  const itemKey = customListItemKey(target);
  const displayTitle = target.title;

  const handleToggle = (listId: string) => {
    if (isItemInList(listId, itemKey)) {
      removeItemFromList(listId, itemKey);
      return;
    }
    addItemToList(listId, {
      ...target,
      notes: notes.trim() || undefined,
    });
    setNotes("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${displayTitle} to list`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center border border-border bg-surface text-accent-strong">
              <BookmarkIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold text-fg">
                Add to Curated List
              </h3>
              <p className="truncate font-mono text-[11px] text-faint">
                {displayTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-border bg-surface text-muted hover:border-accent hover:text-fg transition-colors"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Optional commentary note */}
        <div className="mt-4">
          <label
            htmlFor="item-note"
            className="block text-xs font-semibold text-fg"
          >
            Personal Ranking / Commentary Note (Optional)
          </label>
          <input
            id="item-note"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "Peak animation in episode 19, must watch"'
            className="mt-1.5 h-9 w-full border border-border bg-surface-2/60 px-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none"
          />
        </div>

        {/* Collections checklist */}
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
          {lists.length === 0 ? (
            <p className="border border-dashed border-border p-4 text-center text-xs text-muted">
              No lists created yet. Create a list from Custom Lists first!
            </p>
          ) : (
            lists.map((list) => {
              const inList = isItemInList(list.id, itemKey);
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleToggle(list.id)}
                  className={`flex w-full items-center justify-between border p-3 text-left transition-colors ${
                    inList
                      ? "border-accent bg-accent/15 text-fg"
                      : "border-border bg-surface-2/40 text-muted hover:border-accent/40 hover:bg-surface"
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-xs font-semibold text-fg">
                      {list.title}
                    </p>
                    <p className="truncate font-mono text-[10px] text-faint">
                      {list.items.length} titles
                    </p>
                  </div>

                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-all ${
                      inList
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-border bg-surface text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3 w-3 stroke-[2.5]" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 border border-accent bg-accent px-5 text-[11px] font-semibold uppercase tracking-wider text-accent-contrast hover:bg-accent-hover transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
