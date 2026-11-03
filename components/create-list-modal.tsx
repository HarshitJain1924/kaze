"use client";

import { useState } from "react";
import { BookmarkIcon, CloseIcon, SparklesIcon } from "@/components/icons";
import { useCustomLists } from "@/features/lists/lists-provider";

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateListModal({
  isOpen,
  onClose,
  onCreated,
}: CreateListModalProps) {
  const { createList } = useCustomLists();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const list = createList(title, description, isPublic);
    setTitle("");
    setDescription("");
    onClose();
    if (onCreated) {
      onCreated(list.id);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Custom Anime Collection"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-contrast">
              <BookmarkIcon className="h-4 w-4" />
            </span>
            <h3 className="font-display text-lg font-bold text-white">
              Create Curated List
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="list-title"
              className="block text-xs font-semibold text-white/80"
            >
              List Title <span className="text-red-400">*</span>
            </label>
            <input
              id="list-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Peak Fiction: Overpowered MC Manhwa"'
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label
              htmlFor="list-desc"
              className="block text-xs font-semibold text-white/80"
            >
              Description / Theme Note
            </label>
            <textarea
              id="list-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the vibe, ranking criteria, or aesthetic of this collection..."
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div>
              <p className="text-xs font-semibold text-white">Public & Shareable</p>
              <p className="text-[11px] text-white/50">
                Anyone with the link can explore and track their progress on this list
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic(!isPublic)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isPublic ? "bg-accent" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                  isPublic ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accent-contrast shadow-md shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>Create Collection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

