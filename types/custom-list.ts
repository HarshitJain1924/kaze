import type { MediaType } from "@/types/anime";

export interface CustomListItem {
  id: string;
  anilistId: number;
  title: string;
  mediaType?: MediaType;
  coverImage: string | null;
  bannerImage?: string | null;
  format?: string | null;
  averageScore?: number | null;
  rank?: number;
  notes?: string;
  addedAt: string;
}

export interface CustomList {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  items: CustomListItem[];
}

export interface ListProgress {
  watchedCount: number;
  totalCount: number;
  percentage: number;
  isFullyWatched: boolean;
}

