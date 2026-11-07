"use client";

import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import {
  ChevronRightIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  LoaderIcon,
  SearchIcon,
  SlidersIcon,
  StarIcon,
} from "@/components/icons";
import { cn, isHttpUrl } from "@/lib/utils";

export interface DiscoverSpotlight {
  href: string;
  posterUrl: string | null;
  score: string | null;
  title: string;
  meta: string;
  ctaLabel: string;
}

/**
 * The cinematic Discover header. Both catalogue sources render this so the
 * page keeps one identity; only the copy and the artwork change.
 */
export function DiscoverHero({
  eyebrow,
  headlineMeta,
  title,
  description,
  backdropUrl,
  bannerUrl = null,
  spotlight = null,
}: {
  eyebrow: string;
  headlineMeta: string;
  title: string;
  description: string;
  backdropUrl: string | null;
  bannerUrl?: string | null;
  spotlight?: DiscoverSpotlight | null;
}) {
  const artwork = backdropUrl && isHttpUrl(backdropUrl) ? backdropUrl : null;
  const banner = bannerUrl && isHttpUrl(bannerUrl) ? bannerUrl : null;

  return (
    <header className="group relative isolate overflow-hidden rounded-3xl border border-border-subtle bg-surface-2 shadow-2xl transition-all">
      {artwork ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
        >
          <div className="absolute inset-0 scale-125 opacity-25 blur-3xl saturate-200">
            <Image
              src={artwork}
              alt=""
              fill
              unoptimized
              sizes="100vw"
              className="object-cover"
            />
          </div>
          {banner ? (
            <div className="absolute inset-0">
              <Image
                src={banner}
                alt=""
                fill
                unoptimized
                sizes="100vw"
                className="object-cover object-[center_25%] opacity-30"
              />
            </div>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 via-50% to-surface/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col justify-between gap-5 p-5 sm:p-7 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="radar-live-dot flex h-2 w-2 rounded-full bg-accent-strong" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-strong">
              {eyebrow}
            </span>
            <span className="text-faint">·</span>
            <span className="text-xs font-medium text-muted">{headlineMeta}</span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
            {title}
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
            {description}
          </p>
        </div>

        {spotlight ? (
          <div className="flex items-center gap-3.5 rounded-2xl border border-border-subtle bg-surface/70 p-3 shadow-xl backdrop-blur-md lg:max-w-sm">
            <Link
              href={spotlight.href}
              className="group/spot relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-md sm:w-20"
            >
              {spotlight.posterUrl && isHttpUrl(spotlight.posterUrl) ? (
                <Image
                  src={spotlight.posterUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover transition-transform duration-300 group-hover/spot:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-3" />
              )}
              {spotlight.score ? (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                  <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  <span>{spotlight.score}</span>
                </span>
              ) : null}
            </Link>

            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                Top Result
              </span>
              <Link
                href={spotlight.href}
                className="mt-0.5 line-clamp-1 block font-display text-sm font-bold text-fg transition-colors hover:text-accent-strong"
                title={spotlight.title}
              >
                {spotlight.title}
              </Link>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                {spotlight.meta}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={spotlight.href}
                  className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
                >
                  <span>{spotlight.ctaLabel}</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export interface DiscoverPill {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onSelect: () => void;
}

/** One-tap discovery channels (AniList channels, TMDB categories). */
export function DiscoverPills({ pills }: { pills: DiscoverPill[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {pills.map((pill) => {
        const Icon = pill.icon;
        return (
          <button
            key={pill.id}
            type="button"
            onClick={pill.onSelect}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all active:scale-95",
              pill.active
                ? "scale-102 border-accent bg-accent text-accent-contrast shadow-md"
                : "border-border-subtle bg-surface-2 text-muted hover:border-border hover:bg-surface-3 hover:text-fg",
            )}
          >
            <Icon
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-colors",
                pill.active ? "text-accent-contrast" : "text-accent-strong",
              )}
            />
            <span>{pill.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface DiscoverChip {
  key: string;
  label: string;
  clear: () => void;
}

/** Search + filter command deck. Catalogues only supply their own fields. */
export function DiscoverDeck({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchAriaLabel,
  placeholder,
  busy,
  onClearSearch,
  filtersOpen,
  onToggleFilters,
  filterCount,
  showReset,
  onReset,
  chips,
  onClearAll,
  hint = null,
  children = null,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  searchAriaLabel: string;
  placeholder: string;
  busy: boolean;
  onClearSearch: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterCount: number;
  showReset: boolean;
  onReset: () => void;
  chips: DiscoverChip[];
  onClearAll: () => void;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3.5 rounded-2xl border border-border-subtle bg-surface-2/80 p-3 shadow-lg backdrop-blur-md sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            role="searchbox"
            aria-label={searchAriaLabel}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchSubmit?.();
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-border bg-surface-3/50 pl-10 pr-20 text-sm text-fg placeholder:text-faint transition-colors focus:border-accent focus:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {busy ? (
              <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
            ) : null}
            {searchValue ? (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="Clear search"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden items-center rounded border border-border bg-surface-3/60 px-1.5 font-mono text-[10px] text-faint sm:inline-flex">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-xs font-semibold shadow-sm transition-all active:scale-95",
              filtersOpen || filterCount > 0
                ? "border-accent bg-accent/20 text-accent-strong"
                : "border-border-subtle bg-surface-2 text-muted hover:bg-surface-3 hover:text-fg",
            )}
          >
            <SlidersIcon className="h-4 w-4" />
            <span>Filters</span>
            {filterCount > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-contrast">
                {filterCount}
              </span>
            ) : null}
          </button>

          {showReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-11 items-center rounded-xl border border-border-subtle bg-surface-3/60 px-3 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="border-t border-border-subtle pt-2">{children}</div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="mr-1 text-[11px] font-semibold text-faint">
            Active filters:
          </span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-accent-strong transition-all hover:bg-accent/25 active:scale-95"
            >
              <span>{chip.label}</span>
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent/40 text-accent-contrast">
                <CloseIcon className="h-2 w-2" />
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-[11px] font-medium text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {hint}
    </div>
  );
}

export function DiscoverSortSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <span className="hidden text-faint sm:inline">Sort by:</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Sort results"
        className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-semibold text-fg focus:border-accent focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DiscoverResultsBar({
  loading,
  loadingLabel,
  visibleCount,
  totalCount,
  emptyLabel = null,
  sort = null,
  viewMode,
  onViewModeChange,
}: {
  loading: boolean;
  loadingLabel: string;
  visibleCount: number;
  totalCount: number | null;
  emptyLabel?: ReactNode;
  sort?: ReactNode;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
      <div className="flex items-center gap-2">
        <p aria-live="polite" className="text-xs font-semibold text-muted">
          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-accent-strong">
              <span className="radar-live-dot h-2 w-2 rounded-full bg-accent-strong" />
              {loadingLabel}
            </span>
          ) : emptyLabel ? (
            <span className="text-faint">{emptyLabel}</span>
          ) : totalCount != null ? (
            <span>
              Showing <span className="font-bold text-fg">{visibleCount}</span>{" "}
              of{" "}
              <span className="font-bold text-fg">
                {totalCount.toLocaleString("en-US")}
              </span>{" "}
              results
            </span>
          ) : (
            <span>{visibleCount} results</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {sort}

        <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            aria-label="Poster grid view"
            title="Poster grid view"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              viewMode === "grid"
                ? "bg-accent font-bold text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            <GridIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            aria-label="Detailed list view"
            title="Detailed list view"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              viewMode === "list"
                ? "bg-accent font-bold text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            <ListIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
