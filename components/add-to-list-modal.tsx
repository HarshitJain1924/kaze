"use client";

import { useState } from "react";
import { BookmarkIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { useCustomLists } from "@/features/lists/lists-provider";
import type { Anime } from "@/types/anime";
import { getDisplayTitle } from "@/lib/utils";

interface AddToListModalProps {
  anime: Anime;
  isOpen: boolean;
  onClose: () => void;
}

export function AddToListModal({ anime, isOpen, onClose }: AddToListModalProps) {
  const { lists, addItemToList, removeItemFromList, isAnimeInList } = useCustomLists();
  const [notes, setNotes] = useState("");
  const displayTitle = getDisplayTitle(anime.title, true);
  const cover = anime.coverImage.large ?? anime.coverImage.extraLarge;

  if (!isOpen) return null;

  const handleToggle = (listId: string) => {
    const inList = isAnimeInList(listId, anime.id);
    if (inList) {
      removeItemFromList(listId, anime.id);
    } else {
      addItemToList(listId, {
        anilistId: anime.id,
        title: displayTitle,
        mediaType: anime.mediaType ?? "anime",
        coverImage: cover ?? null,
        bannerImage: anime.bannerImage ?? null,
        format: anime.format ?? null,
        averageScore: anime.averageScore ?? null,
        notes: notes.trim() || undefined,
      });
      setNotes("");
    }
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
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-contrast">
              <BookmarkIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-bold text-white">
                Add to Curated List
              </h3>
              <p className="truncate text-xs text-white/50">{displayTitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Optional ranking note for when adding */}
        <div className="mt-4">
          <label
            htmlFor="item-note"
            className="block text-xs font-semibold text-white/70"
          >
            Personal Ranking / Commentary Note (Optional)
          </label>
          <input
            id="item-note"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "Peak animation in episode 19, must watch"'
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* List of custom collections */}
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-1">
          {lists.length === 0 ? (
            <p className="py-4 text-center text-xs text-white/50">
              No lists created yet. Create a list below!
            </p>
          ) : (
            lists.map((list) => {
              const inList = isAnimeInList(list.id, anime.id);
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => handleToggle(list.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    inList
                      ? "border-accent bg-accent/15 text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-xs font-bold">{list.title}</p>
                    <p className="truncate text-[10px] text-white/50">
                      {list.items.length} titles
                    </p>
                  </div>

                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                      inList
                        ? "border-accent bg-accent text-accent-contrast shadow-sm"
                        : "border-white/20 bg-white/5 text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-5 border-t border-white/10 pt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accent-contrast shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
