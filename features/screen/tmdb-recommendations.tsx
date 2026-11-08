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
        <span className="border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {recommendations.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6">
        {recommendations.slice(0, 12).map((item) => (
          <Link
            key={`${item.kind}:${item.tmdbId}`}
            href={`/screen/${item.kind}/${item.tmdbId}`}
            className="group overflow-hidden border border-white/10 bg-[rgba(14,17,24,0.35)] transition-colors duration-200 hover:border-white/25 hover:bg-[rgba(14,17,24,0.5)]"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-white/5">
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
                  <StarIcon className="h-7 w-7 text-white/30" />
                </div>
              )}
              {item.voteAverage && item.voteAverage > 0 ? (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 border border-white/20 bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300 backdrop-blur-sm">
                  <StarIcon className="h-3 w-3 fill-current" />
                  {item.voteAverage.toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="space-y-0.5 p-2.5">
              <p className="line-clamp-2 text-xs font-semibold text-white" title={item.title}>
                {item.title}
              </p>
              <p className="text-[11px] text-white/45">
                {[item.year ?? "Year unknown", item.kind === "tv" ? "TV" : "Film"].join(" · ")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
