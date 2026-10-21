import { AnimeSection } from "@/features/home/anime-section";
import { HomeHero } from "@/features/home/home-hero";
import { HomeSchedule } from "@/features/home/home-schedule";
import { HomeSearch } from "@/features/home/home-search";
import { HomeSidebar } from "@/features/home/home-sidebar";
import { SeasonalCarousel } from "@/features/home/seasonal-carousel";
import { ContinueWatching } from "@/features/library/continue-watching";
import { getViewer } from "@/lib/auth";
import { getWeekRange, toIsoDateString } from "@/lib/schedule";
import { getCurrentSeason, seasonLabel } from "@/lib/season";
import {
  getCatalogService,
  type CatalogResult,
} from "@/services/catalog/catalog-service";
import type { AiringScheduleEntry, AnimePage } from "@/types/anime";

async function safeLoad(
  label: string,
  load: () => Promise<CatalogResult<AnimePage>>,
): Promise<AnimePage | null> {
  try {
    return (await load()).data;
  } catch (error) {
    console.error(
      `[home] could not load ${label}:`,
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
      "[home] could not load airing schedule:",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export default async function HomePage() {
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

  // Airing count for today
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
      {/* 1. Cinematic Hero Banner */}
      <HomeHero
        viewer={viewer}
        season={season}
        year={year}
        posters={seasonalItems}
        todayCount={todayEntries.length}
        todayLabel={todayLabel}
        serverHour={now.getHours()}
      />

      {/* 2. Main Dashboard Layout: Main column + Right sidebar */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_318px] xl:grid-cols-[minmax(0,1fr)_348px]">
        {/* Main Column */}
        <div className="min-w-0 space-y-6 sm:space-y-7">
          {/* Inline anime search & quick-add panel */}
          <HomeSearch
            popularAnime={
              popularItems.length >= 4 ? popularItems.slice(0, 4) : seasonalItems.slice(0, 4)
            }
          />

          {/* Continue Watching - large landscape cards centerpiece */}
          {viewer ? <ContinueWatching /> : null}

          {/* Airing this week schedule */}
          <HomeSchedule week={currentWeek} initialEntries={scheduleEntries} />

          {/* Mobile / Tablet: Sidebar panels stack underneath */}
          <div className="lg:hidden">
            <HomeSidebar todayEntries={scheduleEntries} compact />
          </div>

          {/* Seasonal anime row with horizontal browsing */}
          <SeasonalCarousel
            title={`${seasonLabel(season)} ${year} anime`}
            description="This season's most popular series, specials and films."
            actionHref={`/discover?${seasonQuery}`}
            items={seasonal?.items ?? null}
            error={seasonal === null}
          />

          {/* Secondary rails if available */}
          {trending?.items && trending.items.length > 0 ? (
            <AnimeSection
              title="Trending this week"
              description="What is picking up momentum right now."
              actionHref="/discover?sort=TRENDING_DESC"
              items={trending.items.slice(0, 6)}
              error={trending === null}
            />
          ) : null}
        </div>

        {/* Right Sidebar Rail on Desktop */}
        <div className="hidden min-w-0 lg:block">
          <HomeSidebar todayEntries={scheduleEntries} />
        </div>
      </div>
    </div>
  );
}
