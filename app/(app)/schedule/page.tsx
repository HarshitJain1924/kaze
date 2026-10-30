import type { Metadata } from "next";

import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { ScheduleBrowser } from "@/features/schedule/schedule-browser";
import { getViewer } from "@/lib/auth";
import { getWeekRange, groupScheduleByDay } from "@/lib/schedule";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AiringScheduleEntry } from "@/types/anime";

export const metadata: Metadata = {
  title: "Weekly Anime Schedule",
  description:
    "Follow upcoming anime broadcasts and new episode releases for the week.",
};

interface SchedulePageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  const { date } = await searchParams;
  const week = getWeekRange(date);
  const viewer = await getViewer();

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
      <div className="py-6">
        <ErrorState
          title="Weekly schedule is temporarily unavailable"
          message="The AniList schedule could not be reached. Your library, ratings and episode progress are unaffected — try again in a moment."
          action={<RetryButton />}
        />
      </div>
    );
  }

  const days = groupScheduleByDay(entries, week.days);

  return (
    <ScheduleBrowser
      week={week}
      days={days}
      entries={entries}
      watchingIds={watchingIds}
      initialDate={date}
      initialNow={week.generatedAtMs}
    />
  );
}
