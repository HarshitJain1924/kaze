"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
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
    <div className="relative aspect-[2/3] w-12 sm:w-14 shrink-0 overflow-hidden border border-border/80 bg-surface-2">
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
        <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
          <FilmIcon className="h-5 w-5 text-faint" />
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
  const {
    getList,
    deleteList,
    removeItemFromList,
    updateItemNotes,
    calculateProgress,
  } = useCustomLists();
  const { items: libraryItems } = useLibrary();

  const [copied, setCopied] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const list = getList(id);

  if (!list) {
    return (
      <div className="border border-border bg-surface/40 p-12 text-center">
        <h1 className="font-display text-xl font-semibold text-fg">
          Collection Not Found
        </h1>
        <p className="mt-2 text-xs text-muted">
          This list may have been deleted or does not exist.
        </p>
        <Link
          href="/lists"
          className="mt-5 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
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
    if (confirm(`Are you sure you want to delete the collection "${list.title}"?`)) {
      deleteList(list.id);
      router.push("/lists");
    }
  };

  const handleSaveNote = (anilistId: number) => {
    updateItemNotes(list.id, anilistId, noteText);
    setEditingNoteId(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Back Navigation */}
      <div>
        <Link
          href="/lists"
          className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-fg"
        >
          <ArrowLeftIcon className="h-3 w-3" />
          <span>Back to Collections</span>
        </Link>
      </div>

      {/* 2. Hero Header */}
      <header className="border border-border bg-surface/40 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Themed Anthology // {list.items.length} Titles
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-7 items-center gap-1.5 border border-border bg-surface px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg transition-colors hover:border-accent"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Link Copied</span>
                </>
              ) : (
                <>
                  <ExternalIcon className="h-3 w-3 text-muted" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-7 items-center gap-1.5 border border-danger/30 bg-danger/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-danger transition-colors hover:bg-danger/20"
              title="Delete this collection"
            >
              <TrashIcon className="h-3 w-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-3xl">
          <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-fg">
            {list.title}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            {list.description || "No description provided."}
          </p>
        </div>

        {/* Completion Status Ledger */}
        <div className="mt-6 border border-border bg-surface-2/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-strong">
                Library Synchronization
              </p>
              <p className="mt-0.5 font-mono text-xs sm:text-sm text-fg">
                Watched{" "}
                <span className="font-bold text-accent-strong">
                  {progress.watchedCount}
                </span>{" "}
                of {progress.totalCount} titles ({progress.percentage}%)
              </p>
            </div>

            {progress.isFullyWatched && progress.totalCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-400">
                <CheckIcon className="h-3 w-3" />
                Collection Completed
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 h-1.5 w-full border border-border bg-surface-3">
            <div
              className={`h-full transition-all duration-300 ${
                progress.isFullyWatched
                  ? "bg-emerald-500"
                  : "bg-accent"
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </header>

      {/* 3. Ranked Entries Ledger */}
      <section aria-label="Ranked Entries" className="space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h2 className="font-display text-base font-semibold text-fg">
            Ranked Entries
          </h2>
          <span className="font-mono text-xs text-faint">
            {list.items.length} {list.items.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {list.items.length === 0 ? (
          <div className="border border-border bg-surface/40 p-10 text-center">
            <h3 className="text-sm font-semibold text-fg">
              No titles in this list yet
            </h3>
            <p className="mt-1 text-xs text-muted">
              Browse Discover and click &ldquo;Add to Curated List&rdquo; on any title to populate this collection.
            </p>
            <Link
              href="/discover"
              className="mt-4 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <span>Explore Discover</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {list.items.map((item, idx) => {
              const libraryMatch = libraryItems.find(
                (lib) => lib.entry.anilistId === item.anilistId,
              );
              const userStatus = libraryMatch?.entry.status;
              const statusMeta = userStatus
                ? WATCH_STATUS_META[userStatus]
                : null;
              const isWatched =
                userStatus === "completed" ||
                (libraryMatch?.entry.progress ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border p-3 transition-colors ${
                    isWatched
                      ? "border-border bg-surface/60 hover:bg-surface"
                      : "border-border bg-surface/30 hover:border-accent/40 hover:bg-surface/60"
                  }`}
                >
                  {/* Left: Rank + Thumbnail + Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-surface font-mono text-xs font-bold text-accent-strong">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>

                    {/* Poster Thumbnail */}
                    <ListItemThumbnail
                      src={item.coverImage}
                      title={item.title}
                    />

                    {/* Meta & Notes */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/media/${item.anilistId}`}
                          className="font-display text-sm font-semibold text-fg transition-colors hover:text-accent-strong line-clamp-1"
                        >
                          {item.title}
                        </Link>
                        {item.format ? (
                          <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-muted">
                            {item.format}
                          </span>
                        ) : null}
                        {item.averageScore ? (
                          <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold text-amber-400">
                            <StarIcon className="h-3 w-3 fill-current" />
                            {(item.averageScore / 10).toFixed(1)}
                          </span>
                        ) : null}
                      </div>

                      {/* Personal Commentary Note */}
                      {editingNoteId === item.anilistId ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add your personal ranking note..."
                            className="h-7 flex-1 border border-border bg-surface px-2.5 text-xs text-fg focus:border-accent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(item.anilistId)}
                            className="h-7 border border-accent bg-accent px-2 text-[10px] font-semibold uppercase tracking-wider text-accent-contrast hover:bg-accent-hover"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="h-7 border border-border bg-surface px-2 text-[10px] uppercase text-muted hover:text-fg"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs text-muted line-clamp-1 italic">
                            {item.notes
                              ? `“${item.notes}”`
                              : "No ranking commentary added."}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(item.anilistId);
                              setNoteText(item.notes ?? "");
                            }}
                            className="text-[10px] font-mono text-accent-strong hover:underline shrink-0"
                          >
                            [Edit note]
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Library Status Tag & Remove */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    {statusMeta ? (
                      <span
                        className="inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] font-bold"
                        style={{
                          borderColor: `${statusMeta.color}50`,
                          backgroundColor: `${statusMeta.color}15`,
                          color: statusMeta.color,
                        }}
                      >
                        {userStatus === "completed" ? (
                          <CheckIcon className="h-3 w-3" />
                        ) : null}
                        <span>{statusMeta.label}</span>
                      </span>
                    ) : (
                      <span className="border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-faint">
                        Not in library
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        removeItemFromList(list.id, item.anilistId)
                      }
                      className="flex h-7 w-7 items-center justify-center border border-transparent text-muted hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-colors"
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
      </section>
    </div>
  );
}
