import Link from "next/link";

import { SparkIcon } from "@/components/icons";
import { ContinueWatching } from "@/features/library/continue-watching";
import { LibrarySnapshot } from "@/features/library/library-snapshot";
import { RecentlyUpdated } from "@/features/library/recently-updated";
import { AnimeSection } from "@/features/home/anime-section";
import { HomeHero } from "@/features/home/home-hero";
import { getViewer } from "@/lib/auth";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import { getAniListClient } from "@/services/anilist/client";
import type { AnimePage } from "@/types/anime";

async function safeLoad(
  label: string,
  load: () => Promise<AnimePage>,
): Promise<AnimePage | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`[home] could not load ${label}`, error);
    return null;
  }
}

export default async function HomePage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getAniListClient();

  const [seasonal, popular, trending] = await Promise.all([
    safeLoad("seasonal anime", () =>
      client.getSeasonalAnime(season, year, { perPage: 12 }),
    ),
    safeLoad("popular anime", () =>
      client.getPopularAnime({ perPage: 12 }),
    ),
    safeLoad("trending anime", () =>
      client.getTrendingAnime({ perPage: 12 }),
    ),
  ]);

  const seasonQuery = `season=${season}&year=${year}`;
  const seasonalItems = seasonal?.items ?? [];

  return (
    <div className="space-y-10 sm:space-y-12">
      <HomeHero
        viewer={viewer}
        season={season}
        year={year}
        posters={seasonalItems}
      />

      {viewer ? (
        <>
          <ContinueWatching />
          <LibrarySnapshot />
          <RecentlyUpdated />
        </>
      ) : null}

      <AnimeSection
        title={`${seasonLabel(season)} ${year} anime`}
        description="This season's most popular series, specials and films."
        actionHref={`/discover?${seasonQuery}`}
        items={seasonal?.items ?? null}
        error={seasonal === null}
      />

      <AnimeSection
        title="Popular on AniList"
        description="The titles the community is watching most."
        actionHref="/discover?sort=POPULARITY_DESC"
        items={popular?.items ?? null}
        error={popular === null}
      />

      <AnimeSection
        title="Trending this week"
        description="What is picking up momentum right now."
        actionHref="/discover?sort=TRENDING_DESC"
        items={trending?.items ?? null}
        error={trending === null}
      />

      {!viewer ? (
        <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(80%_140%_at_100%_0%,var(--accent-soft),transparent_60%)]"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-fg">
                Your watchlist, everywhere.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
                Create an account to track episodes, rate series and keep your
                library in sync across every device.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              <SparkIcon className="h-4 w-4" />
              Create account
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
