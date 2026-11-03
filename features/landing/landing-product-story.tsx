import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon, LibraryIcon } from "@/components/icons";
import {
  formatFormat,
  formatMediaKind,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type { Viewer } from "@/types/viewer";

interface PreviewRow {
  id: number;
  title: string;
  cover: string;
  format: string;
  year: string;
  progress: number;
  total: number;
  status: string;
  href: string;
}

const FALLBACK_ROWS: PreviewRow[] = [
  {
    id: 16498,
    title: "Attack on Titan",
    cover: "/posters/16498.jpg",
    format: "TV",
    year: "2013",
    progress: 18,
    total: 25,
    status: "Watching",
    href: "/media/16498",
  },
  {
    id: 154587,
    title: "Frieren: Beyond Journey's End",
    cover: "/posters/154587.jpg",
    format: "TV",
    year: "2023",
    progress: 7,
    total: 28,
    status: "Watching",
    href: "/media/154587",
  },
  {
    id: 151807,
    title: "Solo Leveling",
    cover: "/posters/151807.jpg",
    format: "TV",
    year: "2024",
    progress: 3,
    total: 12,
    status: "Watching",
    href: "/media/151807",
  },
];

const FEATURES = [
  {
    number: "01",
    title: "One tap, one episode.",
    description:
      "Mark an episode or chapter where you are. Progress updates without a modal detour or a page reload.",
  },
  {
    number: "02",
    title: "One shelf for both.",
    description:
      "Anime, manga and manhwa sit together, with format, origin and chapter progress kept clear.",
  },
  {
    number: "03",
    title: "The week, in your time.",
    description:
      "Airing times are converted to your active timezone, so the calendar matches the day you are actually in.",
  },
  {
    number: "04",
    title: "A record of your own.",
    description:
      "Private, account-scoped tracking and statistics built from your logged history — never fabricated totals.",
  },
];

function buildRows(items: AnimeSummary[]): PreviewRow[] {
  if (items.length < 3) return FALLBACK_ROWS;

  return items.slice(0, 3).map((item, index) => {
    const manga = isManga(item);
    const recordedTotal = manga ? item.chapters : item.episodes;
    const total = recordedTotal && recordedTotal > 0 ? recordedTotal : 12;
    const progress = Math.min(total, [8, 3, 1][index] ?? 1);

    return {
      id: item.id,
      title: getDisplayTitle(item.title, false),
      cover:
        item.coverImage.extraLarge ??
        item.coverImage.large ??
        FALLBACK_ROWS[index]?.cover ??
        "/hero-banner.jpg",
      format:
        (manga ? formatMediaKind(item) : formatFormat(item.format)) ?? "Anime",
      year: item.seasonYear ? String(item.seasonYear) : "—",
      progress,
      total,
      status: "Watching",
      href: `/media/${item.id}`,
    };
  });
}

export function LandingProductStory({
  viewer,
  items,
}: {
  viewer: Viewer | null;
  items: AnimeSummary[];
}) {
  const rows = buildRows(items);
  const libraryHref = viewer ? "/library" : "/login?next=/library";

  return (
    <section
      id="shelf"
      className="scroll-mt-24 border-b border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
              04 / The daily practice
            </p>
            <h2 className="landing-serif mt-4 max-w-[10ch] text-[clamp(2.8rem,5.4vw,5rem)] leading-[0.94] text-[var(--landing-ink)]">
              The ritual, kept simple.
            </h2>
            <p className="mt-6 max-w-[27rem] text-[15px] leading-7 text-[var(--landing-muted)]">
              A tracker should hold the thread between episodes, not turn
              watching into admin. Kaze keeps the next step close and the rest
              out of the way.
            </p>

            <Link
              href={libraryHref}
              className="group mt-7 inline-flex items-center gap-2 border-b border-[color:var(--landing-rule)] pb-1 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:border-[var(--landing-accent)] hover:text-[var(--landing-accent)]"
            >
              Open the library
              <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <div className="mt-10 max-w-[22rem] border-t border-[color:var(--landing-rule)] pt-4">
              <p className="landing-mono text-[9px] leading-5 text-[var(--landing-faint)]">
                A private record of anime, manga and manhwa. Account-scoped by
                default.
              </p>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <div
              aria-label="Library interface preview"
              className="border border-[color:var(--landing-rule)] bg-[var(--landing-paper)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--landing-rule)] px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <LibraryIcon className="h-4 w-4 text-[var(--landing-accent)]" />
                  <span className="landing-mono text-[9px] text-[var(--landing-ink)]">
                    My shelf / watching
                  </span>
                </div>
                <span className="landing-mono text-[8px] text-[var(--landing-faint)]">
                  Preview
                </span>
              </div>

              <div className="divide-y divide-[color:var(--landing-rule)]">
                {rows.map((row) => {
                  const percent = Math.round((row.progress / row.total) * 100);

                  return (
                    <div
                      key={`${row.id}-${row.title}`}
                      className="flex items-center gap-3 px-3 py-3.5 sm:gap-4 sm:px-4"
                    >
                      <Link
                        href={row.href}
                        className="relative h-[76px] w-[52px] shrink-0 overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]"
                      >
                        <Image
                          src={row.cover}
                          alt=""
                          fill
                          unoptimized={isHttpUrl(row.cover)}
                          sizes="52px"
                          className="object-cover"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link
                            href={row.href}
                            className="landing-serif truncate text-[17px] text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent)]"
                          >
                            {row.title}
                          </Link>
                          <span className="landing-mono shrink-0 text-[9px] text-[var(--landing-faint)]">
                            {row.progress}/{row.total}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--landing-muted)]">
                          <span>{row.format}</span>
                          <span aria-hidden="true">·</span>
                          <span>{row.year}</span>
                          <span aria-hidden="true">·</span>
                          <span>{row.status}</span>
                        </div>

                        <div className="mt-2.5 h-[3px] w-full overflow-hidden bg-[var(--landing-rule)]">
                          <div
                            className="h-full bg-[var(--landing-accent)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <Link
                        href={row.href}
                        aria-label={`Open ${row.title}`}
                        className="hidden shrink-0 items-center gap-1 text-[10px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-accent)] sm:flex"
                      >
                        Next
                        <ChevronRightIcon className="h-3 w-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--landing-rule)] px-4 py-2.5">
                <span className="landing-mono text-[8px] text-[var(--landing-faint)]">
                  Episodes / chapters stay in sync
                </span>
                <span className="landing-mono text-[8px] text-[var(--landing-faint)]">
                  Sample progress
                </span>
              </div>
            </div>

            <p className="landing-mono mt-3 text-[8px] leading-4 text-[var(--landing-faint)]">
              Interface preview · sample progress; artwork and titles from the
              current catalogue.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-x-6 border-t border-[color:var(--landing-rule)] sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.number}
              className="border-b border-[color:var(--landing-rule)] py-5 lg:border-b-0"
            >
              <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
                {feature.number}
              </p>
              <h3 className="landing-serif mt-3 text-xl leading-tight text-[var(--landing-ink)]">
                {feature.title}
              </h3>
              <p className="mt-2 max-w-[20rem] text-[12px] leading-5 text-[var(--landing-muted)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
