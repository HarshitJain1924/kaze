"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LibraryIcon } from "@/components/icons";
import {
  LibraryToolbar,
  type LibraryStatusFilter,
} from "@/components/library-toolbar";
import { RetryButton } from "@/components/retry-button";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { usePreferences } from "@/components/providers/preferences-provider";
import { LibraryItemCard } from "@/features/library/library-item-card";
import { LibraryList } from "@/features/library/library-list";
import { useLibrary } from "@/features/library/library-provider";
import { WATCH_STATUS_META } from "@/lib/library-meta";
import { getDisplayTitle } from "@/lib/utils";
import type { LibrarySort } from "@/types/library";

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
    const url = next === "all" ? "/library" : `/library?status=${next}`;
    window.history.replaceState(null, "", url);
  };

  const meta = status === "all" ? null : WATCH_STATUS_META[status];
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <header>
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
      </header>

      {loadError ? (
        <ErrorState
          title="Your library could not be loaded"
          message="The database did not respond. Nothing has been deleted; try again in a moment."
          action={<RetryButton />}
        />
      ) : null}

      <LibraryToolbar
        status={status}
        onStatusChange={selectStatus}
        statusCounts={statusCounts}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={(next) => setPreference("libraryView", next)}
      />

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
              ? `No titles in ${status === "all" ? "your library" : (meta?.label ?? status)} match “${query.trim()}”.`
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
