import type { Metadata } from "next";

import { LandingCta } from "@/features/landing/landing-cta";
import { LandingFooter } from "@/features/landing/landing-footer";
import { LandingFormatShowcase } from "@/features/landing/landing-format-showcase";
import { LandingHero } from "@/features/landing/landing-hero";
import { LandingNavbar } from "@/features/landing/landing-navbar";
import { LandingProductStory } from "@/features/landing/landing-product-story";
import { LandingScreenIndex } from "@/features/landing/landing-screen-index";
import { LandingSeasonalIndex } from "@/features/landing/landing-seasonal-index";
import { splitMangaByOrigin } from "@/features/landing/landing-media";
import { getViewer } from "@/lib/auth";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import { getCatalogService } from "@/services/catalog/catalog-service";
import { discoverTmdb } from "@/services/tmdb/service";
import type { AnimeSummary } from "@/types/anime";

export const metadata: Metadata = {
  title: "Kaze — A private index for anime, manga, manhwa, films & TV",
  description:
    "Keep anime, manga, manhwa, films and television in one quiet, private library. Track episodes, chapters and watches, follow the airing week, and understand your taste without ads or noise.",
  openGraph: {
    title: "Kaze — A private index for anime, manga, manhwa, films & TV",
    description:
      "One private library for anime, manga, manhwa, films and TV. Episode and chapter tracking, a film and series shelf, a live airing calendar, and statistics built from your own history.",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getCatalogService();

  const [seasonalResult, mangaResult, manhwaResult, screenResult] =
    await Promise.allSettled([
      client.getSeasonalAnime(season, year, { perPage: 12 }),
      client.searchMedia({
        mediaType: "manga",
        countryOfOrigin: "JP",
        sort: "TRENDING_DESC",
        perPage: 8,
      }),
      client.searchMedia({
        mediaType: "manga",
        countryOfOrigin: "KR",
        sort: "TRENDING_DESC",
        perPage: 8,
      }),
      discoverTmdb("movie", "trending", 1),
    ]);

  const seasonalItems =
    seasonalResult.status === "fulfilled"
      ? (seasonalResult.value.data.items ?? [])
      : [];

  const japaneseManga =
    mangaResult.status === "fulfilled" ? (mangaResult.value.data.items ?? []) : [];
  const koreanManhwa =
    manhwaResult.status === "fulfilled"
      ? (manhwaResult.value.data.items ?? [])
      : [];

  if (seasonalResult.status === "rejected") {
    console.error(
      "[landing] could not load seasonal anime preview:",
      seasonalResult.reason instanceof Error
        ? seasonalResult.reason.message
        : "unknown error",
    );
  }
  if (mangaResult.status === "rejected") {
    console.error(
      "[landing] could not load manga preview:",
      mangaResult.reason instanceof Error
        ? mangaResult.reason.message
        : "unknown error",
    );
  }
  if (manhwaResult.status === "rejected") {
    console.error(
      "[landing] could not load manhwa preview:",
      manhwaResult.reason instanceof Error
        ? manhwaResult.reason.message
        : "unknown error",
    );
  }

  const { manga: mangaItems } = splitMangaByOrigin(japaneseManga);
  const { manhwa: manhwaItems } = splitMangaByOrigin(koreanManhwa);

  // Films and TV are a separate catalogue; a TMDB outage must not take the
  // page down, so the section simply renders without artwork.
  const screenItems =
    screenResult.status === "fulfilled"
      ? screenResult.value.results
          .filter((item) => item.posterUrl)
          .slice(0, 4)
      : [];

  if (screenResult.status === "rejected") {
    console.error(
      "[landing] could not load film and TV preview:",
      screenResult.reason instanceof Error
        ? screenResult.reason.message
        : "unknown error",
    );
  }

  // Keep the hero and seasonal index from repeating the same lead artwork.
  const formatAnime =
    seasonalItems[5] ?? seasonalItems[2] ?? seasonalItems[0] ?? null;
  const previewItems = [
    seasonalItems[6] ?? seasonalItems[3] ?? seasonalItems[0],
    mangaItems[0],
    manhwaItems[0],
  ].filter((item): item is AnimeSummary => Boolean(item));

  return (
    <div className="landing-shell min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-[var(--landing-rule)] focus:bg-[var(--landing-paper)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--landing-ink)]"
      >
        Skip to content
      </a>

      <LandingNavbar viewer={viewer} />

      <main id="main">
        <LandingHero
          viewer={viewer}
          featured={seasonalItems.slice(0, 5)}
          season={seasonLabel(season)}
          year={year}
        />

        <LandingSeasonalIndex
          items={seasonalItems.slice(1)}
          season={season}
          seasonLabel={seasonLabel(season)}
          year={year}
        />

        <LandingFormatShowcase
          anime={formatAnime}
          manga={mangaItems}
          manhwa={manhwaItems}
        />

        <LandingScreenIndex items={screenItems} />

        <LandingProductStory viewer={viewer} items={previewItems} />

        <LandingCta viewer={viewer} />
      </main>

      <LandingFooter viewer={viewer} />
    </div>
  );
}
