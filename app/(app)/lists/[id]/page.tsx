"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BookmarkIcon,
  CheckIcon,
  CloseIcon,
  ExternalIcon,
  FilmIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { useCustomLists } from "@/features/lists/lists-provider";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META } from "@/lib/library-meta";

function ListItemThumbnail({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-2 shadow-sm">
      {!hasError && src ? (
        <Image
          src={src}
          alt={title}
          fill
          unoptimized
          className="object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2">
          <FilmIcon className="h-5 w-5 text-faint/70" />
        </div>
      )}
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CustomListDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { getList, deleteList, removeItemFromList, updateItemNotes, calculateProgress } =
    useCustomLists();
  const { items: libraryItems } = useLibrary();

  const [copied, setCopied] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const list = getList(id);

  if (!list) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-fg">Collection Not Found</h1>
        <p className="mt-2 text-sm text-muted">
          This list may have been deleted or does not exist.
        </p>
        <Link
          href="/lists"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Collections</span>
        </Link>
      </div>
    );
  }

  const progress = calculateProgress(list, libraryItems);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete the list "${list.title}"?`)) {
      deleteList(list.id);
      router.push("/lists");
    }
  };

  const handleSaveNote = (anilistId: number) => {
    updateItemNotes(list.id, anilistId, noteText);
    setEditingNoteId(null);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Back button */}
      <div>
        <Link
          href="/lists"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          <span>Back to all collections</span>
        </Link>
      </div>

      {/* Hero Header */}
      <header className="relative isolate overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-surface-2 p-6 sm:p-8 shadow-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-strong">
                <BookmarkIcon className="h-3.5 w-3.5" />
                <span>Themed Collection</span>
              </span>
              <span className="text-xs text-muted">·</span>
              <span className="text-xs text-muted">
                {list.items.length} ranked titles
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
              {list.title}
            </h1>

            <p className="text-sm leading-relaxed text-fg/80 max-w-2xl">
              {list.description || "No description provided."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-xs font-bold text-fg transition-all hover:bg-surface-3 hover:border-accent/40 active:scale-95 shadow-sm"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <ExternalIcon className="h-4 w-4 text-muted" />
                  <span>Share Collection</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
              title="Delete this collection"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live Watch Progress Bar (Letterboxd Style) */}
        <div className="relative z-10 mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 sm:p-5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent-strong">
                Your Completion Status
              </p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Watched <span className="text-accent">{progress.watchedCount}</span> of {progress.totalCount} titles ({progress.percentage}%)
              </p>
            </div>

            {progress.isFullyWatched && progress.totalCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                <CheckIcon className="h-3.5 w-3.5" />
                Collection Completed!
              </span>
            ) : null}
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress.isFullyWatched
                  ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                  : "bg-gradient-to-r from-accent to-purple-400"
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </header>

      {/* Ranked Titles List */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold text-fg">Ranked Entries</h2>

        {list.items.length === 0 ? (
          <div className="rounded-3xl border border-border-subtle bg-surface/50 p-12 text-center">
            <BookmarkIcon className="mx-auto h-8 w-8 text-muted opacity-40" />
            <h3 className="mt-3 text-sm font-bold text-fg">No titles in this list yet</h3>
            <p className="mt-1 text-xs text-muted">
              Browse anime or manga on Discover and click &ldquo;Add to Curated List&rdquo; to populate this collection.
            </p>
            <Link
              href="/discover"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast"
            >
              <span>Explore Titles</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {list.items.map((item, idx) => {
              const libraryMatch = libraryItems.find(
                (lib) => lib.entry.anilistId === item.anilistId,
              );
              const userStatus = libraryMatch?.entry.status;
              const statusMeta = userStatus ? WATCH_STATUS_META[userStatus] : null;
              const isWatched = userStatus === "completed" || (libraryMatch?.entry.progress ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden rounded-2xl border p-4 backdrop-blur-md transition-all ${
                    isWatched
                      ? "border-emerald-500/20 bg-surface/90"
                      : "border-border-subtle bg-surface/70 hover:border-border"
                  }`}
                >
                  {/* Left: Rank + Poster + Title & Notes */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-3 font-display text-sm font-extrabold text-fg shadow-inner">
                      #{idx + 1}
                    </span>

                    {/* Poster Thumbnail */}
                    <ListItemThumbnail src={item.coverImage} title={item.title} />

                    {/* Meta & Notes */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/media/${item.anilistId}`}
                          className="font-display text-base font-bold text-fg hover:text-accent-strong transition-colors line-clamp-1"
                        >
                          {item.title}
                        </Link>
                        {item.format ? (
                          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted">
                            {item.format}
                          </span>
                        ) : null}
                        {item.averageScore ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
                            <StarIcon className="h-3 w-3 fill-current" />
                            {item.averageScore / 10}
                          </span>
                        ) : null}
                      </div>

                      {/* Personal Ranking Notes */}
                      {editingNoteId === item.anilistId ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add your personal commentary / ranking note..."
                            className="flex-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg focus:border-accent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(item.anilistId)}
                            className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-contrast"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="text-xs text-muted hover:text-fg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs leading-relaxed text-muted line-clamp-2 italic">
                            {item.notes ? `“${item.notes}”` : "No ranking note added yet."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(item.anilistId);
                              setNoteText(item.notes ?? "");
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-accent hover:underline transition-opacity shrink-0"
                          >
                            Edit note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: User Library Progress Tag & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                    {/* Live library watched indicator */}
                    {statusMeta ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold"
                        style={{
                          borderColor: `${statusMeta.color}40`,
                          backgroundColor: `${statusMeta.color}15`,
                          color: statusMeta.color,
                        }}
                      >
                        {userStatus === "completed" ? (
                          <CheckIcon className="h-3.5 w-3.5" />
                        ) : null}
                        <span>{statusMeta.label}</span>
                      </span>
                    ) : (
                      <span className="rounded-xl border border-white/10 bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                        Not in library
                      </span>
                    )}

                    {/* Quick remove from list */}
                    <button
                      type="button"
                      onClick={() => removeItemFromList(list.id, item.anilistId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      title="Remove from list"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
