"use client";

import { LoaderIcon, SearchIcon, CloseIcon } from "@/components/icons";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function AnimeSearch({
  value,
  onChange,
  loading = false,
  placeholder = "Search anime by title…",
  className,
  label = "Search anime",
}: {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          inputClass,
          "h-11 pl-10 pr-20 [&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading ? (
          <LoaderIcon className="h-4 w-4 animate-spin text-accent-strong" />
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
