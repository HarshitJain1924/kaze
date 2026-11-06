import { formatIsoDate } from "@/lib/utils";
import type { TmdbDetails } from "@/types/tmdb";
import type {
  MediaDetailBadge,
  MediaDetailFact,
  MediaDetailHeroLinks,
  MediaDetailMetric,
  MediaDetailView,
} from "@/lib/media/detail-view/types";

function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

function collectionLinks(details: TmdbDetails): MediaDetailHeroLinks | null {
  const parts = details.collection?.parts ?? [];
  if (parts.length === 0) return null;

  const index = parts.findIndex((part) => part.tmdbId === details.tmdbId);
  if (index < 0) return null;

  const previous = parts[index - 1];
  const next = parts[index + 1];
  if (!previous && !next) return null;

  return {
    label: details.collection?.name ?? "Collection",
    ...(previous
      ? {
          previous: {
            title: previous.title,
            href: `/screen/movie/${previous.tmdbId}`,
          },
        }
      : {}),
    ...(next
      ? {
          next: {
            title: next.title,
            href: `/screen/movie/${next.tmdbId}`,
          },
        }
      : {}),
  };
}

/** Adapts a TMDB movie or TV detail payload into the shared view contract. */
export function adaptTmdbDetailView(details: TmdbDetails): MediaDetailView {
  const isTv = details.kind === "tv";
  const title = details.title;
  const runtime = formatRuntime(
    isTv ? (details.episodeRuntime[0] ?? null) : details.runtime,
  );
  const releaseDate = formatIsoDate(details.releaseDate);
  const rating =
    details.voteAverage !== null && details.voteAverage > 0
      ? details.voteAverage.toFixed(1)
      : null;

  const badges: MediaDetailBadge[] = [
    { label: isTv ? "Television" : "Film", tone: "accent" },
  ];
  if (details.status) {
    badges.push({ label: details.status, tone: "neutral" });
  }
  if (details.adult) {
    badges.push({ label: "18+", tone: "danger" });
  }

  const metaLine = [
    details.year ? String(details.year) : null,
    runtime,
    isTv && details.numberOfSeasons
      ? `${details.numberOfSeasons} ${details.numberOfSeasons === 1 ? "season" : "seasons"}`
      : null,
    isTv && details.numberOfEpisodes
      ? `${details.numberOfEpisodes} episodes`
      : null,
  ].filter((value): value is string => Boolean(value));

  const metrics: MediaDetailMetric[] = [];
  if (rating) {
    metrics.push({
      label: "TMDB",
      value: rating,
      subvalue: details.voteCount
        ? `(${details.voteCount.toLocaleString()})`
        : "/ 10",
      star: true,
    });
  }
  if (details.genres.length > 0) {
    metrics.push({
      label: "Genres",
      value: details.genres.slice(0, 3).join(" · "),
    });
  }

  const facts: MediaDetailFact[] = [];
  if (details.originalTitle && details.originalTitle !== title) {
    facts.push({ label: "Original title", value: details.originalTitle });
  }
  facts.push({
    label: "Release date",
    value: releaseDate ?? details.releaseDate ?? "Unknown",
  });
  facts.push({
    label: "Status",
    value: details.status ?? "Unknown",
  });
  facts.push({
    label: isTv ? "Episode length" : "Runtime",
    value: runtime ?? "Unknown",
  });
  if (isTv) {
    facts.push(
      {
        label: "Seasons",
        value: details.numberOfSeasons?.toString() ?? "Unknown",
      },
      {
        label: "Episodes",
        value: details.numberOfEpisodes?.toString() ?? "Unknown",
      },
    );
  }
  const companies = isTv ? details.networks : details.productionCompanies;
  if (companies.length > 0) {
    facts.push({
      label: isTv ? "Network" : "Production",
      value: companies.join(", "),
    });
  }
  facts.push({ label: "TMDB id", value: String(details.tmdbId) });

  return {
    key: `tmdb:${details.kind}:${details.tmdbId}`,
    kind: details.kind,
    provider: "tmdb",
    title,
    secondaryTitle:
      details.originalTitle && details.originalTitle !== title
        ? details.originalTitle
        : null,
    tagline: details.tagline,
    synopsis: details.overview,
    posterUrl: details.posterUrl,
    backdropUrl: details.backdropUrl,
    accentColor: null,
    isAdult: details.adult,
    badges,
    metaLine,
    metrics,
    facts,
    genres: details.genres.map((genre) => ({ name: genre })),
    tags: [],
    trailer: details.trailer
      ? {
          id: details.trailer.key,
          site:
            details.trailer.site.toLowerCase() === "youtube"
              ? "youtube"
              : details.trailer.site,
          title: details.trailer.name,
          thumbnailUrl: null,
        }
      : null,
    heroLinks: collectionLinks(details),
    mediaLabel: isTv ? "TV" : "Film",
    backHref: "/screen",
    backLabel: "Films & TV",
    breadcrumbLabel: title,
    sourceUrl: `https://www.themoviedb.org/${details.kind}/${details.tmdbId}`,
    sourceLabel: "TMDB page",
    attribution:
      "Metadata and community scores come from TMDB. Personal ratings and notes remain private to your account.",
  };
}
