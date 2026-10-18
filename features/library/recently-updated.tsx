"use client";

import { AnimeGrid } from "@/components/anime-grid";
import { SectionHeader } from "@/components/section-header";
import { useLibrary } from "@/features/library/library-provider";

export function RecentlyUpdated() {
  const { items } = useLibrary();

  const recent = items
    .filter((item) => item.anime !== null)
    .sort(
      (a, b) =>
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime(),
    )
    .slice(0, 6);

  if (recent.length === 0) {
    return null;
  }

  return (
    <section aria-label="Recently updated">
      <SectionHeader
        title="Recently updated"
        description="The latest changes across your library."
        action="My library"
        actionHref="/library"
      />
      <AnimeGrid
        items={recent.flatMap((item) => (item.anime ? [item.anime] : []))}
        showQuickAdd={false}
      />
    </section>
  );
}
