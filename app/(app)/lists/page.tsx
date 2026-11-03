"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BookmarkIcon,
  FilmIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { CreateListModal } from "@/components/create-list-modal";
import { useCustomLists } from "@/features/lists/lists-provider";
import { useLibrary } from "@/features/library/library-provider";

function ListPosterCard({
  src,
  alt = "",
  style,
}: {
  src: string | null;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className="absolute aspect-[2/3] h-32 overflow-hidden rounded-xl border border-white/20 bg-surface-2 shadow-2xl transition-transform duration-300 group-hover:scale-105"
      style={style}
    >
      {!hasError && src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-3 via-surface-2 to-black/60">
          <FilmIcon className="h-6 w-6 text-faint/70" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60"
      />
    </div>
  );
}

export default function ListsPage() {
  const { lists, calculateProgress } = useCustomLists();
  const { items: libraryItems } = useLibrary();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredLists = useMemo(() => {
    if (!search.trim()) return lists;
    const q = search.toLowerCase();
    return lists.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q),
    );
  }, [lists, search]);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <header className="relative isolate overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-surface-2 p-6 sm:p-8 shadow-xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-accent/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-strong">
              <BookmarkIcon className="h-3.5 w-3.5" />
              <span>Curated Collections</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
              Custom Anime & Manga Lists
            </h1>
            <p className="text-xs leading-relaxed text-muted sm:text-sm">
              Discover, curate, and share themed anthologies. Track your progress across community and personal collections with real-time library synchronization.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-xs font-bold text-accent-contrast shadow-lg shadow-accent/25 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create New List</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative z-10 mt-6 max-w-md">
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections by title or theme..."
              className="w-full rounded-xl border border-border bg-surface/80 pl-10 pr-4 py-2.5 text-xs text-fg placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent backdrop-blur-md"
            />
          </div>
        </div>
      </header>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {filteredLists.map((list) => {
          const progress = calculateProgress(list, libraryItems);
          const previewItems = list.items.slice(0, 4);

          return (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-surface/90 p-5 shadow-md backdrop-blur-md transition-all duration-300 hover:border-accent/40 hover:bg-surface-2 hover:shadow-xl hover:scale-[1.01]"
            >
              <div>
                {/* Poster Stack / Fan Preview (Letterboxd Style) */}
                <div className="relative mb-5 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-black/40 border border-white/5 p-3">
                  {previewItems.length > 0 ? (
                    <div className="relative flex items-center justify-center w-full h-full">
                      {previewItems.map((item, idx, arr) => {
                        // Stagger poster rotation and overlapping offset
                        const offset = (idx - (arr.length - 1) / 2) * 28;
                        const rotate = (idx - (arr.length - 1) / 2) * 4;
                        return (
                          <ListPosterCard
                            key={item.id ?? idx}
                            src={item.coverImage}
                            alt={item.title}
                            style={{
                              transform: `translateX(${offset}px) rotate(${rotate}deg)`,
                              zIndex: idx + 1,
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-muted">
                      <BookmarkIcon className="h-8 w-8 opacity-40" />
                      <span className="mt-1 text-[11px]">Empty list</span>
                    </div>
                  )}

                  {/* Item count chip */}
                  <span className="absolute bottom-2.5 right-2.5 z-20 rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-md">
                    {list.items.length} titles
                  </span>
                </div>

                {/* List Details */}
                <h2 className="font-display text-base font-bold text-fg group-hover:text-accent-strong transition-colors line-clamp-1">
                  {list.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                  {list.description || "No description provided."}
                </p>
              </div>

              {/* Progress Footer (Letterboxd Watched Indicator) */}
              <div className="mt-5 border-t border-border-subtle pt-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted">
                    Watched <span className="font-bold text-fg">{progress.watchedCount}</span> of {progress.totalCount}
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      progress.isFullyWatched
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-surface-3 text-muted"
                    }`}
                  >
                    {progress.percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      progress.isFullyWatched
                        ? "bg-emerald-500"
                        : "bg-gradient-to-r from-accent to-purple-400"
                    }`}
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <CreateListModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
