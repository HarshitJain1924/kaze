import Link from "next/link";

import { SparkIcon } from "@/components/icons";
import { ContinueWatching } from "@/features/library/continue-watching";
import { AnimeSection } from "@/features/home/anime-section";
import { HomeHero } from "@/features/home/home-hero";
import { HomeSchedule } from "@/features/home/home-schedule";
import { HomeSidebar } from "@/features/home/home-sidebar";
import { getViewer } from "@/lib/auth";
import { getWeekRange } from "@/lib/schedule";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import { getAniListClient } from "@/services/anilist/client";
import type { AiringScheduleEntry, AnimePage } from "@/types/anime";

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

async function safeLoadSchedule(
  load: () => Promise<AiringScheduleEntry[]>,
): Promise<AiringScheduleEntry[]> {
  try {
    return await load();
  } catch (error) {
    console.error("[home] could not load airing schedule", error);
    return [];
  }
}

export default async function HomePage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getAniListClient();
  const currentWeek = getWeekRange(new Date());

  const [seasonal, popular, trending, scheduleEntries] = await Promise.all([
    safeLoad("seasonal anime", () =>
      client.getSeasonalAnime(season, year, { perPage: 12 }),
    ),
    safeLoad("popular anime", () =>
      client.getPopularAnime({ perPage: 12 }),
    ),
    safeLoad("trending anime", () =>
      client.getTrendingAnime({ perPage: 12 }),
    ),
    safeLoadSchedule(() =>
      client.getAiringSchedule({
        airingAtGreater: currentWeek.queryAiringAtGreater,
        airingAtLesser: currentWeek.queryAiringAtLesser,
      }),
    ),
  ]);

  const seasonQuery = `season=${season}&year=${year}`;
  const seasonalItems = seasonal?.items ?? [];
  const featuredAnime = seasonalItems[0] ?? null;

  return (
    <div className="space-y-8 sm:space-y-10">
      <HomeHero
        viewer={viewer}
        season={season}
        year={year}
        posters={seasonalItems}
      />

      {/* Main 2-column layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main Column */}
        <div className="min-w-0 space-y-8 sm:space-y-10">
          {viewer ? <ContinueWatching /> : null}

          <HomeSchedule
            week={currentWeek}
            initialEntries={scheduleEntries}
          />

          {/* Secondary widgets placed below primary workflows on mobile/tablet */}
          <div className="lg:hidden">
            <HomeSidebar
              todayEntries={scheduleEntries}
              featuredAnime={featuredAnime}
            />
          </div>

          <AnimeSection
            title={`${seasonLabel(season)} ${year} anime`}
            description="This season's most popular series, specials and films."
            actionHref={`/discover?${seasonQuery}`}
            items={seasonal?.items ?? null}
            error={seasonal === null}
            priorityCount={4}
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
        </div>

        {/* Right Sidebar on Desktop */}
        <div className="hidden min-w-0 lg:block">
          <HomeSidebar
            todayEntries={scheduleEntries}
            featuredAnime={featuredAnime}
          />
        </div>
      </div>

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
