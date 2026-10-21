import type { Metadata } from "next";

import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { ScheduleBrowser } from "@/features/schedule/schedule-browser";
import { loadLibraryItems } from "@/features/library/load-library";
import { getViewer } from "@/lib/auth";
import { getWeekRange, groupScheduleByDay } from "@/lib/schedule";
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

  // Load viewer's watching titles if authenticated
  let watchingIds: number[] = [];
  if (viewer) {
    try {
      const items = await loadLibraryItems(viewer.id);
      watchingIds = items
        .filter((item) => item.entry.status === "watching")
        .map((item) => item.entry.anilistId);
    } catch (err) {
      console.error("[schedule] could not load user watching list", err);
    }
  }

  let entries: AiringScheduleEntry[] = [];
  let loadError = false;

  try {
    entries = await getCatalogService().getAiringSchedule({
      airingAtGreater: week.queryAiringAtGreater,
      airingAtLesser: week.queryAiringAtLesser,
    });
  } catch (error) {
    console.error("[schedule] could not load airing schedule", error);
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="py-6">
        <ErrorState
          title="Could not load weekly schedule"
          message="AniList schedule service could not be reached. Please check your connection and try again."
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
      watchingIds={watchingIds}
      initialDate={date}
    />
  );
}
