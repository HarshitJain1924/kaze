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
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg border border-border bg-surface/95 p-6 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center border border-border bg-surface text-accent-strong">
              <BookmarkIcon className="h-3.5 w-3.5" />
            </span>
            <div>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                Collection Builder
              </span>
              <h3 className="font-display text-base font-semibold text-fg">
                Create Curated List
              </h3>
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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="list-title"
              className="block text-xs font-semibold text-fg"
            >
              List Title <span className="text-danger">*</span>
            </label>
            <input
              id="list-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Peak Fiction: Psychological Masterpieces"'
              className="mt-1.5 h-10 w-full border border-border bg-surface-2/60 px-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="list-desc"
              className="block text-xs font-semibold text-fg"
            >
              Description / Theme Note
            </label>
            <textarea
              id="list-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the criteria, ranking order, or aesthetic of this anthology..."
              className="mt-1.5 w-full border border-border bg-surface-2/60 p-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between border border-border bg-surface-2/40 p-3">
            <div>
              <p className="text-xs font-semibold text-fg">Public &amp; Shareable</p>
              <p className="text-[11px] text-muted">
                Anyone with the direct link can explore and track their progress on this list
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={() => setIsPublic(!isPublic)}
              className={`h-7 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                isPublic
                  ? "border-accent bg-accent text-accent-contrast"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {isPublic ? "Public" : "Private"}
            </button>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 border border-border bg-surface px-4 text-[11px] font-semibold uppercase tracking-wider text-muted hover:border-accent hover:text-fg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="inline-flex h-9 items-center gap-1.5 border border-accent bg-accent px-4 text-[11px] font-semibold uppercase tracking-wider text-accent-contrast hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
