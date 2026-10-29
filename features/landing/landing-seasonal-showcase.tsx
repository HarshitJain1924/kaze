import Image from "next/image";
import Link from "next/link";

import { CompassIcon, StarIcon } from "@/components/icons";
import type { AnimeSummary } from "@/types/anime";

export function LandingSeasonalShowcase({
  items,
  seasonLabel,
  year,
}: {
  items: AnimeSummary[];
  seasonLabel: string;
  year: number;
}) {
  const displayItems = items.slice(0, 6);

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
              <span>Broadcast Season Spotlight</span>
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-white">
              Trending in {seasonLabel} {year}
            </h2>
            <p className="text-sm text-muted">
              Live broadcast data, ratings, and simulcast schedules directly from AniList.
            </p>
          </div>

          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-surface px-4 py-2 text-xs font-bold text-accent-strong hover:bg-surface-2 hover:text-white transition-all"
          >
            <CompassIcon className="h-3.5 w-3.5" />
            <span>Explore All Releases →</span>
          </Link>
        </div>

        {/* 6-Card Seasonal Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {displayItems.map((anime) => (
            <Link
              key={anime.id}
              href={`/anime/${anime.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/75 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-accent/50 hover:shadow-2xl hover:shadow-accent/15"
            >
              {/* Aspect Ratio 2:3 Poster Frame */}
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
                <Image
                  src={
                    anime.coverImage.extraLarge ||
                    anime.coverImage.large ||
                    "/posters/120377.jpg"
                  }
                  alt={anime.title.english || anime.title.romaji || "Anime"}
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 15vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized={Boolean(anime.coverImage.extraLarge?.startsWith("http"))}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                {/* Score Pill */}
                {anime.averageScore ? (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 backdrop-blur-sm">
                    <StarIcon className="h-2.5 w-2.5 fill-amber-400" />
                    {(anime.averageScore / 10).toFixed(1)}
                  </span>
                ) : null}

                {/* Format / Episodes Pill */}
                <span className="absolute top-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                  {anime.format || "TV"}
                </span>

                {/* Bottom Overlay Title */}
                <div className="absolute bottom-2 inset-x-2 space-y-0.5">
                  <p className="truncate text-xs font-bold text-white drop-shadow">
                    {anime.title.english || anime.title.romaji}
                  </p>
                  <p className="text-[10px] text-faint truncate">
                    {anime.genres?.slice(0, 2).join(" · ") || "Anime"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

