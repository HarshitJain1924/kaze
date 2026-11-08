"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";

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
import { OpticalGlass } from "@/components/ui/optical-glass";
import { cn, isHttpUrl } from "@/lib/utils";

const subscribeToPlatform = () => () => {};
const readIsMac = () =>
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");

export interface DiscoverSpotlight {
  href: string;
  posterUrl: string | null;
  score: string | null;
  title: string;
  meta: string;
  ctaLabel: string;
}

/**
 * The editorial Discover masthead. Both catalogue sources render this so the
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
  const banner = bannerUrl && isHttpUrl(bannerUrl) ? bannerUrl : null;
  const artwork =
    banner ?? (backdropUrl && isHttpUrl(backdropUrl) ? backdropUrl : null);

  return (
    <header className="border-b border-border pb-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
          {eyebrow}
        </p>
        <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
          {headlineMeta}
        </p>
      </div>

      <div className="mt-4 grid gap-7 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h1 className="text-balance font-display text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.9] tracking-[-0.05em] text-fg">
            {title}
          </h1>
          <p className="mt-4 max-w-[36rem] text-[13px] leading-relaxed text-muted sm:text-sm">
            {description}
          </p>
        </div>

        <div className="lg:col-span-5">
          <div className="relative aspect-[16/10] overflow-hidden border border-border bg-surface-2">
            {artwork ? (
              <Image
                src={artwork}
                alt=""
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 40vw"
                className={cn(
                  "object-cover transition-transform duration-700 ease-out",
                  banner ? "object-[center_28%]" : "object-center",
                )}
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,var(--surface-3)_0%,var(--surface-2)_70%)]"
              />
            )}

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
            />

            {spotlight?.score ? (
              <OpticalGlass
                variant="pill"
                interactive={false}
                className="absolute right-2.5 top-2.5 flex items-center gap-1 px-2 py-1 text-[9px] font-semibold tabular-nums text-white/90"
              >
                <StarIcon className="h-2.5 w-2.5 fill-current text-amber-300" />
                {spotlight.score}
              </OpticalGlass>
            ) : null}

            {spotlight ? (
              <OpticalGlass
                variant="card"
                className="absolute inset-x-2 bottom-2 flex items-center gap-2.5 p-2 sm:inset-x-2.5 sm:bottom-2.5 sm:gap-3 sm:p-2.5"
              >
                <Link
                  href={spotlight.href}
                  className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden border border-white/20 sm:w-12"
                >
                  {spotlight.posterUrl && isHttpUrl(spotlight.posterUrl) ? (
                    <Image
                      src={spotlight.posterUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-white/10" />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                    Top result
                  </p>
                  <Link
                    href={spotlight.href}
                    className="mt-0.5 block truncate font-display text-[13px] font-semibold leading-tight text-white transition-colors hover:text-accent-strong"
                    title={spotlight.title}
                  >
                    {spotlight.title}
                  </Link>
                  <p className="mt-0.5 truncate text-[10px] text-white/65">
                    {spotlight.meta}
                  </p>
                </div>

                <Link
                  href={spotlight.href}
                  aria-label={spotlight.ctaLabel}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/25 text-white/85 transition-colors hover:border-accent hover:text-accent-strong"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>
              </OpticalGlass>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export interface DiscoverTypeTab {
  id: string;
  label: string;
}

/** One ruled segmented bar for every catalogue source. */
export function DiscoverTypeTabs({
  tabs,
  active,
  onSelect,
  ariaLabel = "Catalogue type",
}: {
  tabs: DiscoverTypeTab[];
  active: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="no-scrollbar flex w-full overflow-x-auto border border-border bg-surface/40"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "relative h-10 shrink-0 border-r border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors last:border-r-0 sm:h-11 sm:px-5",
              isActive
                ? "bg-accent text-accent-contrast"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
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
    <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto border-y border-border px-4 py-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {pills.map((pill) => {
        const Icon = pill.icon;
        return (
          <button
            key={pill.id}
            type="button"
            onClick={pill.onSelect}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
              pill.active
                ? "border-accent bg-accent text-accent-contrast"
                : "border-border text-muted hover:border-accent/60 hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon
              className={cn(
                "h-3 w-3 shrink-0",
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
  const inputRef = useRef<HTMLInputElement>(null);
  // Platform-dependent text is read through useSyncExternalStore so the server
  // render and the hydrated client agree instead of mismatching.
  const isMac = useSyncExternalStore(
    subscribeToPlatform,
    readIsMac,
    () => false,
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="space-y-3 border border-border bg-surface/70 p-3 backdrop-blur-md sm:p-4">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
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
            className="h-11 w-full border border-border bg-bg/60 pl-10 pr-20 text-[13px] text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:appearance-none"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {busy ? (
              <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
            ) : null}
            {searchValue ? (
              <button
                type="button"
                onClick={onClearSearch}
                aria-label="Clear search"
                className="flex h-7 w-7 items-center justify-center text-faint transition-colors hover:text-fg"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="hidden border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint sm:inline-flex">
                {isMac ? "⌘K" : "Ctrl K"}
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
              "inline-flex h-11 items-center gap-2 border px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
              filtersOpen || filterCount > 0
                ? "border-accent bg-accent/10 text-accent-strong"
                : "border-border text-muted hover:border-accent/60 hover:text-fg",
            )}
          >
            <SlidersIcon className="h-3.5 w-3.5" />
            <span>Filters</span>
            {filterCount > 0 ? (
              <span className="flex h-4 min-w-4 items-center justify-center bg-accent px-1 font-mono text-[9px] font-bold text-accent-contrast tabular-nums">
                {filterCount}
              </span>
            ) : null}
          </button>

          {showReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-11 items-center border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-accent/60 hover:text-fg"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="border-t border-border pt-3">{children}</div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
            Active
          </span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 border border-accent/40 bg-accent/10 py-1 pl-2 pr-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-accent-strong transition-colors hover:bg-accent/20"
            >
              <span className="normal-case tracking-normal">{chip.label}</span>
              <CloseIcon className="h-2.5 w-2.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-[10px] font-medium uppercase tracking-[0.08em] text-faint underline-offset-2 transition-colors hover:text-fg hover:underline"
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
    <div className="flex items-center gap-1.5">
      <span className="hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-faint sm:inline">
        Sort
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Sort results"
        className="h-8 border border-border bg-surface px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg focus:border-accent focus:outline-none"
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5">
      <p
        aria-live="polite"
        className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-accent-strong">
            <span className="radar-live-dot h-1.5 w-1.5 rounded-full bg-accent-strong" />
            {loadingLabel}
          </span>
        ) : emptyLabel ? (
          <span>{emptyLabel}</span>
        ) : totalCount != null ? (
          <span>
            Showing{" "}
            <span className="font-semibold text-fg tabular-nums">
              {visibleCount}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-fg tabular-nums">
              {totalCount.toLocaleString("en-US")}
            </span>{" "}
            results
          </span>
        ) : (
          <span>
            <span className="font-semibold text-fg tabular-nums">
              {visibleCount}
            </span>{" "}
            results
          </span>
        )}
      </p>

      <div className="flex items-center gap-2.5">
        {sort}

        <div className="inline-flex items-center border border-border">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            aria-label="Poster grid view"
            title="Poster grid view"
            className={cn(
              "flex h-7 w-7 items-center justify-center transition-colors",
              viewMode === "grid"
                ? "bg-accent text-accent-contrast"
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
              "flex h-7 w-7 items-center justify-center border-l border-border transition-colors",
              viewMode === "list"
                ? "bg-accent text-accent-contrast"
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
