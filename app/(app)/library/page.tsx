import type { Metadata } from "next";

import type { LibraryStatusFilter } from "@/components/library-toolbar";
import { LibraryBrowser } from "@/features/library/library-browser";
import { requireViewer } from "@/lib/auth";
import { getCurrentSeason } from "@/lib/season";
import { getCatalogService } from "@/services/catalog/catalog-service";
import { isWatchStatus } from "@/types/library";
import type { AnimeSummary } from "@/types/anime";

export const metadata: Metadata = {
  title: "My library",
  description: "Your personal anime watchlist, progress, ratings and notes.",
};

function parseStatus(value: string | string[] | undefined): LibraryStatusFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isWatchStatus(candidate) ? candidate : "all";
}

/** A starting point for the first run, when the library has nothing to show. */
async function loadSeasonPicks(): Promise<AnimeSummary[]> {
  try {
    const { season, year } = getCurrentSeason();
    const page = await getCatalogService().getSeasonalAnime(season, year, {
      perPage: 4,
    });
    return page.items;
  } catch (error) {
    console.error(
      "[library] could not load seasonal suggestions:",
      error instanceof Error ? error.message : "unknown error",
    );
    return [];
  }
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireViewer("/library");
  const params = await searchParams;
  const initialStatus = parseStatus(params.status);
  const suggestions = await loadSeasonPicks();

  return (
    <LibraryBrowser
      key={initialStatus}
      initialStatus={initialStatus}
      suggestions={suggestions}
    />
  );
}
