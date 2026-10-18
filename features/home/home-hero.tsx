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
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                aria-label={anime.title.english ?? anime.title.romaji ?? "Anime"}
                className="group relative aspect-[2/3] w-[110px] overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/70 transition-all duration-300 hover:z-20 hover:scale-105 hover:border-accent/50 hover:shadow-accent/20 xl:w-[140px]"
                style={{
                  transform: `rotate(${(index - 1) * 4}deg) translateY(${index === 1 ? "-10px" : "10px"})`,
                  opacity: index === 1 ? 1 : 0.82,
                }}
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    priority={index <= 1}
                    sizes="140px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface-3" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 max-w-2xl px-4 py-6 sm:px-8 sm:py-8 lg:py-9">
        <WeatherBadge season={season} year={year} />

        {viewer ? (
          <>
            <h1 className="mt-3.5 font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl">
              Welcome back.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Pick up where you left off, log your episodes, and see what airs
              this week.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href="/library"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                Open my library
              </Link>
              <Link
                href="/schedule"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-xs font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
              >
                Weekly schedule
                <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl lg:text-[34px]">
              Every episode,{" "}
              <span className="text-accent-strong">one quiet place.</span>
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Track exactly what you&apos;ve watched, follow the weekly broadcast
              schedule, and rate what you finish. Private and ad-free.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-4 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <SparkIcon className="h-3.5 w-3.5" />
                Start tracking
              </Link>
              <Link
                href="/discover"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-xs font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
              >
                Browse anime
                <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-faint">
              Free · No ads · AniList metadata
            </p>
          </>
        )}
      </div>
    </section>
  );
}
