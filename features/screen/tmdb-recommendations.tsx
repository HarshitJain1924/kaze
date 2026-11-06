import Image from "next/image";
import Link from "next/link";

import { StarIcon } from "@/components/icons";
import { isHttpUrl } from "@/lib/utils";
import type { TmdbRecommendation } from "@/types/tmdb";

export function TmdbRecommendations({
  recommendations,
}: {
  recommendations: TmdbRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <section aria-labelledby="tmdb-recommendations-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <h2
          id="tmdb-recommendations-heading"
          className="font-display text-lg font-semibold text-fg"
        >
          More Like This
        </h2>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted">
          {recommendations.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
        {recommendations.slice(0, 12).map((item) => (
          <Link
            key={`${item.kind}:${item.tmdbId}`}
            href={`/screen/${item.kind}/${item.tmdbId}`}
            className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-3">
              {item.posterUrl && isHttpUrl(item.posterUrl) ? (
                <Image
                  src={item.posterUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 46vw, (max-width: 1024px) 22vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <StarIcon className="h-7 w-7 text-faint/50" />
                </div>
              )}
              {item.voteAverage && item.voteAverage > 0 ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md">
                  <StarIcon className="h-3 w-3 fill-current" />
                  {item.voteAverage.toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="space-y-0.5 p-2.5">
              <p className="line-clamp-2 text-xs font-semibold text-fg" title={item.title}>
                {item.title}
              </p>
              <p className="text-[11px] text-faint">
                {[item.year ?? "Year unknown", item.kind === "tv" ? "TV" : "Film"].join(" · ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
