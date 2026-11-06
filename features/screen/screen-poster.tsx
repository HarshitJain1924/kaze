"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { FilmIcon, StarIcon } from "@/components/icons";
import { cn, isHttpUrl } from "@/lib/utils";
import type { TmdbSearchResult } from "@/types/tmdb";

export function kindLabel(kind: TmdbSearchResult["kind"]): string {
  return kind === "movie" ? "Film" : "TV";
}

export function ScreenPoster({
  item,
  priority = false,
  className,
}: {
  item: TmdbSearchResult;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = item.posterUrl && isHttpUrl(item.posterUrl) && !failed;

  return (
    <article
      className={cn(
        "group relative flex aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl",
        className,
      )}
    >
      {showImage ? (
        <Image
          src={item.posterUrl as string}
          alt=""
          fill
          unoptimized
          priority={priority}
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 22vw, 16vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_20%_0%,var(--surface-3)_0%,var(--surface-2)_70%)]"
        >
          <FilmIcon className="h-8 w-8 text-faint/60" />
        </div>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"
      />

      <Link
        href={`/screen/${item.kind}/${item.tmdbId}`}
        aria-label={`View details for ${item.title}`}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent"
      />

      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-1">
        {item.voteAverage && item.voteAverage > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md shadow-xs tabular-nums">
            <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
            {item.voteAverage.toFixed(1)}
          </span>
        ) : (
          <span />
        )}
        <span className="rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-md">
          {kindLabel(item.kind)}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 space-y-1 p-2.5">
        <h3 className="line-clamp-2 font-display text-xs font-bold leading-snug text-white drop-shadow-sm sm:text-[13px]">
          {item.title}
        </h3>
        <p className="text-[10px] font-medium text-white/70">
          {[item.kind === "movie" ? "Film" : "Series", item.year]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </article>
  );
}
