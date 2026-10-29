"use client";

import { CloseIcon, GridIcon, ListIcon, SearchIcon, SlidersIcon } from "@/components/icons";
import {
  LIBRARY_SORT_LABELS,
  WATCH_STATUS_META,
  WATCH_STATUS_ORDER,
} from "@/lib/library-meta";
import { cn } from "@/lib/utils";
import type { LibrarySort, LibraryView, WatchStatus } from "@/types/library";

export type LibraryStatusFilter = WatchStatus | "all";

const STATUS_PILL_CONFIG: Record<
  LibraryStatusFilter,
  {
    beacon: string;
    activeBorder: string;
    activeBg: string;
    activeText: string;
    activeBadge: string;
  }
> = {
  all: {
    beacon: "bg-white/80",
    activeBorder: "border-accent/50 shadow-[0_0_12px_rgba(139,92,246,0.25)]",
    activeBg: "bg-accent-soft",
    activeText: "text-fg font-semibold",
    activeBadge: "bg-accent/25 text-accent-strong",
  },
  watching: {
    beacon: "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]",
    activeBorder: "border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.25)]",
    activeBg: "bg-purple-500/15",
    activeText: "text-purple-200 font-semibold",
    activeBadge: "bg-purple-500/25 text-purple-300",
  },
  planning: {
    beacon: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]",
    activeBorder: "border-sky-500/50 shadow-[0_0_12px_rgba(56,189,248,0.25)]",
    activeBg: "bg-sky-500/15",
    activeText: "text-sky-200 font-semibold",
    activeBadge: "bg-sky-500/25 text-sky-300",
  },
  on_hold: {
    beacon: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
    activeBorder: "border-amber-500/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]",
    activeBg: "bg-amber-500/15",
    activeText: "text-amber-200 font-semibold",
    activeBadge: "bg-amber-500/25 text-amber-300",
  },
  completed: {
    beacon: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
    activeBorder: "border-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.25)]",
    activeBg: "bg-emerald-500/15",
    activeText: "text-emerald-200 font-semibold",
    activeBadge: "bg-emerald-500/25 text-emerald-300",
  },
  dropped: {
    beacon: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]",
    activeBorder: "border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
    activeBg: "bg-rose-500/15",
    activeText: "text-rose-200 font-semibold",
    activeBadge: "bg-rose-500/25 text-rose-300",
  },
};

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
    <div className="space-y-4">
      {/* Status Segmented Bar */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-surface/70 p-1.5 backdrop-blur-md shadow-xs">
        <div
          role="group"
          aria-label="Filter by watch status"
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto"
        >
          {filterList.map((value) => {
            const active = status === value;
            const label =
              value === "all" ? "All Series" : WATCH_STATUS_META[value].shortLabel;
            const conf = STATUS_PILL_CONFIG[value];
            const count = statusCounts[value];

            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusChange(value)}
                className={cn(
                  "group relative inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all duration-150 ease-out select-none active:scale-[0.98]",
                  active
                    ? cn(conf.activeBorder, conf.activeBg, conf.activeText)
                    : "border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {/* Status beacon dot */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-150",
                    conf.beacon,
                    active ? "scale-110 opacity-100" : "opacity-50 group-hover:opacity-85",
                  )}
                />
                <span>{label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
                    active
                      ? conf.activeBadge
                      : "bg-surface-3/80 text-faint group-hover:text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control bar: Search, Sort & View Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input with custom clear button & suppressed WebKit cancel icon */}
        <div className="relative w-full sm:max-w-md">
          <label htmlFor="library-search" className="sr-only">
            Search your library
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-faint">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search titles in library…"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-surface/70 pl-10 pr-9 text-sm text-fg placeholder:text-faint/70 transition-all focus:border-accent focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-faint transition-colors hover:text-fg"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort & View Mode Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3 text-faint">
              <SlidersIcon className="h-3.5 w-3.5" />
            </div>
            <label htmlFor="library-sort" className="sr-only">
              Sort library
            </label>
            <select
              id="library-sort"
              aria-label="Sort library"
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as LibrarySort)
              }
              className="h-11 rounded-xl border border-white/[0.08] bg-surface/70 pl-9 pr-8 text-xs font-medium text-fg transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="flex rounded-xl border border-white/[0.08] bg-surface/70 p-1 backdrop-blur-md"
          >
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => onViewChange("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 active:scale-95",
                view === "grid"
                  ? "border border-accent/40 bg-accent-soft text-accent-strong shadow-xs"
                  : "text-faint hover:text-muted hover:bg-surface-2",
              )}
              aria-label="Poster grid view"
              title="Poster grid view"
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 active:scale-95",
                view === "list"
                  ? "border border-accent/40 bg-accent-soft text-accent-strong shadow-xs"
                  : "text-faint hover:text-muted hover:bg-surface-2",
              )}
              aria-label="Detailed list view"
              title="Detailed list view"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
