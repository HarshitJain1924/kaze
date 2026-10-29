import { AnimeSection } from "@/features/home/anime-section";
import { HomeHero } from "@/features/home/home-hero";
import { HomeSchedule } from "@/features/home/home-schedule";
import { HomeSearch } from "@/features/home/home-search";
import { HomeStatsStrip } from "@/features/home/home-stats-strip";
import { SeasonalCarousel } from "@/features/home/seasonal-carousel";
import { ContinueWatching } from "@/features/library/continue-watching";
import { getViewer } from "@/lib/auth";
import { getWeekRange, toIsoDateString } from "@/lib/schedule";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import {
  getCatalogService,
  type CatalogResult,
} from "@/services/catalog/catalog-service";
import type { AiringScheduleEntry, AnimePage, AnimeSummary } from "@/types/anime";

async function safeLoad(
  label: string,
  load: () => Promise<CatalogResult<AnimePage>>,
): Promise<AnimePage | null> {
  try {
    return (await load()).data;
  } catch (error) {
    console.error(
      `[dashboard] could not load ${label}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

async function safeLoadSchedule(
  load: () => Promise<CatalogResult<AiringScheduleEntry[]>>,
): Promise<AiringScheduleEntry[] | null> {
  try {
    return (await load()).data;
  } catch (error) {
    console.error(
      "[dashboard] could not load airing schedule:",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export default async function DashboardPage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getCatalogService();
  const now = new Date();
  const currentWeek = getWeekRange(now);

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
  const popularItems = popular?.items ?? [];
  const trendingItems = trending?.items ?? [];

  // Candidate pool of top popular, trending and seasonal anime for quick-tracking
  const quickAddPool = [
    ...popularItems,
    ...trendingItems,
    ...seasonalItems,
  ].reduce<AnimeSummary[]>((acc, item) => {
    if (!acc.some((x) => x.id === item.id)) {
      acc.push(item);
    }
    return acc;
  }, []);

  const heroCandidates = [
    ...seasonalItems,
    ...trendingItems,
    ...popularItems,
  ].reduce<AnimeSummary[]>((acc, item) => {
    if (!acc.some((x) => x.id === item.id)) {
      acc.push(item);
    }
    return acc;
  }, []);

  const bannerPriority = [
    ...heroCandidates.filter((item) => Boolean(item.bannerImage)),
    ...heroCandidates.filter((item) => !item.bannerImage),
  ];

  const blackCloverIndex = bannerPriority.findIndex(
    (item) =>
      item.id === 195604 ||
      item.title.english?.toLowerCase().includes("black clover"),
  );
  if (blackCloverIndex > 0) {
    const [blackClover] = bannerPriority.splice(blackCloverIndex, 1);
    if (blackClover) {
      bannerPriority.unshift(blackClover);
    }
  }

  const heroSpotlightPosters = bannerPriority.slice(0, 5);

  const todayIso = toIsoDateString(now);
  const todayEntries = (scheduleEntries ?? []).filter(
    (entry) => toIsoDateString(new Date(entry.airingAt * 1000)) === todayIso,
  );

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Cinematic Hero Spotlight Banner */}
      <HomeHero
        viewer={viewer}
        season={season}
        year={year}
        posters={heroSpotlightPosters}
        todayCount={todayEntries.length}
        todayLabel={todayLabel}
        serverHour={now.getHours()}
      />

      {/* 2. Main Dashboard Stream */}
      <div className="space-y-6 sm:space-y-7">
        <HomeSearch popularAnime={quickAddPool} />

        {viewer ? (
          <HomeStatsStrip todayEntries={scheduleEntries} />
        ) : null}

        {viewer ? (
          <ContinueWatching todayEntries={scheduleEntries} />
        ) : null}

        <HomeSchedule week={currentWeek} initialEntries={scheduleEntries} />

        <SeasonalCarousel
          title={`${seasonLabel(season)} ${year} anime`}
          description="This season's most popular series, specials and films."
          actionHref={`/discover?${seasonQuery}`}
          items={seasonal?.items ?? null}
          error={seasonal === null}
        />

        {trending?.items && trending.items.length > 0 ? (
          <AnimeSection
            title="Trending this week"
            description="What is picking up momentum right now across the community."
            actionHref="/discover?sort=TRENDING_DESC"
            items={trending.items.slice(0, 6)}
            error={trending === null}
          />
        ) : null}
      </div>
    </div>
  );
}

