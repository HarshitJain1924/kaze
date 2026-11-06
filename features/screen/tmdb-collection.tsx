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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {parts.map((part) => {
          const current = part.tmdbId === currentTmdbId;
          const poster =
            part.posterUrl && isHttpUrl(part.posterUrl)
              ? part.posterUrl
              : null;
          return (
            <Link
              key={part.tmdbId}
              href={`/screen/movie/${part.tmdbId}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group overflow-hidden rounded-xl border bg-surface/80 transition-all hover:-translate-y-0.5 hover:border-accent/50",
                current
                  ? "border-accent/60 ring-1 ring-accent/30"
                  : "border-border-subtle",
              )}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-3">
                {poster ? (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 46vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FilmIcon className="h-7 w-7 text-faint/50" />
                  </div>
                )}
                {current ? (
                  <span className="absolute inset-x-2 top-2 rounded bg-accent px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-accent-contrast">
                    Current
                  </span>
                ) : null}
                {part.voteAverage && part.voteAverage > 0 ? (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                    <StarIcon className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    {part.voteAverage.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1 p-2.5">
                <p className="line-clamp-2 text-xs font-semibold text-fg">
                  {part.title}
                </p>
                <p className="text-[11px] text-faint">
                  {part.year ?? "Release date unknown"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
