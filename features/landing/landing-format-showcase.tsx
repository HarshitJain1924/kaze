import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import {
  formatFormat,
  formatScore,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

import {
  displayLandingTitle,
  selectLandingCover,
} from "./landing-media";

function ArtworkUnavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--landing-paper-2)] p-4 text-center">
      <span className="landing-mono text-[8px] leading-4 text-[var(--landing-faint)]">
        Artwork unavailable
      </span>
    </div>
  );
}

function EmptyFormat({
  label,
  copy,
  href,
}: {
  label: string;
  copy: string;
  href: string;
}) {
  return (
    <div className="flex min-h-64 flex-col justify-between border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)] p-5">
      <div>
        <p className="landing-mono text-[8px] text-[var(--landing-accent)]">
          {label}
        </p>
        <p className="landing-serif mt-3 max-w-[13rem] text-xl leading-tight text-[var(--landing-ink)]">
          {copy}
        </p>
      </div>
      <Link
        href={href}
        className="mt-8 inline-flex items-center gap-2 text-[11px] font-medium text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent)]"
      >
        Browse the catalogue
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function FormatCaption({
  label,
  item,
  href,
  detail,
}: {
  label: string;
  item: AnimeSummary;
  href: string;
  detail: string;
}) {
  const score = formatScore(item.averageScore);
  const title = displayLandingTitle(item);

  return (
    <div className="mt-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="landing-mono text-[8px] text-[var(--landing-accent)]">
          {label}
        </p>
        <h3 className="landing-serif mt-1 line-clamp-2 text-xl leading-tight text-[var(--landing-ink)] sm:text-2xl">
          <Link href={href} className="transition-colors hover:text-[var(--landing-accent)]">
            {title}
          </Link>
        </h3>
        <p className="landing-mono mt-1.5 text-[8px] text-[var(--landing-faint)]">
          {detail}
        </p>
      </div>
      {score ? (
        <span className="landing-mono shrink-0 border border-[color:var(--landing-rule)] px-2 py-1 text-[8px] text-[var(--landing-muted)]">
          {score}
        </span>
      ) : null}
    </div>
  );
}

function AnimePlate({
  item,
  href,
}: {
  item: AnimeSummary;
  href: string;
}) {
  const banner =
    item.bannerImage && isHttpUrl(item.bannerImage) ? item.bannerImage : null;
  const cover = selectLandingCover(item, "extraLarge");
  const image = banner ?? cover;
  const title = displayLandingTitle(item);
  const format = formatFormat(item.format) ?? "Anime";
  const detail = `${format} / ${item.seasonYear ?? "—"} / ${item.episodes ? `${item.episodes} episodes` : "Catalogue"}`;
  const useBanner = Boolean(banner);

  return (
    <div className="min-w-0">
      <Link
        href={href}
        className="group block overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          {image ? (
            <Image
              src={image}
              alt={title}
              fill
              unoptimized={isHttpUrl(image)}
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 54vw, 42vw"
              className={
                useBanner
                  ? "object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  : "object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              }
            />
          ) : (
            <ArtworkUnavailable />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
          />
          <span className="landing-mono absolute left-3 top-3 border border-white/25 bg-black/45 px-1.5 py-1 text-[8px] text-white/85">
            Anime
          </span>
        </div>
      </Link>
      <FormatCaption label="Anime / seasonal" item={item} href={href} detail={detail} />
    </div>
  );
}

function MangaPlate({
  item,
  label,
  href,
  className,
}: {
  item: AnimeSummary;
  label: string;
  href: string;
  className?: string;
}) {
  const cover = selectLandingCover(item, "extraLarge");
  const title = displayLandingTitle(item);
  const chapters = item.chapters ? `${item.chapters} chapters` : "Chapters";

  return (
    <div className={className}>
      <Link href={href} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
          {cover ? (
            <Image
              src={cover}
              alt={title}
              fill
              unoptimized={isHttpUrl(cover)}
              sizes="(max-width: 768px) 44vw, (max-width: 1024px) 25vw, 22vw"
              className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.025]"
            />
          ) : (
            <ArtworkUnavailable />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"
          />
          <span className="landing-mono absolute left-3 top-3 border border-white/25 bg-black/45 px-1.5 py-1 text-[8px] text-white/85">
            {label}
          </span>
        </div>
      </Link>
      <FormatCaption
        label={`${label} / catalogue`}
        item={item}
        href={href}
        detail={chapters}
      />
    </div>
  );
}

export function LandingFormatShowcase({
  anime,
  manga,
  manhwa,
}: {
  anime: AnimeSummary | null;
  manga: AnimeSummary[];
  manhwa: AnimeSummary[];
}) {
  const mangaLead = manga[0] ?? null;
  const manhwaLead = manhwa[0] ?? null;

  return (
    <section
      id="formats"
      className="scroll-mt-24 border-b border-[color:var(--landing-rule)]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="grid gap-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
              03 / Beyond the screen
            </p>
            <h2 className="landing-serif mt-4 max-w-[14ch] text-[clamp(2.8rem,5.8vw,5.6rem)] leading-[0.9] text-[var(--landing-ink)]">
              Stories don&apos;t end at the screen.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="max-w-[27rem] text-sm leading-6 text-[var(--landing-muted)]">
              Anime, manga and manhwa. One personal index for the worlds you
              follow, whichever page or screen you return to.
            </p>
            <Link
              href="/discover"
              className="group mt-4 inline-flex items-center gap-2 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent)]"
            >
              Browse every format
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-x-4 gap-y-10 md:grid-cols-12 lg:mt-14 lg:gap-x-5">
          <div className="md:col-span-5">
            {anime ? (
              <AnimePlate item={anime} href={`/media/${anime.id}`} />
            ) : (
              <EmptyFormat
                label="Anime / seasonal"
                copy="The current anime index is taking a moment."
                href="/discover"
              />
            )}
          </div>

          <div className="md:col-span-3 md:mt-12">
            {mangaLead ? (
              <MangaPlate
                item={mangaLead}
                label="Manga"
                href={`/media/${mangaLead.id}`}
              />
            ) : (
              <EmptyFormat
                label="Manga / Japan"
                copy="Japanese manga covers are taking a moment."
                href="/discover?type=manga"
              />
            )}
          </div>

          <div className="md:col-span-4 md:mt-20">
            {manhwaLead ? (
              <MangaPlate
                item={manhwaLead}
                label="Manhwa"
                href={`/media/${manhwaLead.id}`}
              />
            ) : (
              <EmptyFormat
                label="Manhwa / Korea"
                copy="Korean manhwa covers are taking a moment."
                href="/discover?type=manga&country=KR"
              />
            )}
          </div>
        </div>

        {manga.length > 1 || manhwa.length > 1 ? (
          <div className="mt-12 grid gap-4 border-t border-[color:var(--landing-rule)] pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...manga.slice(1, 3), ...manhwa.slice(1, 3)].map((item) => (
              <Link
                key={item.id}
                href={`/media/${item.id}`}
                className="group flex min-w-0 items-center gap-3"
              >
                <div className="relative h-16 w-11 shrink-0 overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
                  {selectLandingCover(item, "large") ? (
                    <Image
                      src={selectLandingCover(item, "large")!}
                      alt=""
                      fill
                      unoptimized
                      sizes="44px"
                      className="object-cover"
                    />
                  ) : (
                    <ArtworkUnavailable />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="landing-mono text-[8px] text-[var(--landing-faint)]">
                    {item.countryOfOrigin === "KR" ? "Manhwa" : "Manga"} /{" "}
                    {item.chapters ? `${item.chapters} ch` : "Catalogue"}
                  </p>
                  <p className="landing-serif mt-1 line-clamp-1 text-sm text-[var(--landing-ink)] transition-colors group-hover:text-[var(--landing-accent)]">
                    {displayLandingTitle(item)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
