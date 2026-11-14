"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  ExternalIcon,
  FilmIcon,
  GripIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { useCustomLists } from "@/features/lists/lists-provider";
import { useLibrary } from "@/features/library/library-provider";
import { useScreenLibraryItems } from "@/features/screen/use-screen-library";
import { WATCH_STATUS_META } from "@/lib/library-meta";
import { listItemsFor, smartRuleLabel } from "@/lib/smart-lists";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import {
  customListItemHref,
  customListItemKey,
  customListItemLabel,
} from "@/types/custom-list";

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
    moveItemInList,
    calculateProgress,
  } = useCustomLists();
  const { items: libraryItems } = useLibrary();
  const screenItems = useScreenLibraryItems();

  const [copied, setCopied] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const list = getList(id);
  const mounted = useMounted();

  // Collections live in localStorage, so the first paint must not guess at them.
  if (!mounted) {
    return (
      <div
        aria-busy="true"
        className="h-64 animate-pulse border border-border bg-surface/40"
      />
    );
  }

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

  const items = listItemsFor(list, libraryItems, screenItems);
  const progress = calculateProgress(
    { ...list, items },
    libraryItems,
    screenItems,
  );

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

  const handleSaveNote = (itemKey: string) => {
    updateItemNotes(list.id, itemKey, noteText);
    setEditingNoteId(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (!draggingKey) return;
    moveItemInList(list.id, draggingKey, targetIndex);
    setDraggingKey(null);
    setDropTargetKey(null);
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
              Themed Anthology // {items.length} Titles
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
          {list.rule ? (
            <span className="mt-3 inline-flex items-center border border-accent/40 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-accent-strong">
              {smartRuleLabel(list.rule)} · auto-filled
            </span>
          ) : null}
        </div>

        {/* Completion Status Ledger */}
        <div
          hidden={items.length === 0}
          className="mt-6 border border-border bg-surface-2/40 p-4"
        >
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
        <div className="flex items-end justify-between gap-3 border-b border-border pb-2.5">
          <div>
            <h2 className="font-display text-base font-semibold text-fg">
              {list.rule ? "Matching titles" : "Ranked Entries"}
            </h2>
            <p className="mt-0.5 text-[10px] text-faint">
              {list.rule
                ? "Filled automatically from your library. Remove the rule by deleting this collection."
                : "Drag a row — or use the arrows — to re-rank this collection."}
            </p>
          </div>
          <span className="shrink-0 font-mono text-xs text-faint">
            {items.length} {items.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="border border-border bg-surface/40 p-10 text-center">
            <h3 className="text-sm font-semibold text-fg">
              {list.rule ? "Nothing matches this rule yet" : "No titles in this list yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
              {list.rule
                ? "This collection fills itself from your library, so it will populate as soon as a title fits the rule. Nothing needs adding by hand."
                : "Browse Discover or the film & TV shelves and click “Add to Curated List” on any title to populate this collection."}
            </p>
            <Link
              href={list.rule ? "/library" : "/discover"}
              className="mt-4 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <span>{list.rule ? "Open library" : "Explore Discover"}</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const itemKey = customListItemKey(item);
              const libraryMatch =
                item.anilistId === undefined
                  ? undefined
                  : libraryItems.find(
                      (lib) => lib.entry.anilistId === item.anilistId,
                    );
              const screenMatch =
                item.tmdbId === undefined
                  ? undefined
                  : screenItems.find(
                      (lib) =>
                        lib.entry.tmdbId === item.tmdbId &&
                        lib.entry.mediaType === (item.tmdbKind ?? "movie"),
                    );
              const userStatus =
                libraryMatch?.entry.status ?? screenMatch?.entry.status;
              const statusMeta = userStatus
                ? WATCH_STATUS_META[userStatus]
                : null;
              const isWatched =
                userStatus === "completed" ||
                (libraryMatch?.entry.progress ?? 0) > 0 ||
                screenMatch?.entry.watched === true ||
                (screenMatch?.watchedCount ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  draggable={list.rule ? false : true}
                  onDragStart={(event) => {
                    setDraggingKey(itemKey);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", itemKey);
                  }}
                  onDragEnd={() => {
                    setDraggingKey(null);
                    setDropTargetKey(null);
                  }}
                  onDragOver={(event) => {
                    if (!draggingKey) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (dropTargetKey !== itemKey) setDropTargetKey(itemKey);
                  }}
                  onDragLeave={() =>
                    setDropTargetKey((current) =>
                      current === itemKey ? null : current,
                    )
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDrop(idx);
                  }}
                  className={cn(
                    "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border p-3 transition-colors",
                    isWatched
                      ? "border-border bg-surface/60 hover:bg-surface"
                      : "border-border bg-surface/30 hover:border-accent/40 hover:bg-surface/60",
                    draggingKey === itemKey && "opacity-40",
                    dropTargetKey === itemKey &&
                      draggingKey !== itemKey &&
                      "border-accent ring-1 ring-accent/40",
                  )}
                >
                  {/* Left: Drag Handle + Rank + Thumbnail + Details */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Drag Handle */}
                    {list.rule ? null : (
                      <span
                        aria-hidden="true"
                        className="hidden h-7 w-4 shrink-0 cursor-grab items-center justify-center text-faint/70 transition-colors group-hover:text-muted active:cursor-grabbing sm:flex"
                      >
                        <GripIcon className="h-4 w-4" />
                      </span>
                    )}

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
                          href={customListItemHref(item)}
                          className="font-display text-sm font-semibold text-fg transition-colors hover:text-accent-strong line-clamp-1"
                        >
                          {item.title}
                        </Link>
                        {item.format || customListItemLabel(item) ? (
                          <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-muted">
                            {item.format ?? customListItemLabel(item)}
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
                      {editingNoteId === itemKey ? (
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
                            onClick={() => handleSaveNote(itemKey)}
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
                          {list.rule ? null : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(itemKey);
                                setNoteText(item.notes ?? "");
                              }}
                              className="text-[10px] font-mono text-accent-strong hover:underline shrink-0"
                            >
                              [Edit note]
                            </button>
                          )}
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

                    <div className="flex items-center gap-0.5">
                      {list.rule ? null : (
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          moveItemInList(list.id, itemKey, idx - 1)
                        }
                        aria-label={`Move ${item.title} up`}
                        title="Move up"
                        className="flex h-7 w-7 items-center justify-center border border-transparent text-muted transition-colors hover:border-border hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowUpIcon className="h-3 w-3" />
                      </button>
                      )}
                      {list.rule ? null : (
                      <button
                        type="button"
                        disabled={idx === items.length - 1}
                        onClick={() =>
                          moveItemInList(list.id, itemKey, idx + 1)
                        }
                        aria-label={`Move ${item.title} down`}
                        title="Move down"
                        className="flex h-7 w-7 items-center justify-center border border-transparent text-muted transition-colors hover:border-border hover:bg-surface hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowDownIcon className="h-3 w-3" />
                      </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeItemFromList(list.id, itemKey)
                      }
                      hidden={Boolean(list.rule)}
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
