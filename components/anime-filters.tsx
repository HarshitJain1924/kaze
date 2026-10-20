"use client";

import { useMemo, useState } from "react";

import { SlidersIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { seasonLabel } from "@/lib/season";
import { cn } from "@/lib/utils";
import { ANIME_FORMATS, ANIME_SEASONS } from "@/types/anime";
import type {
  AnimeFormat,
  AnimeSeason,
  AnimeSort,
} from "@/types/anime";

export const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const;

export const SORT_OPTIONS: Array<{ value: AnimeSort; label: string }> = [
  { value: "POPULARITY_DESC", label: "Most popular" },
  { value: "SCORE_DESC", label: "Highest rated" },
  { value: "TRENDING_DESC", label: "Trending now" },
  { value: "START_DATE_DESC", label: "Newest releases" },
  { value: "TITLE_ROMAJI", label: "Title A–Z" },
];

const FORMAT_LABELS: Record<AnimeFormat, string> = {
  TV: "TV series",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  MUSIC: "Music",
};

export interface AnimeFilterState {
  genre?: string;
  format?: AnimeFormat;
  season?: AnimeSeason;
  year?: number;
  sort: AnimeSort;
}

function FilterFields({
  value,
  onChange,
  idPrefix,
}: {
  value: AnimeFilterState;
  onChange: (patch: Partial<AnimeFilterState>) => void;
  idPrefix: string;
}) {
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current + 1 - 1989 }, (_, index) => current + 1 - index);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-genre`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Genre
        </label>
        <Select
          id={`${idPrefix}-genre`}
          aria-label="Filter by genre"
          value={value.genre ?? ""}
          onChange={(event) =>
            onChange({ genre: event.target.value || undefined })
          }
        >
          <option value="">All genres</option>
          {ANIME_GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-format`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Format
        </label>
        <Select
          id={`${idPrefix}-format`}
          aria-label="Filter by format"
          value={value.format ?? ""}
          onChange={(event) =>
            onChange({
              format: (event.target.value || undefined) as
                | AnimeFormat
                | undefined,
            })
          }
        >
          <option value="">All formats</option>
          {ANIME_FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_LABELS[format]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-season`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Season
        </label>
        <Select
          id={`${idPrefix}-season`}
          aria-label="Filter by season"
          value={value.season ?? ""}
          onChange={(event) =>
            onChange({
              season: (event.target.value || undefined) as
                | AnimeSeason
                | undefined,
            })
          }
        >
          <option value="">Any season</option>
          {ANIME_SEASONS.map((season) => (
            <option key={season} value={season}>
              {seasonLabel(season)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-year`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Year
        </label>
        <Select
          id={`${idPrefix}-year`}
          aria-label="Filter by year"
          value={value.year ? String(value.year) : ""}
          onChange={(event) =>
            onChange({
              year: event.target.value
                ? Number.parseInt(event.target.value, 10)
                : undefined,
            })
          }
        >
          <option value="">Any year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-sort`}
          className="text-xs font-medium text-muted lg:sr-only"
        >
          Sort
        </label>
        <Select
          id={`${idPrefix}-sort`}
          aria-label="Sort results"
          value={value.sort}
          onChange={(event) =>
            onChange({ sort: event.target.value as AnimeSort })
          }
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export function AnimeFilters({
  value,
  onChange,
  onClear,
  disabled = false,
  className,
}: {
  value: AnimeFilterState;
  onChange: (patch: Partial<AnimeFilterState>) => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount =
    (value.genre ? 1 : 0) +
    (value.format ? 1 : 0) +
    (value.season ? 1 : 0) +
    (value.year ? 1 : 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="hidden lg:block">
        <FilterFields
          value={value}
          onChange={onChange}
          idPrefix="desktop-filters"
        />
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          disabled={disabled}
          className="h-11 flex-1 justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersIcon className="h-4 w-4" />
            Filters
          </span>
          {activeCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-contrast">
              {activeCount}
            </span>
          ) : (
            <span className="text-xs text-faint">None</span>
          )}
        </Button>

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            onClick={onClear}
            disabled={disabled}
            className="h-11"
          >
            Clear
          </Button>
        ) : null}
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter anime"
        description="Refine by genre, format, season and release year."
        mobileSheet
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                onClear();
                setSheetOpen(false);
              }}
            >
              Reset all
            </Button>
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show results
            </Button>
          </>
        }
      >
        <FilterFields
          value={value}
          onChange={onChange}
          idPrefix="sheet-filters"
        />
      </Dialog>
    </div>
  );
}
