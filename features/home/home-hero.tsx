import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon, PlayIcon, SparkIcon } from "@/components/icons";
import { WeatherBadge } from "@/features/home/season-badge";
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
    <section className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(90%_130%_at_0%_0%,var(--accent-soft),transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 hidden w-1/2 lg:block"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/55 to-transparent" />
        <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-3 xl:right-10 xl:gap-4">
          {featured.map((anime, index) => {
            const cover =
              anime.coverImage.extraLarge ?? anime.coverImage.large;
            return (
              <div
                key={anime.id}
                className="relative aspect-[2/3] w-[110px] overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/50 xl:w-[140px]"
                style={{
                  transform: `rotate(${(index - 1) * 4}deg) translateY(${index === 1 ? "-10px" : "10px"})`,
                  opacity: index === 1 ? 1 : 0.72,
                }}
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="140px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-3" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 max-w-2xl px-5 py-9 sm:px-9 sm:py-12 lg:py-14">
        <WeatherBadge season={season} year={year} />

        {viewer ? (
          <>
            <h1 className="mt-5 font-display text-3xl font-bold leading-[1.1] tracking-tight text-fg sm:text-4xl">
              Welcome back.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-[15px]">
              Pick up where you left off, keep your episode count current, and
              find something new for tonight.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href="/library"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <PlayIcon className="h-4 w-4" />
                Open my library
              </Link>
              <Link
                href="/discover"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
              >
                Discover anime
                <ChevronRightIcon className="h-4 w-4 text-muted" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-3xl font-bold leading-[1.08] tracking-tight text-fg sm:text-[42px]">
              Every episode,
              <br />
              <span className="text-accent-strong">one quiet place.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-[15px]">
              Search thousands of anime, keep a personal watchlist, log every
              episode and rate what you finish. Your library stays private and
              in sync.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href="/login"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <SparkIcon className="h-4 w-4" />
                Start tracking
              </Link>
              <Link
                href="/discover"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
              >
                Browse anime
                <ChevronRightIcon className="h-4 w-4 text-muted" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-faint">
              Free · No ads · Powered by AniList metadata
            </p>
          </>
        )}
      </div>
    </section>
  );
}
