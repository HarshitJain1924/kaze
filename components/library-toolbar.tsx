"use client";

import { AnimeSearch } from "@/components/anime-search";
import { GridIcon, ListIcon } from "@/components/icons";
import { Select } from "@/components/ui/field";
import { LIBRARY_SORT_LABELS, WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn } from "@/lib/utils";
import type { LibrarySort, LibraryView, WatchStatus } from "@/types/library";

export type LibraryStatusFilter = WatchStatus | "all";

export function LibraryToolbar({
  status,
  onStatusChange,
  statusCounts,
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  status: LibraryStatusFilter;
  onStatusChange: (status: LibraryStatusFilter) => void;
  statusCounts: Record<LibraryStatusFilter, number>;
  query: string;
  onQueryChange: (query: string) => void;
  sort: LibrarySort;
  onSortChange: (sort: LibrarySort) => void;
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
}) {
  return (
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
                onClick={() => onStatusChange(value)}
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
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
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
          onChange={onQueryChange}
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
            onChange={(event) =>
              onSortChange(event.target.value as LibrarySort)
            }
            className="h-11 min-w-[170px]"
          >
            {(
              Object.entries(LIBRARY_SORT_LABELS) as Array<[LibrarySort, string]>
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
              onClick={() => onViewChange("grid")}
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
              onClick={() => onViewChange("list")}
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
  );
}
