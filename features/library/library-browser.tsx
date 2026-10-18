"use client";

import { useMemo, useState } from "react";

import { AnimeSearch } from "@/components/anime-search";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GridIcon, ListIcon, LibraryIcon } from "@/components/icons";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/link-button";
import { usePreferences } from "@/components/providers/preferences-provider";
import { LibraryItemCard } from "@/features/library/library-item-card";
import { LibraryList } from "@/features/library/library-list";
import { useLibrary } from "@/features/library/library-provider";
import { LIBRARY_SORT_LABELS, WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, getDisplayTitle } from "@/lib/utils";
import type { LibrarySort, WatchStatus } from "@/types/library";

export type LibraryStatusFilter = WatchStatus | "all";

export function LibraryBrowser({
  initialStatus,
}: {
  initialStatus: LibraryStatusFilter;
}) {
  const { items, loadError, pendingIds } = useLibrary();
  const { preferences, setPreference } = usePreferences();

  const [status, setStatus] = useState<LibraryStatusFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");

  const view = preferences.libraryView;

  const statusCounts = useMemo(() => {
    const counts: Record<LibraryStatusFilter, number> = {
      all: items.length,
      watching: 0,
      completed: 0,
      planning: 0,
      on_hold: 0,
      dropped: 0,
    };
    for (const item of items) {
      counts[item.entry.status] += 1;
    }
    return counts;
  }, [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (status !== "all" && item.entry.status !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      if (!item.anime) {
        return String(item.entry.anilistId).includes(needle);
      }
      const haystack = [
        item.anime.title.english,
        item.anime.title.romaji,
        item.anime.title.native,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "title": {
          const left = a.anime
            ? getDisplayTitle(a.anime.title, true)
            : "Untitled entry";
          const right = b.anime
            ? getDisplayTitle(b.anime.title, true)
            : "Untitled entry";
          return left.localeCompare(right);
        }
        case "score":
          return (b.entry.score ?? -1) - (a.entry.score ?? -1);
        case "progress":
          return b.entry.progress - a.entry.progress;
        case "recent":
        default:
          return (
            new Date(b.entry.updatedAt).getTime() -
            new Date(a.entry.updatedAt).getTime()
          );
      }
    });
  }, [items, query, sort, status]);

  const selectStatus = (next: LibraryStatusFilter) => {
    setStatus(next);
    const url =
      next === "all" ? "/library" : `/library?status=${next}`;
    window.history.replaceState(null, "", url);
  };

  const meta = status === "all" ? null : WATCH_STATUS_META[status];
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
            Your collection
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            My Library
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {items.length === 0
              ? "Track anime to build your personal library."
              : `${items.length} ${items.length === 1 ? "title" : "titles"} · ${statusCounts.watching} watching · ${statusCounts.completed} completed`}
          </p>
        </div>
      </header>

      {loadError ? (
        <ErrorState
          title="Your library could not be loaded"
          message="The database did not respond. Nothing has been deleted; try again in a moment."
          action={<RetryButton />}
        />
      ) : null}

      <div className="space-y-4">
        <div
          role="group"
          aria-label="Filter by watch status"
          className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
        >
          {(["all", ...WATCH_STATUS_ORDER] as LibraryStatusFilter[]).map(
            (value) => {
              const active = status === value;
              const label =
                value === "all" ? "All" : WATCH_STATUS_META[value].shortLabel;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectStatus(value)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "border-accent/40 bg-accent-soft text-fg"
                      : "border-transparent bg-surface-2/60 text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active
                        ? "bg-accent/20 text-accent-strong"
                        : "bg-surface-3 text-faint",
                    )}
                  >
                    {statusCounts[value]}
                  </span>
                </button>
              );
            },
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AnimeSearch
            value={query}
            onChange={setQuery}
            placeholder="Search your library…"
            label="Search your library"
            className="w-full sm:max-w-xs"
          />

          <div className="flex items-center gap-2">
            <label htmlFor="library-sort" className="sr-only">
              Sort library
            </label>
            <Select
              id="library-sort"
              aria-label="Sort library"
              value={sort}
              onChange={(event) => setSort(event.target.value as LibrarySort)}
              className="h-11 min-w-[170px]"
            >
              {(
                Object.entries(LIBRARY_SORT_LABELS) as Array<
                  [LibrarySort, string]
                >
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <div
              role="group"
              aria-label="Library layout"
              className="flex rounded-xl border border-border bg-surface-2/70 p-0.5"
            >
              <button
                type="button"
                aria-pressed={view === "grid"}
                onClick={() => setPreference("libraryView", "grid")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors",
                  view === "grid"
                    ? "bg-surface-3 text-fg"
                    : "text-faint hover:text-muted",
                )}
                aria-label="Grid view"
              >
                <GridIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                onClick={() => setPreference("libraryView", "list")}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors",
                  view === "list"
                    ? "bg-surface-3 text-fg"
                    : "text-faint hover:text-muted",
                )}
                aria-label="Compact list view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {items.length === 0 && !loadError ? (
        <EmptyState
          icon={<LibraryIcon className="h-5 w-5" />}
          title="Your library is empty"
          description="Find something in Discover and add it to your library. Your progress, ratings and notes will appear here."
          action={
            <LinkButton href="/discover" variant="primary" size="sm">
              Discover anime
            </LinkButton>
          }
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<LibraryIcon className="h-5 w-5" />}
          title={
            hasQuery
              ? "No matching titles"
              : meta
                ? meta.emptyTitle
                : "Nothing here yet"
          }
          description={
            hasQuery
              ? `No titles in ${status === "all" ? "your library" : meta?.label ?? status} match “${query.trim()}”.`
              : meta
                ? meta.emptyBody
                : "Try another filter."
          }
          action={
            hasQuery ? (
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : status !== "all" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => selectStatus("all")}
              >
                Show all titles
              </Button>
            ) : (
              <LinkButton href="/discover" variant="secondary" size="sm">
                Find anime
              </LinkButton>
            )
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visibleItems.map((item) => (
            <LibraryItemCard key={item.entry.id} item={item} />
          ))}
        </div>
      ) : (
        <LibraryList items={visibleItems} />
      )}

      {items.some((item) => !item.anime) ? (
        <p className="rounded-xl border border-border-subtle bg-surface/60 p-3 text-xs leading-relaxed text-faint">
          Some entries could not be matched with AniList metadata. Their
          progress, ratings and notes are preserved, and they remain removable
          here.
        </p>
      ) : null}

      {pendingIds.size > 0 ? (
        <span className="sr-only" role="status">
          Saving library changes
        </span>
      ) : null}
    </div>
  );
}
