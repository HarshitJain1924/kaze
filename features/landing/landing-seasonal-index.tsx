import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { formatFormat, formatScore } from "@/lib/utils";
import type { AnimeSeason, AnimeSummary } from "@/types/anime";

import { displayLandingTitle, selectLandingCover } from "./landing-media";

function ArtworkUnavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--landing-paper-2)] p-4 text-center">
      <span className="landing-mono text-[8px] leading-4 text-[var(--landing-faint)]">
        Artwork unavailable
      </span>
    </div>
  );
}

function SeasonalPlate({
  item,
  index,
  featured = false,
}: {
  item: AnimeSummary;
  index: number;
  featured?: boolean;
}) {
  const title = displayLandingTitle(item);
  const format = formatFormat(item.format) ?? "Anime";
  const score = formatScore(item.averageScore);
  const cover = selectLandingCover(item, "extraLarge");
  const units = item.episodes ? `${item.episodes} ep` : "Open";

  return (
    <Link href={`/media/${item.id}`} className="group block min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            unoptimized
            sizes={
              featured
                ? "(max-width: 768px) 100vw, (max-width: 1024px) 55vw, 40vw"
                : "(max-width: 768px) 50vw, (max-width: 1024px) 28vw, 18vw"
            }
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <ArtworkUnavailable />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
        />
        <span className="landing-mono absolute left-3 top-3 border border-white/25 bg-black/45 px-1.5 py-1 text-[8px] text-white/80">
          {String(index + 1).padStart(2, "0")}
        </span>
        {score ? (
          <span className="landing-mono absolute right-3 top-3 border border-white/25 bg-black/45 px-1.5 py-1 text-[8px] text-white/80">
            {score}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="landing-mono text-[8px] text-[var(--landing-faint)]">
            {format} / {item.seasonYear ?? "—"}
          </p>
          <h3
            className={[
              "landing-serif mt-1 line-clamp-2 text-[var(--landing-ink)]",
              featured ? "text-xl sm:text-2xl" : "text-base",
            ].join(" ")}
            title={title}
          >
            {title}
          </h3>
        </div>
        <span className="landing-mono shrink-0 pt-1 text-[8px] text-[var(--landing-faint)]">
          {units}
        </span>
      </div>
    </Link>
  );
}

export function LandingSeasonalIndex({
  items,
  season,
  seasonLabel,
  year,
}: {
  items: AnimeSummary[];
  season: AnimeSeason;
  seasonLabel: string;
  year: number;
}) {
  if (items.length === 0) return null;

  const [lead, ...rest] = items.slice(0, 5);
  if (!lead) return null;

  return (
    <section
      id="season"
      className="scroll-mt-24 border-b border-[color:var(--landing-rule)]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="grid gap-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
              02 / The season
            </p>
            <h2 className="landing-serif mt-4 max-w-[12ch] text-[clamp(2.8rem,5.6vw,5.4rem)] leading-[0.92] text-[var(--landing-ink)]">
              A live index of what&apos;s airing now.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="max-w-[28rem] text-sm leading-6 text-[var(--landing-muted)]">
              The current {seasonLabel} {year} catalogue, with format, year and
              score intact. Artwork is loaded from the same AniList source used
              throughout Kaze.
            </p>
            <Link
              href={`/discover?season=${season}&year=${year}`}
              className="group mt-4 inline-flex items-center gap-2 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent)]"
            >
              Explore the full season
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 lg:mt-14 lg:grid-cols-12 lg:gap-x-5">
          <div className="col-span-2 mx-auto w-full max-w-[460px] lg:col-span-5">
            <SeasonalPlate item={lead} index={0} featured />
          </div>

          {rest.length > 0 ? (
            <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 lg:col-span-7 lg:grid-cols-2 lg:gap-x-5">
              {rest.map((item, index) => (
                <SeasonalPlate
                  key={item.id}
                  item={item}
                  index={index + 1}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
