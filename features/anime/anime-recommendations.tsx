import { AnimePosterCard } from "@/components/anime-poster-card";
import { SparklesIcon } from "@/components/icons";
import type { AnimeSummary } from "@/types/anime";

interface AnimeRecommendationsProps {
  recommendations: AnimeSummary[];
  title?: string;
}

export function AnimeRecommendations({
  recommendations,
  title = "More Like This",
}: AnimeRecommendationsProps) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="recommendations-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-accent" />
        <h2
          id="recommendations-heading"
          className="font-display text-lg font-semibold text-fg"
        >
          {title}
        </h2>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted">
          {recommendations.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
        {recommendations.slice(0, 12).map((item) => (
          <AnimePosterCard
            key={item.id}
            anime={item}
            showQuickAdd
          />
        ))}
      </div>
    </section>
  );
}

