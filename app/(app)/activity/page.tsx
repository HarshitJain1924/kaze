import { redirect } from "next/navigation";

import { ActivityLog } from "@/features/activity/activity-log";
import { loadLibraryItems } from "@/features/library/load-library";
import { buildActivityEvents } from "@/lib/activity";
import { getViewer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { createSupabaseTmdbStore } from "@/repositories/tmdb-library";
import type { WatchedEpisode } from "@/types/library";
import type { TmdbLibraryEntry, TmdbWatchedEpisode } from "@/types/tmdb";

export const metadata = {
  title: "Activity · Kaze",
  description: "Everything you have watched, read and finished, newest first.",
};

export default async function ActivityPage() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(`/login?next=${encodeURIComponent("/activity")}`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <ActivityLog events={[]} />;
  }

  const libraryRepository = createLibraryRepository(supabase);
  const screenStore = createSupabaseTmdbStore(supabase);

  const [libraryItems, animeEpisodes, screenEntries, screenEpisodes] =
    await Promise.all([
      loadLibraryItems(viewer.id).catch(() => []),
      libraryRepository.listEpisodes(viewer.id).catch(() => [] as WatchedEpisode[]),
      screenStore.list(viewer.id).catch(() => [] as TmdbLibraryEntry[]),
      screenStore.listEpisodes(viewer.id).catch(() => [] as TmdbWatchedEpisode[]),
    ]);

  const events = buildActivityEvents({
    libraryItems,
    animeEpisodes,
    screenEntries,
    screenEpisodes,
  });

  return <ActivityLog events={events} />;
}
