import type { Metadata } from "next";
import Link from "next/link";

import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { ScheduleBrowser } from "@/features/schedule/schedule-browser";
import { ScreenScheduleBrowser } from "@/features/schedule/screen-schedule";
import { getViewer } from "@/lib/auth";
import {
  getWeekRange,
  groupScheduleByDay,
  groupScreenScheduleByDay,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { getCatalogService } from "@/services/catalog/catalog-service";
import {
  TmdbNotConfiguredError,
  TmdbRateLimitError,
} from "@/services/tmdb/errors";
import { getScreenWeekSchedule } from "@/services/tmdb/service";
import type { AiringScheduleEntry } from "@/types/anime";
import type { ScreenScheduleEntry, TmdbKind } from "@/types/tmdb";

export const metadata: Metadata = {
  title: "Weekly schedule",
  description:
    "Anime broadcasts, film releases and TV airings for the current week.",
};

type ScheduleKind = "anime" | TmdbKind;

interface SchedulePageProps {
  searchParams: Promise<{ date?: string; type?: string }>;
}

const SCHEDULE_TABS: ReadonlyArray<{ value: ScheduleKind; label: string }> = [
  { value: "anime", label: "Anime" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
];

function ScheduleTypeTabs({
  current,
  date,
}: {
  current: ScheduleKind;
  date?: string;
}) {
  return (
    <nav
      aria-label="Schedule type"
      className="inline-flex border border-border bg-surface/40 p-0.5"
    >
      {SCHEDULE_TABS.map((tab) => {
        const params = new URLSearchParams();
        if (tab.value !== "anime") params.set("type", tab.value);
        if (date) params.set("date", date);
        const query = params.toString();
        const active = current === tab.value;

        return (
          <Link
            key={tab.value}
            href={query ? `/schedule?${query}` : "/schedule"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center border-r border-border last:border-r-0 px-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
              active
                ? "bg-accent text-accent-contrast"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  const { date, type } = await searchParams;
  const scheduleType: ScheduleKind =
    type === "movie" || type === "tv" ? type : "anime";
  const week = getWeekRange(date);
  const viewer = await getViewer();
  const tabs = <ScheduleTypeTabs current={scheduleType} date={date} />;

  if (scheduleType !== "anime") {
    let screenEntries: ScreenScheduleEntry[] = [];
    let screenError: string | null = null;

    try {
      const weekDates = week.days.map((day) => day.date);
      screenEntries = await getScreenWeekSchedule(scheduleType, {
        from: weekDates[0] ?? "",
        to: weekDates[weekDates.length - 1] ?? "",
        days: weekDates,
      });
    } catch (error) {
      console.error(
        "[schedule] could not load the screen schedule:",
        error instanceof Error ? error.message : "unknown error",
      );
      screenError =
        error instanceof TmdbNotConfiguredError
          ? error.message
          : error instanceof TmdbRateLimitError
            ? error.message
            : "TMDB's release calendar could not be reached. Your library and watch history are unaffected — try again in a moment.";
    }

    return (
      <div className="space-y-7 sm:space-y-8">
        {tabs}
        {screenError ? (
          <div className="py-6">
            <ErrorState
              title="Release calendar is temporarily unavailable"
              message={screenError}
              action={<RetryButton />}
            />
          </div>
        ) : (
          <ScreenScheduleBrowser
            kind={scheduleType}
            week={week}
            days={groupScreenScheduleByDay(screenEntries, week.days)}
            initialDate={date}
          />
        )}
      </div>
    );
  }

  // Only the ids are needed here, so skip episode rows and metadata
  // hydration entirely instead of loading the whole library again.
  let watchingIds: number[] = [];
  if (viewer) {
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const entries = await createLibraryRepository(supabase).list(
          viewer.id,
        );
        watchingIds = entries
          .filter((entry) => entry.status === "watching")
          .map((entry) => entry.anilistId);
      }
    } catch (err) {
      console.error(
        "[schedule] could not load user watching list:",
        err instanceof Error ? err.message : "unknown error",
      );
    }
  }

  let entries: AiringScheduleEntry[] = [];
  let loadError = false;

  try {
    entries = (
      await getCatalogService().getAiringSchedule({
        airingAtGreater: week.queryAiringAtGreater,
        airingAtLesser: week.queryAiringAtLesser,
      })
    ).data;
  } catch (error) {
    console.error(
      "[schedule] could not load airing schedule:",
      error instanceof Error ? error.message : "unknown error",
    );
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        {tabs}
        <div className="py-6">
          <ErrorState
            title="Weekly schedule is temporarily unavailable"
            message="The AniList schedule could not be reached. Your library, ratings and episode progress are unaffected — try again in a moment."
            action={<RetryButton />}
          />
        </div>
      </div>
    );
  }

  const days = groupScheduleByDay(entries, week.days);

  return (
    <div className="space-y-7 sm:space-y-8">
      {tabs}
      <ScheduleBrowser
        week={week}
        days={days}
        entries={entries}
        watchingIds={watchingIds}
        initialDate={date}
        initialNow={week.generatedAtMs}
      />
    </div>
  );
}
