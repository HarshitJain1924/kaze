import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { isHttpUrl } from "@/lib/utils";
import type { TmdbSearchResult } from "@/types/tmdb";

/**
 * Films and television are part of the index, not an annexe, so the landing
 * page names them explicitly and shows real catalogue artwork.
 */
export function LandingScreenIndex({ items }: { items: TmdbSearchResult[] }) {
  return (
    <section
      id="screen"
      className="scroll-mt-24 border-b border-[color:var(--landing-rule)]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="grid gap-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
              Screen / Cinema &amp; television
            </p>
            <h2 className="landing-serif mt-4 max-w-[17ch] text-[clamp(2.4rem,5vw,4.6rem)] leading-[0.92] text-[var(--landing-ink)]">
              Films and series, in the same index.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="max-w-[27rem] text-sm leading-6 text-[var(--landing-muted)]">
              The screen archive matches films and television by TMDB. Mark a
              film watched in one move, follow a series episode by episode, and
              keep ratings and notes beside your anime shelf.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <Link
                href="/discover?type=movie"
                className="group inline-flex items-center gap-2 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:text-[var(--landing-accent)]"
              >
                Browse films
                <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/discover?type=tv"
                className="group inline-flex items-center gap-2 text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
              >
                Browse series
                <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 border-t border-[color:var(--landing-rule)] pt-8 sm:grid-cols-4 lg:mt-14 lg:gap-x-5">
            {items.map((item) => (
              <Link
                key={`${item.kind}-${item.tmdbId}`}
                href={`/screen/${item.kind}/${item.tmdbId}`}
                className="group block min-w-0"
              >
                <div className="relative aspect-[2/3] overflow-hidden border border-[color:var(--landing-rule)] bg-[var(--landing-paper-2)]">
                  {item.posterUrl && isHttpUrl(item.posterUrl) ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 24vw, 22vw"
                      className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                      <span className="landing-mono text-[8px] leading-4 text-[var(--landing-faint)]">
                        Artwork unavailable
                      </span>
                    </div>
                  )}
                  <span className="landing-mono absolute left-3 top-3 border border-white/25 bg-black/45 px-1.5 py-1 text-[8px] text-white/85">
                    Film
                  </span>
                </div>
                <p className="landing-mono mt-3 text-[8px] text-[var(--landing-accent)]">
                  Film / {item.year ?? "Catalogue"}
                </p>
                <h3 className="landing-serif mt-1 line-clamp-2 text-lg leading-tight text-[var(--landing-ink)] transition-colors group-hover:text-[var(--landing-accent)]">
                  {item.title}
                </h3>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
