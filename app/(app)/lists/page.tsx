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
      className="absolute aspect-[2/3] h-32 overflow-hidden border border-border/80 bg-surface-2 shadow-lg transition-transform duration-300 group-hover:scale-105"
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
        <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
          <FilmIcon className="h-5 w-5 text-faint" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70"
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
    <div className="space-y-6 pb-12">
      {/* 1. Masthead */}
      <header className="relative border border-border bg-surface/40 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
              Curated Anthologies · Custom Archives
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 border border-accent bg-accent px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <PlusIcon className="h-3 w-3" />
              <span>Create Collection</span>
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-2xl">
          <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-fg">
            Custom Lists
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            Curated anthologies, ranked tiers, and thematic collections.
            Synchronized with your personal library progress in real time.
          </p>
        </div>
      </header>

      {/* 2. Search & Metric Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-2.5">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections by title or theme..."
            className="h-8 w-full border border-border bg-surface pl-9 pr-3 text-xs text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>

        <span className="font-mono text-[11px] text-faint">
          {filteredLists.length}{" "}
          {filteredLists.length === 1 ? "collection" : "collections"} indexed
        </span>
      </div>

      {/* 3. Lists Grid */}
      {filteredLists.length === 0 ? (
        <div className="border border-border bg-surface/40 p-12 text-center">
          <BookmarkIcon className="mx-auto h-8 w-8 text-muted opacity-40" />
          <h3 className="mt-3 font-display text-sm font-semibold text-fg">
            No collections found
          </h3>
          <p className="mt-1 text-xs text-muted">
            {search.trim()
              ? "No lists match your search query. Try another term or clear the filter."
              : "Create your first curated collection to organize anime by theme, season, or personal ranking."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (search.trim()) setSearch("");
              else setIsCreateOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{search.trim() ? "Clear Search" : "Create New List"}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredLists.map((list) => {
            const progress = calculateProgress(list, libraryItems);
            const previewItems = list.items.slice(0, 4);

            return (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="group relative flex flex-col justify-between border border-border bg-surface/40 p-4 transition-colors hover:border-accent hover:bg-surface"
              >
                <div>
                  {/* Poster Stack / Fan Preview (Letterboxd Style) */}
                  <div className="relative mb-4 flex h-36 w-full items-center justify-center overflow-hidden border border-border bg-surface-2/60 p-2">
                    {previewItems.length > 0 ? (
                      <div className="relative flex h-full w-full items-center justify-center">
                        {previewItems.map((item, idx, arr) => {
                          const offset = (idx - (arr.length - 1) / 2) * 26;
                          const rotate = (idx - (arr.length - 1) / 2) * 3;
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
                        <BookmarkIcon className="h-6 w-6 opacity-40" />
                        <span className="mt-1 font-mono text-[10px] text-faint">
                          Empty collection
                        </span>
                      </div>
                    )}

                    {/* Item count tag */}
                    <span className="absolute bottom-2 right-2 z-20 border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] font-bold text-fg">
                      {list.items.length} titles
                    </span>
                  </div>

                  {/* List Details */}
                  <h2 className="font-display text-base font-semibold text-fg transition-colors group-hover:text-accent-strong line-clamp-1">
                    {list.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {list.description || "No description provided."}
                  </p>
                </div>

                {/* Progress Footer (Letterboxd Watched Indicator) */}
                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-muted">
                      Watched{" "}
                      <span className="font-bold text-fg">
                        {progress.watchedCount}
                      </span>{" "}
                      of {progress.totalCount}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold border px-1.5 py-0.5 ${
                        progress.isFullyWatched
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-surface text-muted"
                      }`}
                    >
                      {progress.percentage}%
                    </span>
                  </div>

                  {/* Ruled progress bar */}
                  <div className="mt-2 h-1 w-full border border-border bg-surface-3">
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
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateListModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
