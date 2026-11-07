import Image from "next/image";
import Link from "next/link";

import { FilmIcon, StarIcon } from "@/components/icons";
import { universePositionLabel, universeUnitLabel } from "@/lib/tmdb/universes";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbKind, TmdbUniverse } from "@/types/tmdb";

/**
 * Release-order watch list for a shared universe (MCU, Star Wars, DC). The
 * title being viewed is highlighted so its place in the run is obvious, which
 * a single TMDB collection cannot show across sub-franchises.
 */
export function TmdbUniverseSection({
  universe,
  kind,
  currentTmdbId,
}: {
  universe: TmdbUniverse;
  kind: TmdbKind;
  currentTmdbId: number;
}) {
  if (universe.entries.length === 0) return null;

  const unit = universeUnitLabel(kind, universe.total);
  const href = (tmdbId: number) =>
    `/screen/${kind === "movie" ? "movie" : "tv"}/${tmdbId}`;

  return (
    <section aria-labelledby="universe-heading" className="space-y-4">
      <div className="border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <h2
            id="universe-heading"
            className="font-display text-lg font-semibold text-fg"
          >
            Watch Order
          </h2>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">
            {universe.total}
          </span>
          {universe.position ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
              You&apos;re on {universePositionLabel(universe.position, universe.total)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          {universe.label} · {universe.total} {unit}, ordered by release date.
          That is the order fans usually watch a universe through.
        </p>
      </div>

      <ol className="space-y-2">
        {universe.entries.map((entry, index) => {
          const current = entry.tmdbId === currentTmdbId;
          const position = index + 1;
          const poster =
            entry.posterUrl && isHttpUrl(entry.posterUrl)
              ? entry.posterUrl
              : null;
          const rating =
            entry.voteAverage && entry.voteAverage > 0
              ? entry.voteAverage.toFixed(1)
              : null;

          return (
            <li
              key={entry.tmdbId}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200",
                current
                  ? "border-accent/60 bg-accent-soft/30 ring-1 ring-accent/25 shadow-sm"
                  : "border-border-subtle bg-surface/90 hover:border-border hover:bg-surface",
              )}
            >
              <span
                className={cn(
                  "w-6 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums",
                  current ? "text-accent-strong" : "text-faint",
                )}
                aria-hidden
              >
                {position}
              </span>

              <Link
                href={href(entry.tmdbId)}
                aria-current={current ? "page" : undefined}
                className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-3"
              >
                {poster ? (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    unoptimized
                    sizes="36px"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <FilmIcon className="h-3.5 w-3.5 text-faint/60" />
                  </span>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={href(entry.tmdbId)}
                  className={cn(
                    "block line-clamp-1 text-xs font-semibold transition-colors sm:text-[13px]",
                    current
                      ? "text-accent-strong"
                      : "text-fg hover:text-accent-strong",
                  )}
                  title={entry.title}
                >
                  {entry.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span className="text-faint">
                    {entry.year ?? "Year unknown"}
                  </span>
                  {rating ? (
                    <span className="flex items-center gap-0.5 font-medium text-warning">
                      <StarIcon className="h-3 w-3 fill-warning text-warning" />
                      {rating}
                    </span>
                  ) : null}
                </div>
              </div>

              {current ? (
                <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-contrast">
                  Viewing
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {universe.entries.length < universe.total ? (
        <p className="text-[11px] text-faint">
          Showing the first {universe.entries.length} of {universe.total}{" "}
          {unit} in the universe.
        </p>
      ) : null}
    </section>
  );
}
