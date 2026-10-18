import { AnimePosterCard } from "@/components/anime-poster-card";
import { cn } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

export function AnimeGrid({
  items,
  metaMode = "overlay",
  priorityCount = 0,
  showQuickAdd = true,
  className,
}: {
  items: AnimeSummary[];
  metaMode?: "overlay" | "below";
  priorityCount?: number;
  showQuickAdd?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6",
        className,
      )}
    >
      {items.map((anime, index) => (
        <AnimePosterCard
          key={anime.id}
          anime={anime}
          metaMode={metaMode}
          priority={index < priorityCount}
          showQuickAdd={showQuickAdd}
        />
      ))}
    </div>
  );
}
