import type { ReactNode } from "react";

/** The four kinds the shared detail experience can render. */
export type MediaDetailKind = "anime" | "manga" | "movie" | "tv";

export type MediaDetailProvider = "anilist" | "tmdb";

export type MediaDetailBadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export interface MediaDetailBadge {
  label: string;
  tone?: MediaDetailBadgeTone;
}

export interface MediaDetailMetric {
  label: string;
  value: string;
  subvalue?: string | null;
  star?: boolean;
}

export interface MediaDetailFact {
  label: string;
  value: string;
}

export interface MediaDetailGenre {
  name: string;
  href?: string;
}

export interface MediaDetailTrailer {
  id: string;
  site: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface MediaDetailHeroLink {
  title: string;
  href: string;
}

export interface MediaDetailHeroLinks {
  label: string;
  previous?: MediaDetailHeroLink;
  next?: MediaDetailHeroLink;
}

/**
 * Provider-neutral presentation data. Adapters own all provider-specific
 * decisions so layout components never branch on AniList or TMDB.
 */
export interface MediaDetailView {
  key: string;
  kind: MediaDetailKind;
  provider: MediaDetailProvider;
  title: string;
  secondaryTitle: string | null;
  tagline: string | null;
  synopsis: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  accentColor: string | null;
  isAdult: boolean;
  badges: MediaDetailBadge[];
  metaLine: string[];
  metrics: MediaDetailMetric[];
  facts: MediaDetailFact[];
  genres: MediaDetailGenre[];
  tags: string[];
  trailer: MediaDetailTrailer | null;
  heroLinks: MediaDetailHeroLinks | null;
  mediaLabel: string;
  backHref: string;
  backLabel: string;
  breadcrumbLabel: string;
  sourceUrl: string;
  sourceLabel: string;
  attribution: string;
}

/**
 * A tab or overview block. `tab: false` keeps supporting content inside the
 * overview/all views without adding a dedicated tab.
 */
export interface MediaDetailSection {
  id: string;
  label: string;
  content: ReactNode;
  count?: number | null;
  tab?: boolean;
  overview?: boolean;
}
