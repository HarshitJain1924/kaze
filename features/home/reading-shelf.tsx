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
  formatMediaKind,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

export function ReadingShelf({ items }: { items: AnimeSummary[] }) {
  const { preferences } = usePreferences();
  const { entryFor, requestAdd, pendingIds } = useLibrary();

  if (items.length === 0) return null;

  return (
    <section aria-label="Trending manga and manhwa" className="min-w-0">
      <header className="flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Reading room
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg sm:text-2xl">
            On the reading table
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            Manga and manhwa picking up momentum.
          </p>
        </div>
        <Link
          href="/discover?type=manga&sort=TRENDING_DESC"
          className="group inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
        >
          Explore
          <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 border-t border-border pt-5 sm:grid-cols-3 lg:grid-cols-6">
        {items.slice(0, 6).map((item) => {
          const title = getDisplayTitle(
            item.title,
            preferences.titleLanguage === "english",
          );
          const cover = item.coverImage.extraLarge ?? item.coverImage.large;
          const score = formatScore(item.averageScore);
          const entry = entryFor(item.id);
          const pending = pendingIds.has(item.id);
          const chapters = item.chapters;
          const mediaKind = formatMediaKind(item);

          return (
            <article key={item.id} className="group min-w-0">
              <div className="relative aspect-[2/3] overflow-hidden border border-border-subtle bg-surface-2">
                {cover && isHttpUrl(cover) ? (
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                  />
                ) : null}

                <Link
                  href={`/media/${item.id}`}
                  aria-label={`View details for ${title}`}
                  className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-accent"
                />

                {score ? (
                  <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg">
                    <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
                    {score}
                  </span>
                ) : null}

                {entry ? (
                  <span
                    className="pointer-events-none absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center bg-bg/90 text-accent-strong"
                    title={`In library (${entry.status})`}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => requestAdd(item)}
                    aria-label={`Add ${title} to your library`}
                    title="Add to library"
                    className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center bg-bg/90 text-fg transition-colors hover:bg-accent hover:text-accent-contrast disabled:opacity-60"
                  >
                    {pending ? (
                      <LoaderIcon className="h-3 w-3 animate-spin text-accent-strong" />
                    ) : (
                      <PlusIcon className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.1em] text-faint">
                <span className={item.countryOfOrigin === "KR" ? "font-semibold text-accent-strong" : ""}>
                  {mediaKind}
                </span>
                {chapters ? ` · ${chapters} ch` : ""}
              </p>
              <h3
                className="mt-0.5 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong"
                title={title}
              >
                {title}
              </h3>
            </article>
          );
        })}
      </div>
    </section>
  );
}
