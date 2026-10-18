import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon, PlayIcon, SparkIcon } from "@/components/icons";
import { WeatherBadge } from "@/features/home/season-badge";
import { cn } from "@/lib/utils";
import type { AnimeSummary, AnimeSeason } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

export function HomeHero({
  viewer,
  season,
  year,
  posters,
}: {
  viewer: Viewer | null;
  season: AnimeSeason;
  year: number;
  posters: AnimeSummary[];
}) {
  const featured = posters.slice(0, 3);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(70%_100%_at_0%_0%,var(--accent-soft),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block"
      >
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
        <div className="pointer-events-auto absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-2.5 xl:right-7">
          {featured.map((anime, index) => {
            const cover =
              anime.coverImage.extraLarge ?? anime.coverImage.large;
            return (
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                aria-label={anime.title.english ?? anime.title.romaji ?? "Anime"}
                className={cn(
                  "group relative aspect-[2/3] w-[84px] overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md xl:w-[96px]",
                  index === 2 && "hidden xl:block",
                )}
                style={{
                  opacity: index === 0 ? 0.95 : 0.75,
                }}
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="96px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-3" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 max-w-xl px-4 py-4 sm:px-6 sm:py-5">
        <WeatherBadge season={season} year={year} />

        {viewer ? (
          <>
            <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
              Welcome back.
            </h1>
            <p className="mt-1 max-w-md text-xs text-muted sm:text-sm">
              Log your next episodes, check today&apos;s airing calendar, and manage your watchlist.
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <Link
                href="/library"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                My library
              </Link>
              <Link
                href="/schedule"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-fg transition-colors hover:border-border hover:bg-surface-3"
              >
                Weekly schedule
                <ChevronRightIcon className="h-3 w-3 text-muted" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-xl font-bold leading-tight tracking-tight text-fg sm:text-2xl">
              Every episode,{" "}
              <span className="text-accent-strong">one quiet place.</span>
            </h1>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted sm:text-sm">
              Track what you watch, follow the broadcast schedule, and rate your library. Private and ad-free.
            </p>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <Link
                href="/login"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <SparkIcon className="h-3.5 w-3.5" />
                Start tracking
              </Link>
              <Link
                href="/discover"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-fg transition-colors hover:border-border hover:bg-surface-3"
              >
                Browse anime
                <ChevronRightIcon className="h-3 w-3 text-muted" />
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-faint">
              Free · No ads · AniList metadata
            </p>
          </>
        )}
      </div>
    </section>
  );
}
