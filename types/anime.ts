export const ANIME_FORMATS = [
  "TV",
  "TV_SHORT",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
] as const;

export type AnimeFormat = (typeof ANIME_FORMATS)[number];

export const ANIME_SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

export type AnimeSeason = (typeof ANIME_SEASONS)[number];

export const ANIME_RELEASE_STATUSES = [
  "FINISHED",
  "RELEASING",
  "NOT_YET_RELEASED",
  "CANCELLED",
  "HIATUS",
] as const;

export type AnimeReleaseStatus = (typeof ANIME_RELEASE_STATUSES)[number];

export interface AnimeTitles {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AnimeCoverImage {
  extraLarge: string | null;
  large: string | null;
  color: string | null;
}

export interface AnimeDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AnimeSummary {
  id: number;
  title: AnimeTitles;
  coverImage: AnimeCoverImage;
  format: AnimeFormat | null;
  episodes: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  status: AnimeReleaseStatus | null;
  genres: string[];
}

export interface RelatedAnime extends AnimeSummary {
  relationType: string | null;
}

export interface Anime extends AnimeSummary {
  bannerImage: string | null;
  synopsis: string | null;
  genres: string[];
  tags: string[];
  season: AnimeSeason | null;
  duration: number | null;
  popularity: number | null;
  startDate: AnimeDate | null;
  endDate: AnimeDate | null;
  relations: RelatedAnime[];
}

export interface AnimePage {
  items: AnimeSummary[];
  pageInfo: {
    currentPage: number;
    lastPage: number | null;
    hasNextPage: boolean;
    total: number | null;
  };
}

export type AnimeSort =
  | "POPULARITY_DESC"
  | "SCORE_DESC"
  | "TRENDING_DESC"
  | "START_DATE_DESC"
  | "TITLE_ROMAJI";

export interface AnimeSearchParams {
  query?: string;
  genre?: string;
  format?: AnimeFormat;
  season?: AnimeSeason;
  seasonYear?: number;
  sort?: AnimeSort;
  page?: number;
  perPage?: number;
}
