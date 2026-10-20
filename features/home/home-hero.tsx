import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon, SparkIcon } from "@/components/icons";
import type { AnimeSummary, AnimeSeason } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

/**
 * The first band of the dashboard. Signed-out visitors get the product's
 * promise; signed-in visitors get today's answer in eighty pixels instead of
 * a greeting that pushes their next episode below the fold.
 */
export function HomeHero({
  viewer,
  season,
  year,
  posters,
  summary,
  todayLabel,
}: {
  viewer: Viewer | null;
  season: AnimeSeason;
  year: number;
  posters: AnimeSummary[];
  summary?: string;
  todayLabel?: string;
}) {
  const featured = posters.slice(0, 3);

  if (viewer) {
    return (
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border-subtle pb-4">
        <div className="min-w-0">
          {todayLabel ? (
            <p className="text-xs text-faint">{todayLabel}</p>
          ) : null}
          <h1 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
            Today
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {summary ?? "Your library, the broadcast week and what to watch next."}
          </p>
        </div>

        <Link
          href="/schedule"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Weekly schedule
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
        </Link>
      </header>
    );
  }

  return (
    <section className="grid gap-7 border-b border-border-subtle pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="max-w-xl">
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-fg sm:text-[32px]">
          Every episode, one quiet place.
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted sm:text-[15px]">
          Track what you watch, follow the broadcast week and keep a private
          library of progress, ratings and notes.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
          >
            <SparkIcon className="h-3.5 w-3.5" />
            Start tracking
          </Link>
          <Link
            href="/discover"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Browse anime
            <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
          </Link>
        </div>

        <p className="mt-3 text-xs text-faint">
          Free and ad-free. Metadata from AniList; your library stays private.
        </p>
      </div>

      {/* On a phone the artwork is the first honest impression of the product,
          so the same three covers sit under the actions instead of vanishing. */}
      {featured.length > 0 ? (
        <div className="flex items-end gap-2 lg:hidden">
          {featured.map((anime) => {
            const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
            const title = anime.title.english ?? anime.title.romaji ?? "Anime";
            return (
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                aria-label={title}
                className="relative aspect-[2/3] flex-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-2"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-faint">
                    {title}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : null}

      {featured.length > 0 ? (
        <div className="hidden items-end gap-2.5 lg:flex">
          {featured.map((anime) => {
            const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
            const title = anime.title.english ?? anime.title.romaji ?? "Anime";
            return (
              <Link
                key={anime.id}
                href={`/anime/${anime.id}`}
                aria-label={title}
                className="group relative aspect-[2/3] w-[86px] shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-2 xl:w-[96px]"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="96px"
                    className="poster-zoom object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-faint">
                    {title}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="hidden text-xs text-faint lg:block">
          {season} {year}
        </p>
      )}
    </section>
  );
}
