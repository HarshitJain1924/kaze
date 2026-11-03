"use client";

import Image from "next/image";
import Link from "next/link";

import {
  CheckIcon,
  ChevronRightIcon,
  LoaderIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatFormat,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

export function TrendingIndex({ items }: { items: AnimeSummary[] }) {
  const { preferences } = usePreferences();
  const { entryFor, requestAdd, pendingIds } = useLibrary();

  if (items.length === 0) return null;

  return (
    <section aria-label="Trending anime" className="min-w-0">
      <header className="flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Discovery / Anime
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">
            Trending now
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            In AniList&apos;s current trending order.
          </p>
        </div>
        <Link
          href="/discover?sort=TRENDING_DESC"
          className="group inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
        >
          Explore
          <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <ol className="mt-2 grid border-t border-border sm:grid-cols-2 sm:gap-x-8">
        {items.slice(0, 6).map((anime, index) => {
          const title = getDisplayTitle(
            anime.title,
            preferences.titleLanguage === "english",
          );
          const cover = anime.coverImage.large ?? anime.coverImage.extraLarge;
          const score = formatScore(anime.averageScore);
          const entry = entryFor(anime.id);
          const pending = pendingIds.has(anime.id);

          return (
            <li
              key={anime.id}
              className="border-b border-border sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <div className="group flex items-center gap-3 py-3.5">
                <span className="w-6 shrink-0 font-mono text-[11px] font-medium tabular-nums text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <Link
                  href={`/media/${anime.id}`}
                  aria-label={`View details for ${title}`}
                  className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden border border-border-subtle bg-surface-2"
                >
                  {cover && isHttpUrl(cover) ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/media/${anime.id}`}
                    className="line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors hover:text-accent-strong"
                    title={title}
                  >
                    {title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                    {score ? (
                      <span className="inline-flex items-center gap-0.5 font-medium text-warning">
                        <StarIcon className="h-2.5 w-2.5 fill-current" />
                        {score}
                      </span>
                    ) : null}
                    {score ? <span className="text-border">/</span> : null}
                    <span>{formatFormat(anime.format) ?? "Anime"}</span>
                    {anime.seasonYear ? (
                      <>
                        <span className="text-border">/</span>
                        <span>{anime.seasonYear}</span>
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="shrink-0">
                  {entry ? (
                    <span
                      className="inline-flex h-7 items-center gap-1 border border-accent/30 bg-accent-soft/40 px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-accent-strong"
                      title={`In library (${entry.status})`}
                    >
                      <CheckIcon className="h-3 w-3" />
                      <span>Tracked</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => requestAdd(anime)}
                      aria-label={`Add ${title} to your library`}
                      title="Add to library"
                      className="flex h-8 w-8 items-center justify-center border border-border bg-surface-2/40 text-muted transition-colors hover:border-accent hover:bg-surface-3 hover:text-accent-strong disabled:opacity-60"
                    >
                      {pending ? (
                        <LoaderIcon className="h-3.5 w-3.5 animate-spin text-accent-strong" />
                      ) : (
                        <PlusIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
