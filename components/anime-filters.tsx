"use client";

import { useMemo } from "react";

import { Select } from "@/components/ui/field";
import { seasonLabel } from "@/lib/season";
import { cn } from "@/lib/utils";
import {
  ANIME_ADULT_FILTERS,
  ANIME_COUNTRIES,
  ANIME_FORMATS,
  ANIME_RELEASE_STATUSES,
  ANIME_SEASONS,
  ANIME_SOURCES,
  MANGA_FORMATS,
} from "@/types/anime";
import type {
  AnimeAdultFilter,
  AnimeCountry,
  AnimeFormat,
  AnimeReleaseStatus,
  AnimeSeason,
  AnimeSort,
  AnimeSource,
  MediaFormat,
  MediaType,
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
  "Hentai",
] as const;

export const SORT_OPTIONS: Array<{ value: AnimeSort; label: string }> = [
  { value: "POPULARITY_DESC", label: "Most popular" },
  { value: "SCORE_DESC", label: "Highest rated" },
  { value: "TRENDING_DESC", label: "Trending now" },
  { value: "FAVOURITES_DESC", label: "Most favourited" },
  { value: "START_DATE_DESC", label: "Newest releases" },
  { value: "START_DATE", label: "Oldest releases" },
  { value: "TITLE_ROMAJI", label: "Title A–Z" },
  { value: "TITLE_ROMAJI_DESC", label: "Title Z–A" },
];

const FORMAT_LABELS: Record<MediaFormat, string> = {
  TV: "TV series",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  MUSIC: "Music",
  MANGA: "Manga",
  ONE_SHOT: "One-shot",
  NOVEL: "Novel",
};

export const STATUS_LABELS: Record<AnimeReleaseStatus, string> = {
  RELEASING: "Airing now",
  FINISHED: "Finished",
  NOT_YET_RELEASED: "Upcoming",
  HIATUS: "On hiatus",
  CANCELLED: "Cancelled",
};

export const SOURCE_LABELS: Record<AnimeSource, string> = {
  ORIGINAL: "Original",
  MANGA: "Manga",
  LIGHT_NOVEL: "Light novel",
  VISUAL_NOVEL: "Visual novel",
  VIDEO_GAME: "Video game",
  NOVEL: "Novel",
  DOUJINSHI: "Doujinshi",
  OTHER: "Other",
};

export const COUNTRY_LABELS: Record<AnimeCountry, string> = {
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  TW: "Taiwan",
};

export const ADULT_LABELS: Record<AnimeAdultFilter, string> = {
  filtered: "Hide adult",
  include: "Include adult",
  only: "Only adult",
};

export interface AnimeFilterState {
  mediaType?: MediaType;
  genre?: string;
  format?: AnimeFormat;
  status?: AnimeReleaseStatus;
  season?: AnimeSeason;
  year?: number;
  source?: AnimeSource;
  countryOfOrigin?: AnimeCountry;
  adultContent?: AnimeAdultFilter;
  sort: AnimeSort;
}

function FilterFields({
  value,
  onChange,
  idPrefix,
  adultAllowed,
}: {
  value: AnimeFilterState;
  onChange: (patch: Partial<AnimeFilterState>) => void;
  idPrefix: string;
  adultAllowed: boolean;
}) {
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current + 1 - 1989 }, (_, index) => current + 1 - index);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-genre`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Genre
        </label>
        <Select
          id={`${idPrefix}-genre`}
          aria-label="Filter by genre"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
          value={value.genre ?? ""}
          onChange={(event) => {
            const genre = event.target.value || undefined;
            // Hentai is 18+ only, so requesting it without adult titles would
            // always return an empty page.
            if (genre === "Hentai" && !value.adultContent) {
              onChange({ genre, adultContent: "only" });
              return;
            }
            onChange({ genre });
          }}
        >
          <option value="">All genres</option>
          {ANIME_GENRES.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-format`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Format
        </label>
        <Select
          id={`${idPrefix}-format`}
          aria-label="Filter by format"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
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
          {(value.mediaType === "manga" ? MANGA_FORMATS : ANIME_FORMATS).map(
            (format) => (
              <option key={format} value={format}>
                {FORMAT_LABELS[format]}
              </option>
            ),
          )}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-status`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Status
        </label>
        <Select
          id={`${idPrefix}-status`}
          aria-label="Filter by release status"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
          value={value.status ?? ""}
          onChange={(event) =>
            onChange({
              status: (event.target.value || undefined) as
                | AnimeReleaseStatus
                | undefined,
            })
          }
        >
          <option value="">Any status</option>
          {ANIME_RELEASE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-season`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Season
        </label>
        <Select
          id={`${idPrefix}-season`}
          aria-label="Filter by season"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
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

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-year`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Year
        </label>
        <Select
          id={`${idPrefix}-year`}
          aria-label="Filter by year"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
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

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-source`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Source
        </label>
        <Select
          id={`${idPrefix}-source`}
          aria-label="Filter by source material"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
          value={value.source ?? ""}
          onChange={(event) =>
            onChange({
              source: (event.target.value || undefined) as
                | AnimeSource
                | undefined,
            })
          }
        >
          <option value="">Any source</option>
          {ANIME_SOURCES.map((source) => (
            <option key={source} value={source}>
              {SOURCE_LABELS[source]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-country`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Country
        </label>
        <Select
          id={`${idPrefix}-country`}
          aria-label="Filter by country of origin"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
          value={value.countryOfOrigin ?? ""}
          onChange={(event) =>
            onChange({
              countryOfOrigin: (event.target.value || undefined) as
                | AnimeCountry
                | undefined,
            })
          }
        >
          <option value="">Any country</option>
          {ANIME_COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {COUNTRY_LABELS[country]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-adult`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Adult content
        </label>
        <Select
          id={`${idPrefix}-adult`}
          aria-label="Filter by adult content"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
          value={
            value.adultContent === "filtered" ? "" : (value.adultContent ?? "")
          }
          onChange={(event) =>
            onChange({
              adultContent: (event.target.value || undefined) as
                | AnimeAdultFilter
                | undefined,
            })
          }
          disabled={!adultAllowed}
        >
          <option value="">Hide adult</option>
          {ANIME_ADULT_FILTERS.filter((option) => option !== "filtered").map(
            (option) => (
              <option key={option} value={option}>
                {ADULT_LABELS[option]}
              </option>
            ),
          )}
        </Select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-sort`}
          className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-faint"
        >
          Sort
        </label>
        <Select
          id={`${idPrefix}-sort`}
          aria-label="Sort results"
          className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
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
  className,
  adultAllowed = false,
}: {
  value: AnimeFilterState;
  onChange: (patch: Partial<AnimeFilterState>) => void;
  onClear?: () => void;
  disabled?: boolean;
  className?: string;
  adultAllowed?: boolean;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <FilterFields
        value={value}
        onChange={onChange}
        idPrefix="desktop-filters"
        adultAllowed={adultAllowed}
      />
    </div>
  );
}
