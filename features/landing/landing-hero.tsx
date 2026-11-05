import Image from "next/image";
import Link from "next/link";

import { CompassIcon, StarIcon } from "@/components/icons";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { formatFormat, formatScore, isHttpUrl } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

function displayTitle(item: AnimeSummary): string {
  return (
    item.title.english ??
    item.title.romaji ??
    item.title.native ??
    "Untitled"
  );
}

function coverFor(item: AnimeSummary): string | null {
  return item.coverImage.extraLarge ?? item.coverImage.large;
}

export function LandingHero({
  viewer,
  featured,
  season,
  year,
}: {
  viewer: Viewer | null;
  featured: AnimeSummary[];
  season: string;
  year: number;
}) {
  const lead = featured[0] ?? null;
  const second = featured[1] ?? null;
  const leadCover = lead ? coverFor(lead) : null;
  const secondCover = second ? coverFor(second) : null;
  const leadTitle = lead ? displayTitle(lead) : null;
  const secondTitle = second ? displayTitle(second) : null;
  const leadScore = lead ? formatScore(lead.averageScore) : null;
  const leadMeta = lead
    ? [formatFormat(lead.format), lead.seasonYear ? String(lead.seasonYear) : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section className="overflow-hidden border-b border-[color:var(--landing-rule)]">
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-0">
          <div className="flex flex-col justify-between lg:col-span-5 lg:pr-12">
            <div>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-px w-9 bg-[var(--landing-accent)]"
                />
                <p className="landing-mono text-[9px] text-[var(--landing-muted)]">
                  Personal index / 01
                </p>
              </div>

              <h1
                className="landing-serif mt-8 max-w-[10ch] text-[var(--landing-ink)]"
                style={{
                  fontSize: "clamp(3.35rem, 7.6vw, 7.4rem)",
                  lineHeight: 0.86,
                }}
              >
                Keep the stories{" "}
                <span className="landing-accent">you return to.</span>
              </h1>

              <p className="mt-8 max-w-[32rem] text-[15px] leading-7 text-[var(--landing-muted)] sm:text-[17px]">
                Anime, manga and manhwa in one quiet, private library. Log an
                episode in a tap, follow the week&apos;s broadcasts, and see the
                shape of your taste — without ads or noise.
              </p>

              <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                {viewer ? (
                  <Link
                    href="/dashboard"
                    className="landing-accent-bg inline-flex h-11 items-center justify-center gap-3 px-5 text-[12px] font-semibold transition-opacity hover:opacity-85"
                  >
                    Open your dashboard
                    <span aria-hidden="true">↗</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="landing-accent-bg inline-flex h-11 items-center justify-center gap-3 px-5 text-[12px] font-semibold transition-opacity hover:opacity-85"
                  >
                    Start your index
                    <span aria-hidden="true">↗</span>
                  </Link>
                )}

                <Link
                  href="/discover"
                  className="inline-flex h-11 items-center justify-center gap-2.5 border border-[color:var(--landing-rule)] px-5 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:border-[var(--landing-accent)]"
                >
                  <CompassIcon className="h-3.5 w-3.5 text-[var(--landing-accent)]" />
                  Browse the catalogue
                </Link>
              </div>

              <p className="landing-mono mt-6 text-[9px] leading-5 text-[var(--landing-faint)]">
                Live catalogue from AniList · Free to start · No ads
              </p>
            </div>

            <div className="mt-12 hidden items-center justify-between border-t border-[color:var(--landing-rule)] pt-4 lg:flex">
              <span className="landing-mono text-[9px] text-[var(--landing-faint)]">
                Season {season} {year}
              </span>
              <a
                href="#season"
                className="landing-mono text-[9px] text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
              >
                Scroll to the index ↓
              </a>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-7 lg:border-l lg:border-[color:var(--landing-rule)] lg:pl-12">
            <div className="grid grid-cols-12 gap-3">
              <Link
                href={lead ? `/media/${lead.id}` : "/discover"}
                className="group col-span-12 sm:col-span-7"
              >
                <div className="relative aspect-[4/5] overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
                  {leadCover && isHttpUrl(leadCover) ? (
                    <Image
                      src={leadCover}
                      alt={leadTitle ?? "Seasonal artwork"}
                      fill
                      priority
                      loading="eager"
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 55vw, 38vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                    />
                  ) : (
                    <Image
                      src="/hero-banner.jpg"
                      alt="Kaze seasonal artwork"
                      fill
                      priority
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 42vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent"
                  />

                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 text-white sm:p-5">
                    <div className="min-w-0">
                      <p className="landing-mono text-[9px] text-white/65">
                        {lead ? "Current season" : "Catalogue preview"} /{" "}
                        {lead ? season : year}
                      </p>
                      {leadTitle ? (
                        <p className="landing-serif mt-1 truncate text-xl sm:text-2xl">
                          {leadTitle}
                        </p>
                      ) : null}
                      {leadMeta ? (
                        <p className="landing-mono mt-1 text-[9px] text-white/65">
                          {leadMeta}
                        </p>
                      ) : null}
                    </div>
                    {leadScore ? (
                      <OpticalGlass
                        variant="pill"
                        interactive={false}
                        className="optical-glass-dark landing-mono flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[9px] text-white/95 border border-white/25 shadow-xs"
                      >
                        <StarIcon className="h-2.5 w-2.5 fill-current" />
                        {leadScore}
                      </OpticalGlass>
                    ) : null}
                  </div>
                </div>
              </Link>

              <div className="col-span-5 hidden min-w-0 flex-col justify-end sm:flex">
                {second ? (
                  <Link href={`/media/${second.id}`} className="group">
                    <div className="relative aspect-[2/3] overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
                      {secondCover && isHttpUrl(secondCover) ? (
                        <Image
                          src={secondCover}
                          alt={secondTitle ?? "Seasonal artwork"}
                          fill
                          unoptimized
                          sizes="(max-width: 1024px) 24vw, 16vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--landing-paper-2)] p-3 text-center">
                          <span className="landing-mono text-[8px] leading-4 text-[var(--landing-faint)]">
                            Artwork unavailable
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="landing-mono mt-2 truncate text-[9px] text-[var(--landing-faint)]">
                      {secondTitle ?? "Season archive"}
                    </p>
                  </Link>
                ) : (
                  <div className="border border-[color:var(--landing-rule)] p-4">
                    <p className="landing-mono text-[9px] leading-5 text-[var(--landing-faint)]">
                      The current season, collected from the live AniList
                      catalogue.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-t border-[color:var(--landing-rule)] pt-3">
              <span className="landing-mono text-[9px] text-[var(--landing-faint)]">
                Artwork / AniList
              </span>
              <span className="landing-mono text-[9px] text-[var(--landing-faint)]">
                02 / 05
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
