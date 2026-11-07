import type { Metadata } from "next";

import {
  calculateScreenStats,
  type ScreenLibraryStats,
} from "@/features/stats/calculate-screen-stats";
import { StatsView } from "@/features/stats/stats-view";
import { requireViewer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseTmdbStore } from "@/repositories/tmdb-library";

export const metadata: Metadata = {
  title: "Statistics",
  description: "Your personal anime, manga, film and TV statistics.",
};

export default async function StatsPage() {
  const viewer = await requireViewer("/stats");

  // Films and TV are not part of the AniList client library, so their totals are
  // resolved here and handed to the view as plain numbers.
  let screenStats: ScreenLibraryStats | null = null;
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const store = createSupabaseTmdbStore(supabase);
      const [entries, episodes] = await Promise.all([
        store.list(viewer.id),
        store.listEpisodes(viewer.id),
      ]);
      screenStats = calculateScreenStats(entries, episodes);
    } catch (error) {
      console.error(
        "[stats] could not load film and TV library:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  return <StatsView screenStats={screenStats} />;
}
