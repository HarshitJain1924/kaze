import type { Metadata } from "next";

import { LandingBentoGrid } from "@/features/landing/landing-bento-grid";
import { LandingComparison } from "@/features/landing/landing-comparison";
import { LandingCta } from "@/features/landing/landing-cta";
import { LandingFooter } from "@/features/landing/landing-footer";
import { LandingHero } from "@/features/landing/landing-hero";
import { LandingMarqueeStrip } from "@/features/landing/landing-marquee-strip";
import { LandingNavbar } from "@/features/landing/landing-navbar";
import { LandingSeasonalShowcase } from "@/features/landing/landing-seasonal-showcase";
import { getViewer } from "@/lib/auth";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AnimeSummary } from "@/types/anime";

export const metadata: Metadata = {
  title: "Kaze · Personal Anime Sanctuary",
  description:
    "A quieter, cinematic way to track your anime journey. One-tap progress, live Tokyo simulcast radar, and encrypted taste telemetry.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getCatalogService();

  let seasonalItems: AnimeSummary[] = [];

  try {
    const seasonalResult = await client.getSeasonalAnime(season, year, {
      perPage: 12,
    });
    seasonalItems = seasonalResult.data.items ?? [];
  } catch (error) {
    console.error(
      "[landing] could not load seasonal anime preview:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  return (
    <div className="min-h-dvh bg-[#07080e] text-fg selection:bg-accent selection:text-white">
      {/* 1. Floating Capsule Glass Navigation Header */}
      <LandingNavbar viewer={viewer} />

      {/* 2. Cinematic Hero Section with Interactive 3D Mockup */}
      <LandingHero viewer={viewer} />

      {/* 3. Dual-Track Infinite Auto-scrolling Poster Marquee */}
      <LandingMarqueeStrip />

      {/* 4. The 4 Core Architectural Pillars Bento Grid */}
      <LandingBentoGrid />

      {/* 5. The Anime Purist Difference (Comparison Matrix) */}
      <LandingComparison />

      {/* 6. Live Seasonal Catalog Showcase */}
      {seasonalItems.length > 0 ? (
        <LandingSeasonalShowcase
          items={seasonalItems}
          seasonLabel={seasonLabel(season)}
          year={year}
        />
      ) : null}

      {/* 7. Grand Sanctuary Call to Action */}
      <LandingCta viewer={viewer} />

      {/* 8. Cinematic Footer */}
      <LandingFooter />
    </div>
  );
}

