import type { Anime } from "@/types/anime";
import {
  FORMAT_LABELS,
  RELEASE_STATUS_LABELS,
  formatAnimeDate,
  formatChapterCount,
  formatCountry,
  formatEpisodeCount,
  formatFormat,
  formatMediaKind,
  formatPopularity,
  formatScore,
  formatVolumeCount,
  getDisplayTitle,
  getSecondaryTitle,
} from "@/lib/utils";
import { seasonLabel } from "@/lib/season";
import type {
  MediaDetailBadge,
  MediaDetailFact,
  MediaDetailMetric,
  MediaDetailView,
} from "@/lib/media/detail-view/types";

function statusTone(
  status: Anime["status"],
): MediaDetailBadge["tone"] {
  if (status === "RELEASING") return "success";
  if (status === "NOT_YET_RELEASED") return "warning";
  return "neutral";
}

/**
 * Adapts the existing AniList/Kitsu-normalized Anime model into the shared
 * presentation contract. Kitsu enrichment is already folded into `Anime` by
 * the catalog service, so this adapter covers both providers' anime/manga UI.
 */
export function adaptAniListDetailView(anime: Anime): MediaDetailView {
  const manga = anime.mediaType === "manga";
  const title = getDisplayTitle(anime.title, true);
  const secondaryTitle = getSecondaryTitle(anime.title, title);
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const startDate = formatAnimeDate(anime.startDate);
  const endDate = formatAnimeDate(anime.endDate);
  const country = formatCountry(anime.countryOfOrigin);
  const season =
    anime.season && anime.seasonYear
      ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
      : anime.seasonYear
        ? String(anime.seasonYear)
        : null;
  const formatLabel = manga
    ? formatMediaKind(anime)
    : (formatFormat(anime.format) ?? formatMediaKind(anime));
  const score = formatScore(anime.averageScore);
  const popularity = formatPopularity(anime.popularity);

  const badges: MediaDetailBadge[] = [];
  if (anime.status) {
    badges.push({
      label: RELEASE_STATUS_LABELS[anime.status] ?? anime.status,
      tone: statusTone(anime.status),
    });
  }
  badges.push({ label: formatMediaKind(anime), tone: "accent" });
  if (anime.isAdult) badges.push({ label: "18+", tone: "danger" });

  const metaLine = [
    season,
    country && country !== "Japan" ? country : null,
    anime.format && (!manga || anime.format === "ONE_SHOT")
      ? FORMAT_LABELS[anime.format]
      : null,
    anime.studios?.[0]?.name ?? null,
    manga
      ? formatChapterCount(anime.chapters)
      : formatEpisodeCount(anime.episodes, { short: true }),
    manga && anime.volumes ? formatVolumeCount(anime.volumes) : null,
  ].filter((value): value is string => Boolean(value));

  const metrics: MediaDetailMetric[] = [];
  if (score) {
    metrics.push({
      label: "Community",
      value: score,
      subvalue: "/ 10",
      star: true,
    });
  }
  if (popularity) {
    metrics.push({ label: "Popularity", value: popularity });
  }
  if (anime.duration) {
    metrics.push({ label: "Length", value: `${anime.duration} min` });
  }
  if (anime.genres.length > 0) {
    metrics.push({
      label: "Genres",
      value: anime.genres.slice(0, 3).join(" · "),
    });
  }

  const facts: MediaDetailFact[] = [
    {
      label: manga ? "Medium" : "Format",
      value: manga ? formatMediaKind(anime) : (formatFormat(anime.format) ?? "Unknown"),
    },
  ];

  if (manga) {
    facts.push(
      { label: "Chapters", value: anime.chapters?.toString() ?? "Unknown" },
      { label: "Volumes", value: anime.volumes?.toString() ?? "Unknown" },
    );
  } else {
    facts.push(
      { label: "Episodes", value: anime.episodes?.toString() ?? "Unknown" },
      {
        label: "Season",
        value:
          anime.season && anime.seasonYear
            ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
            : (anime.seasonYear?.toString() ?? "Unknown"),
      },
    );
  }

  facts.push({
    label: manga ? "Published" : "Aired",
    value: startDate
      ? endDate && endDate !== startDate
        ? `${startDate} – ${endDate}`
        : startDate
      : "Unknown",
  });
  facts.push({
    label: "Release status",
    value: anime.status
      ? anime.status.replaceAll("_", " ").toLowerCase()
      : "Unknown",
  });

  if (!manga) {
    facts.push({
      label: "Episode length",
      value: anime.duration ? `${anime.duration} min` : "Unknown",
    });
  }
  if (anime.studios && anime.studios.length > 0) {
    facts.push({
      label: "Studio",
      value: anime.studios.map((studio) => studio.name).join(", "),
    });
  }

  const prequel =
    anime.relations.find((relation) => relation.relationType === "PREQUEL") ??
    null;
  const sequel =
    anime.relations.find((relation) => relation.relationType === "SEQUEL") ??
    null;
  const heroLinks =
    prequel || sequel
      ? {
          label: "Franchise",
          ...(prequel
            ? {
                previous: {
                  title: getDisplayTitle(prequel.title, true),
                  href: `/media/${prequel.id}`,
                },
              }
            : {}),
          ...(sequel
            ? {
                next: {
                  title: getDisplayTitle(sequel.title, true),
                  href: `/media/${sequel.id}`,
                },
              }
            : {}),
        }
      : null;

  return {
    key: `anilist:${manga ? "manga" : "anime"}:${anime.id}`,
    kind: manga ? "manga" : "anime",
    provider: "anilist",
    title,
    secondaryTitle,
    tagline: null,
    synopsis: anime.synopsis,
    posterUrl: cover,
    backdropUrl: anime.bannerImage,
    accentColor: anime.coverImage.color,
    isAdult: Boolean(anime.isAdult),
    badges,
    metaLine,
    metrics,
    facts,
    genres: anime.genres.map((genre) => ({
      name: genre,
      href: `/discover?type=${manga ? "manga" : "anime"}&genre=${encodeURIComponent(genre)}`,
    })),
    tags: anime.tags,
    trailer:
      anime.trailer?.id && anime.trailer.site?.toLowerCase() === "youtube"
        ? {
            id: anime.trailer.id,
            site: anime.trailer.site,
            title,
            thumbnailUrl: anime.trailer.thumbnail,
          }
        : null,
    heroLinks,
    mediaLabel: formatLabel,
    backHref: "/discover",
    backLabel: "Discover",
    breadcrumbLabel: title,
    sourceUrl: `https://anilist.co/${manga ? "manga" : "anime"}/${anime.id}`,
    sourceLabel: "AniList page",
    attribution:
      "Metadata and community scores come from AniList. Personal ratings are on a 1–10 scale and remain private to your account.",
  };
}
