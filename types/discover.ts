export const DISCOVER_VIEWS = [
  "anime",
  "manga",
  "manhwa",
  "movie",
  "tv",
] as const;

export type DiscoverView = (typeof DISCOVER_VIEWS)[number];

export function isTmdbDiscoverView(
  view: DiscoverView,
): view is "movie" | "tv" {
  return view === "movie" || view === "tv";
}