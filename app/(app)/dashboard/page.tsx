import { ReadingShelf } from "@/features/home/reading-shelf";
import { TrendingIndex } from "@/features/home/trending-index";
import { HomeHero } from "@/features/home/home-hero";
import { HomeSchedule } from "@/features/home/home-schedule";
import { HomeSearch } from "@/features/home/home-search";
import { HomeStatsStrip } from "@/features/home/home-stats-strip";
import { SeasonalCarousel } from "@/features/home/seasonal-carousel";
import { ContinueWatching } from "@/features/library/continue-watching";
import { RecentlyUpdated } from "@/features/library/recently-updated";
import { getViewer } from "@/lib/auth";
import {
  curateReadingTable,
  deduplicateSeasonal,
  deduplicateTrending,
  selectSpotlightCandidates,
} from "@/lib/discovery";
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

  const [seasonal, popular, trending, mangaTrending, scheduleEntries] =
    await Promise.all([
      safeLoad("seasonal anime", () =>
        client.getSeasonalAnime(season, year, { perPage: 18 }),
      ),
      safeLoad("popular anime", () => client.getPopularAnime({ perPage: 12 })),
      safeLoad("trending anime", () =>
        client.getTrendingAnime({ perPage: 18 }),
      ),
      safeLoad("trending manga", () =>
        client.getTrendingManga({ perPage: 18 }),
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
  const mangaItems = mangaTrending?.items ?? [];

  // Candidate pool of top popular, trending and seasonal anime for quick-tracking.
  const quickAddPool = [
    ...popularItems,
    ...trendingItems,
    ...seasonalItems,
  ].reduce<AnimeSummary[]>((acc, item) => {
    if (!acc.some((x) => x.id === item.id)) acc.push(item);
    return acc;
  }, []);

  // 1. Curate spotlight candidates for the Seasonal Feature hero with cinematic banners & genre diversity
  const heroSpotlightPosters = selectSpotlightCandidates(
    seasonalItems,
    trendingItems,
    popularItems,
    { currentYear: year },
  );

  const primaryHeroId = heroSpotlightPosters[0]?.id;

  // 2. Deduplicate seasonal catalogue so it opens with distinct highlights rather than repeating hero as #1
  const curatedSeasonalItems = deduplicateSeasonal(seasonalItems, primaryHeroId);

  // 3. Deduplicate trending ranked list so the #1 hero is not redundantly repeated
  const curatedTrendingItems = deduplicateTrending(trendingItems, primaryHeroId, 6);

  // 4. Curate the reading table with balanced representation of Manga & Manhwa
  const curatedReadingItems = curateReadingTable(mangaItems, 6);

  const todayIso = toIsoDateString(now);
  const todayEntries = (scheduleEntries ?? []).filter(
    (entry) => toIsoDateString(new Date(entry.airingAt * 1000)) === todayIso,
  );

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const seasonLabelText = `${seasonLabel(season)} ${year}`;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Top Header Region: Personal Archive & Quick Search */}
      <div className="space-y-3.5 sm:space-y-4">
        {/* A. Compact personal introduction and real library ledger */}
        <HomeStatsStrip
          todayEntries={scheduleEntries}
          todayLabel={todayLabel}
          seasonLabelText={seasonLabelText}
        />

        {/* B. Utility band: search and discovery shortcuts */}
        <HomeSearch
          popularAnime={quickAddPool}
          popularManga={mangaTrending?.items ?? []}
        />
      </div>

      {/* C. The visual anchor: personal in-progress activity */}
      {viewer ? <ContinueWatching todayEntries={scheduleEntries} /> : null}

      {/* D. Personal activity paired with the broadcast week */}
      <div
        className={
          viewer
            ? "grid gap-10 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]"
            : undefined
        }
      >
        {viewer ? <RecentlyUpdated /> : null}
        <HomeSchedule
          compact={viewer !== null}
          week={currentWeek}
          initialEntries={scheduleEntries}
          initialNow={currentWeek.generatedAtMs}
        />
      </div>

      {/* E. Discovery journal, deliberately secondary to the personal archive */}
      <section aria-labelledby="discovery-heading" className="space-y-8">
        <header className="border-t border-border pt-5">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Discovery
          </p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2
              id="discovery-heading"
              className="font-display text-[26px] font-semibold tracking-[-0.04em] text-fg sm:text-[32px]"
            >
              Beyond your shelf
            </h2>
            <p className="text-[11px] text-muted">
              The season, the conversation, and the reading table.
            </p>
          </div>
        </header>

        <HomeHero
          viewer={viewer}
          season={season}
          year={year}
          posters={heroSpotlightPosters}
          todayCount={todayEntries.length}
          todayLabel={todayLabel}
          todayEntries={scheduleEntries}
          serverHour={now.getHours()}
        />

        <SeasonalCarousel
          title={`${seasonLabelText} anime`}
          description="This season's most popular series, specials and films."
          actionHref={`/discover?${seasonQuery}`}
          items={curatedSeasonalItems.length > 0 ? curatedSeasonalItems : (seasonal?.items ?? null)}
          error={seasonal === null}
        />

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <TrendingIndex items={curatedTrendingItems} />
          <ReadingShelf items={curatedReadingItems} />
        </div>
      </section>
    </div>
  );
}
