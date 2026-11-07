"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { FilmIcon, PlusIcon, StarIcon } from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatMediaKind,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

function isHexColor(value: string | null): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function PosterFallback({ color }: { color: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isHexColor(color)
          ? `radial-gradient(120% 90% at 20% 0%, ${color}44 0%, var(--surface-3) 70%)`
          : "radial-gradient(120% 90% at 20% 0%, var(--surface-3) 0%, var(--surface-2) 70%)",
      }}
    >
      <FilmIcon className="h-8 w-8 text-faint/60" />
    </div>
  );
}

export interface AnimePosterCardProps {
  anime: AnimeSummary;
  /** `below` or `overlay` mode. Defaults to compact sleek overlay mode. */
  metaMode?: "overlay" | "below";
  priority?: boolean;
  showQuickAdd?: boolean;
  className?: string;
  sizes?: string;
  /** Optional row under the title and metadata */
  footer?: ReactNode;
  variant?: "default" | "editorial";
}

export function AnimePosterCard({
  anime,
  priority = false,
  showQuickAdd = true,
  className,
  sizes = "(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 22vw, 16vw",
  footer,
  variant = "default",
}: AnimePosterCardProps) {
  const { entryFor, requestAdd, pendingIds } = useLibrary();
  const { preferences } = usePreferences();

  const [imageFailed, setImageFailed] = useState(false);
  const entry = entryFor(anime.id);
  const title = getDisplayTitle(
    anime.title,
    preferences.titleLanguage === "english",
  );
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const score = formatScore(anime.averageScore);
  const manga = isManga(anime);
  const formatLabel = manga
    ? formatMediaKind(anime)
    : formatFormat(anime.format);
  const yearText = anime.seasonYear ? String(anime.seasonYear) : null;
  const meta = [formatLabel, yearText].filter(Boolean).join(" · ");
  const totalUnits = manga ? (anime.chapters ?? null) : anime.episodes;
  const unitShort = manga ? "ch" : "ep";
  const percent =
    entry && totalUnits && totalUnits > 0
      ? Math.min(100, Math.round((entry.progress / totalUnits) * 100))
      : entry && entry.progress > 0
        ? 100
        : 0;

  if (variant === "editorial") {
    return (
      <article className={cn("group relative min-w-0", className)}>
        <div className="relative aspect-[2/3] overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
          {cover && isHttpUrl(cover) && !imageFailed ? (
            <Image
              src={cover}
              alt=""
              fill
              unoptimized
              sizes={sizes}
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <PosterFallback color={anime.coverImage.color} />
          )}

          <Link
            href={`/media/${anime.id}`}
            aria-label={`View details for ${title}`}
            className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />

          {score ? (
            <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
              <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
              {score}
            </span>
          ) : null}

          <span className="pointer-events-none absolute right-0 top-0 z-20 flex items-center gap-1">
            {anime.isAdult ? (
              <span className="bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-danger">
                18+
              </span>
            ) : null}
            {formatLabel ? (
              <span className="bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
                {formatLabel}
              </span>
            ) : null}
          </span>

          {showQuickAdd && !entry ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                requestAdd(anime);
              }}
              aria-label={`Add ${title} to your library`}
              className="absolute bottom-0 right-0 z-20 flex h-7 w-7 items-center justify-center bg-bg/90 text-fg transition-colors hover:bg-accent hover:text-accent-contrast sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
            >
              <PlusIcon className="h-3 w-3" />
            </button>
          ) : null}

          {entry ? (
            <span className="pointer-events-none absolute bottom-0 left-0 z-20 bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              {entry.status}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-faint">
              {meta || "Catalogue"}
            </p>
            <h3
              className="mt-0.5 line-clamp-2 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong"
              title={title}
            >
              <Link href={`/media/${anime.id}`}>
                {title}
              </Link>
            </h3>
          </div>
          {entry && totalUnits ? (
            <span className="shrink-0 pt-3 font-mono text-[9px] text-faint tabular-nums">
              {entry.progress}/{totalUnits}
            </span>
          ) : null}
        </div>

        {entry && totalUnits && percent > 0 ? (
          <div className="mt-1.5 h-[2px] w-full bg-border">
            <div
              className={cn(
                "h-full",
                entry.status === "completed" ? "bg-success" : "bg-accent",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}

        {footer}
      </article>
    );
  }

  // Modern compact poster card: poster is the card, clean overlay at bottom, no elongated box
  return (
    <article
      className={cn(
        "group relative flex aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl",
        className,
      )}
    >
      {/* Poster Image */}
      {cover && isHttpUrl(cover) && !imageFailed ? (
        <Image
          src={cover}
          alt=""
          fill
          unoptimized
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <PosterFallback color={anime.coverImage.color} />
      )}

      {/* Atmospheric Dark Scrim Overlay at Bottom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent"
      />

      {/* Full Poster Clickable Link */}
      <Link
        href={`/media/${anime.id}`}
        aria-label={`View details for ${title}`}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent"
      />

      {/* Top Badges Row */}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-1">
        {score ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-md shadow-xs tabular-nums">
            <StarIcon className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span>{score}</span>
          </span>
        ) : (
          <span />
        )}

        <span className="flex items-center gap-1">
          {anime.isAdult ? (
            <span className="rounded-md border border-rose-400/40 bg-black/85 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 backdrop-blur-md">
              18+
            </span>
          ) : null}
          {formatLabel ? (
            <span className="rounded-md border border-white/15 bg-black/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-md shadow-xs">
              {formatLabel}
            </span>
          ) : null}
        </span>
      </div>

      {/* Quick Add floating action button on hover */}
      {showQuickAdd && !entry ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            requestAdd(anime);
          }}
          aria-label={`Add ${title} to your library`}
          className="absolute right-2 top-9 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white shadow-md opacity-90 transition-all hover:scale-110 hover:border-accent hover:bg-accent hover:text-accent-contrast active:scale-95 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {/* Bottom Content overlaid cleanly inside the poster */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2.5 pt-10 space-y-1">
        {entry ? (
          <div className="flex items-center gap-1.5">
            <StatusBadge
              status={entry.status}
              mediaType={anime.mediaType}
              className="border-white/15 bg-black/80 text-[10px] text-white/95 backdrop-blur-sm px-1.5 py-0.5"
            />
            {totalUnits && totalUnits > 0 ? (
              <span className="text-[10px] font-semibold text-white/85 tabular-nums">
                {entry.progress}/{totalUnits} {unitShort}
              </span>
            ) : null}
          </div>
        ) : null}

        <h3
          className="line-clamp-2 font-display text-xs sm:text-[13px] font-bold leading-snug text-white transition-colors group-hover:text-accent-strong drop-shadow-sm"
          title={title}
        >
          {title}
        </h3>

        <div className="flex items-center justify-between text-[10px] font-medium text-white/70">
          <span>{meta}</span>
          {entry && totalUnits && totalUnits > 0 ? (
            <span className="tabular-nums text-white/60">{percent}%</span>
          ) : null}
        </div>

        {/* Flush progress line on poster */}
        {entry && totalUnits && totalUnits > 0 ? (
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/20 mt-1">
            <div
              className={cn(
                "h-full transition-all duration-300",
                entry.status === "completed"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-accent-strong shadow-[0_0_8px_rgba(167,139,250,0.8)]",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>

      {footer ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20">
          {footer}
        </div>
      ) : null}

      {pendingIds.has(anime.id) ? (
        <span className="sr-only" role="status">
          Updating {title}
        </span>
      ) : null}
    </article>
  );
}
