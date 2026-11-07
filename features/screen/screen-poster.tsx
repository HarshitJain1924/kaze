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
  const kind = kindLabel(item.kind);

  return (
    <article className={cn("group min-w-0", className)}>
      <div className="relative aspect-[2/3] overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
        {showImage ? (
          <Image
            src={item.posterUrl as string}
            alt=""
            fill
            unoptimized
            priority={priority}
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 22vw, 16vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
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

        <Link
          href={`/screen/${item.kind}/${item.tmdbId}`}
          aria-label={`View details for ${item.title}`}
          className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />

        {item.voteAverage && item.voteAverage > 0 ? (
          <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
            <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
            {item.voteAverage.toFixed(1)}
          </span>
        ) : null}

        <span className="pointer-events-none absolute bottom-0 right-0 z-20 bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
          {kind}
        </span>
      </div>

      <div className="mt-2">
        <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-faint">
          {[kind, item.year].filter(Boolean).join(" / ")}
        </p>
        <h3
          className="mt-0.5 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong"
          title={item.title}
        >
          <Link href={`/screen/${item.kind}/${item.tmdbId}`}>
            {item.title}
          </Link>
        </h3>
      </div>
    </article>
  );
}
