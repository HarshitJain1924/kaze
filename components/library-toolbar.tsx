"use client";

import { CloseIcon, GridIcon, ListIcon, SearchIcon } from "@/components/icons";
import {
  LIBRARY_SORT_LABELS,
  WATCH_STATUS_META,
  WATCH_STATUS_ORDER,
} from "@/lib/library-meta";
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
  const filterList: LibraryStatusFilter[] = ["all", ...WATCH_STATUS_ORDER];

  return (
    <div className="space-y-3">
      {/* Status Filter Strip */}
      <div
        role="group"
        aria-label="Filter by watch status"
        className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto border-y border-border px-4 py-2.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {filterList.map((value) => {
          const active = status === value;
          const label =
            value === "all" ? "All" : WATCH_STATUS_META[value].shortLabel;
          const count = statusCounts[value];

          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(value)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
                active
                  ? "border-accent bg-accent text-accent-contrast"
                  : "border-border text-muted hover:border-accent/60 hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "font-mono text-[9px] tabular-nums",
                  active ? "text-accent-contrast/85" : "text-faint",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, Sort & View Mode Switcher Deck */}
      <div className="flex flex-col gap-2.5 border border-border bg-surface/70 p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-3.5">
        {/* Search input with custom clear button */}
        <div className="relative flex-1">
          <label htmlFor="library-search" className="sr-only">
            Search your library
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search titles in library…"
            className="h-10 w-full border border-border bg-bg/60 pl-9 pr-8 text-[13px] text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-faint transition-colors hover:text-fg"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort & View Mode Switcher */}
        <div className="flex items-center justify-between gap-2.5 sm:justify-end">
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-faint sm:inline">
              Sort
            </span>
            <select
              id="library-sort"
              aria-label="Sort library"
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as LibrarySort)
              }
              className="h-8 border border-border bg-surface px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg focus:border-accent focus:outline-none"
            >
              {(
                Object.entries(LIBRARY_SORT_LABELS) as Array<[LibrarySort, string]>
              ).map(([value, label]) => (
                <option key={value} value={value} className="bg-surface text-fg">
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Grid vs List View segmented toggle */}
          <div
            role="group"
            aria-label="Library layout view"
            className="inline-flex items-center border border-border"
          >
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => onViewChange("grid")}
              className={cn(
                "flex h-7 w-7 items-center justify-center transition-colors",
                view === "grid"
                  ? "bg-accent text-accent-contrast"
                  : "text-muted hover:text-fg",
              )}
              aria-label="Poster grid view"
              title="Poster grid view"
            >
              <GridIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center border-l border-border transition-colors",
                view === "list"
                  ? "bg-accent text-accent-contrast"
                  : "text-muted hover:text-fg",
              )}
              aria-label="Detailed list view"
              title="Detailed list view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
