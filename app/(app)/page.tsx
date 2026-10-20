import Link from "next/link";

import { SparkIcon } from "@/components/icons";
import { ContinueWatching } from "@/features/library/continue-watching";
import { AnimeSection } from "@/features/home/anime-section";
import { HomeHero } from "@/features/home/home-hero";
import { HomeSchedule } from "@/features/home/home-schedule";
import { HomeSidebar } from "@/features/home/home-sidebar";
import { getViewer } from "@/lib/auth";
import { formatAiringTime, getWeekRange, toIsoDateString } from "@/lib/schedule";
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
): Promise<AiringScheduleEntry[] | null> {
  try {
    return await load();
  } catch (error) {
    console.error("[home] could not load airing schedule", error);
    return null;
  }
}

/** Six titles fill two rows of the six-column grid and never leave an orphan. */
const RAIL_SIZE = 6;

export default async function HomePage() {
  const viewer = await getViewer();
  const { season, year } = getCurrentSeason();
  const client = getAniListClient();
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
  const featuredAnime = seasonalItems[0] ?? null;

  // The dashboard's finding: how much airs today and when the next one is.
  const todayIso = toIsoDateString(now);
  const todayEntries = (scheduleEntries ?? []).filter(
    (entry) => toIsoDateString(new Date(entry.airingAt * 1000)) === todayIso,
  );
  const nextAiring = todayEntries.find(
    (entry) => entry.airingAt * 1000 > now.getTime(),
  );
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const summary =
    scheduleEntries === null
      ? "The broadcast schedule is unavailable right now. Your library and progress are unaffected."
      : todayEntries.length === 0
        ? "No episodes are scheduled to air today."
        : `${todayEntries.length} ${
            todayEntries.length === 1 ? "episode airs" : "episodes air"
          } today${nextAiring ? `, next at ${formatAiringTime(nextAiring.airingAt)}` : ""}.`;

  return (
    <div className="space-y-7 sm:space-y-9">
      <HomeHero
        viewer={viewer}
        season={season}
        year={year}
        posters={seasonalItems}
        summary={summary}
        todayLabel={todayLabel}
      />

      <div
        className={
          viewer
            ? "grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_352px]"
            : "grid grid-cols-1"
        }
      >
        <div className="min-w-0 space-y-8 sm:space-y-9">
          {viewer ? <ContinueWatching /> : null}

          <HomeSchedule week={currentWeek} initialEntries={scheduleEntries} />

          {/* Secondary widgets sit below the daily loop on narrow screens. */}
          {viewer ? (
            <div className="lg:hidden">
              <HomeSidebar
                todayEntries={scheduleEntries}
                featuredAnime={featuredAnime}
                compact
              />
            </div>
          ) : null}

          <AnimeSection
            title={`${seasonLabel(season)} ${year} anime`}
            description="This season's most popular series, specials and films."
            actionHref={`/discover?${seasonQuery}`}
            items={seasonal?.items.slice(0, RAIL_SIZE) ?? null}
            error={seasonal === null}
            priorityCount={3}
          />

          <AnimeSection
            title="Popular on AniList"
            description="The titles the community is watching most."
            actionHref="/discover?sort=POPULARITY_DESC"
            items={popular?.items.slice(0, RAIL_SIZE) ?? null}
            error={popular === null}
          />

          <AnimeSection
            title="Trending this week"
            description="What is picking up momentum right now."
            actionHref="/discover?sort=TRENDING_DESC"
            items={trending?.items.slice(0, RAIL_SIZE) ?? null}
            error={trending === null}
          />
        </div>

        {/* The rail is built from the viewer's library, so a signed-out visit
            gets one full-width column instead of a mostly empty one. */}
        {viewer ? (
          <div className="hidden min-w-0 lg:block">
            <HomeSidebar
              todayEntries={scheduleEntries}
              featuredAnime={featuredAnime}
            />
          </div>
        ) : null}
      </div>

      {!viewer ? (
        <section className="rounded-xl border border-border-subtle bg-surface p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-fg">
                Keep the list in one place.
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                Create an account to log episodes, rate series and keep your
                library in sync across every device.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
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
