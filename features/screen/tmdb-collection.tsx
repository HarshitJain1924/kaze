import Image from "next/image";
import Link from "next/link";

import { FilmIcon, StarIcon } from "@/components/icons";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbCollection } from "@/types/tmdb";

function releaseDateValue(releaseDate: string | null): string {
  return releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(releaseDate)
    ? releaseDate
    : "9999-99-99";
}

export function TmdbCollectionSection({
  collection,
  currentTmdbId,
}: {
  collection: TmdbCollection;
  currentTmdbId: number;
}) {
  if (collection.parts.length === 0) return null;

  const parts = [...collection.parts].sort((a, b) =>
    releaseDateValue(a.releaseDate).localeCompare(
      releaseDateValue(b.releaseDate),
    ),
  );

  return (
    <section aria-labelledby="collection-heading" className="space-y-4">
      <div className="border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <h2
            id="collection-heading"
            className="font-display text-lg font-semibold text-fg"
          >
            Franchise &amp; Chronology
          </h2>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">
            {parts.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {collection.name} · {parts.length}{" "}
          {parts.length === 1 ? "film" : "films"}, ordered by release date.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {parts.map((part) => {
          const current = part.tmdbId === currentTmdbId;
          const poster =
            part.posterUrl && isHttpUrl(part.posterUrl)
              ? part.posterUrl
              : null;
          const rating =
            part.voteAverage && part.voteAverage > 0
              ? part.voteAverage.toFixed(1)
              : null;

          return (
            <div
              key={part.tmdbId}
              className={cn(
                "group relative flex items-center gap-3.5 rounded-xl border p-3 shadow-xs transition-all duration-200",
                current
                  ? "border-accent/60 bg-accent-soft/30 ring-1 ring-accent/25 shadow-sm"
                  : "border-border-subtle bg-surface/90 hover:border-border hover:bg-surface",
              )}
            >
              <Link
                href={`/screen/movie/${part.tmdbId}`}
                aria-current={current ? "page" : undefined}
                className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3 transition-transform duration-200 group-hover:scale-102"
              >
                {poster ? (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <FilmIcon className="h-5 w-5 text-faint/60" />
                  </span>
                )}

                {current ? (
                  <div className="absolute inset-x-0 bottom-0 bg-accent py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-accent-contrast">
                    Viewing
                  </div>
                ) : null}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                      current
                        ? "bg-accent text-accent-contrast"
                        : "border border-border-subtle bg-surface-2 text-muted",
                    )}
                  >
                    {current ? "Current Title" : "Film"}
                  </span>
                  {part.year ? (
                    <span className="text-[11px] text-faint">
                      {part.year}
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/screen/movie/${part.tmdbId}`}
                  className="mt-1 block line-clamp-1 text-xs font-semibold text-fg transition-colors hover:text-accent-strong sm:text-[13px]"
                  title={part.title}
                >
                  {part.title}
                </Link>

                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  {rating ? (
                    <span className="flex items-center gap-0.5 font-medium text-warning">
                      <StarIcon className="h-3 w-3 fill-warning text-warning" />
                      {rating}
                    </span>
                  ) : (
                    <span className="text-faint">
                      {part.releaseDate
                        ? part.releaseDate.slice(0, 4)
                        : "Release date unknown"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
