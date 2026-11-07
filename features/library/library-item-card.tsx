"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  AlertIcon,
  CheckIcon,
  FilmIcon,
  LoaderIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { getNextEpisodeNumber } from "@/features/library/continue-watching";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatMediaKind,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { LibraryItem } from "@/types/library";

function PosterFallback({ color }: { color: string | null }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: color
          ? `radial-gradient(120% 90% at 20% 0%, ${color}44 0%, var(--surface-3) 70%)`
          : "radial-gradient(120% 90% at 20% 0%, var(--surface-3) 0%, var(--surface-2) 70%)",
      }}
    >
      <FilmIcon className="h-8 w-8 text-faint/60" />
    </div>
  );
}

export function LibraryItemCard({ item }: { item: LibraryItem }) {
  const { incrementProgress, pendingIds, requestRemove, watchedEpisodesFor } =
    useLibrary();
  const { preferences } = usePreferences();
  const [imageFailed, setImageFailed] = useState(false);

  // Missing AniList metadata fallback
  if (!item.anime) {
    return (
      <article className="flex flex-col min-w-0">
        <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 border border-dashed border-border bg-surface-2/60 p-4 text-center">
          <AlertIcon className="h-5 w-5 text-faint" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Metadata unavailable
          </p>
          <p className="font-mono text-[10px] text-faint">
            ID {item.entry.anilistId}
          </p>
          <button
            type="button"
            onClick={() => requestRemove(item.entry.anilistId)}
            className="mt-2 inline-flex h-7 items-center gap-1 border border-danger/30 bg-danger-soft/30 px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-danger transition-colors hover:bg-danger-soft/60"
          >
            <TrashIcon className="h-2.5 w-2.5" />
            Remove
          </button>
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="font-display text-[13px] font-medium text-muted">
            Untitled entry
          </p>
          <div className="flex items-center gap-2 font-mono text-[10px] text-faint">
            <span className="uppercase tracking-[0.1em] text-accent-strong">
              {item.entry.status}
            </span>
            <span>·</span>
            <span className="tabular-nums">{item.entry.progress} logged</span>
          </div>
        </div>
      </article>
    );
  }

  const { anime, entry } = item;
  const title = getDisplayTitle(
    anime.title,
    preferences.titleLanguage === "english",
  );
  const cover =
    anime.coverImage.extraLarge ??
    anime.coverImage.large ??
    null;
  const manga = entry.mediaType === "manga" || anime.mediaType === "manga";
  const total = manga ? (anime.chapters ?? null) : (anime.episodes ?? null);
  const nextInfo = manga
    ? { nextEp: entry.progress + 1, atEnd: total !== null && entry.progress >= total }
    : getNextEpisodeNumber(
        entry.progress,
        watchedEpisodesFor(entry.anilistId),
        total,
      );
  const { nextEp, atEnd } = nextInfo;
  const isCompleted = entry.status === "completed" || atEnd;
  const unitShort = manga ? "ch" : "eps";
  const pending = pendingIds.has(entry.anilistId);

  const percent =
    total && total > 0
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : entry.progress > 0
        ? 100
        : 0;

  const scoreDisplay =
    typeof entry.score === "number" && entry.score > 0
      ? { value: entry.score, isPersonal: true }
      : anime.averageScore
        ? { value: formatScore(anime.averageScore), isPersonal: false }
        : null;

  const formatText = manga
    ? formatMediaKind(anime)
    : formatFormat(anime.format);
  const yearText = anime.seasonYear ? String(anime.seasonYear) : null;
  const metaSubtitle = [formatText, yearText].filter(Boolean).join(" · ");

  return (
    <article className="group relative flex min-w-0 flex-col">
      {/* Poster Artwork container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-border bg-surface-2 transition-colors group-hover:border-accent/60">
        {cover && isHttpUrl(cover) && !imageFailed ? (
          <Image
            src={cover}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PosterFallback color={anime.coverImage.color} />
        )}

        {/* Clickable Full Poster Link */}
        <Link
          href={`/media/${anime.id}`}
          aria-label={`View details for ${title}`}
          className="absolute inset-0 z-10 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />

        {/* Top Badges Row */}
        {scoreDisplay ? (
          <span className="pointer-events-none absolute left-0 top-0 z-20 inline-flex items-center gap-1 bg-bg/90 px-1.5 py-1 font-mono text-[10px] font-semibold text-fg tabular-nums">
            <StarIcon className="h-2.5 w-2.5 fill-accent text-accent" />
            <span>{scoreDisplay.value}</span>
          </span>
        ) : null}

        <span className="pointer-events-none absolute right-0 top-0 z-20 flex items-center gap-1">
          {anime.isAdult ? (
            <span className="bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-danger">
              18+
            </span>
          ) : null}
          {formatText ? (
            <span className="bg-bg/90 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              {formatText}
            </span>
          ) : null}
        </span>

        {/* Bottom Progress Telemetry on Poster with Flush Ruled Progress Bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between bg-gradient-to-t from-bg/95 via-bg/75 to-transparent px-2 pb-1.5 pt-3">
            <span className="font-mono text-[10px] font-medium tabular-nums text-fg">
              {entry.progress}
              {total ? `/${total}` : ""} {unitShort}
            </span>
            {total && total > 0 ? (
              <span className="font-mono text-[9px] tabular-nums text-faint">
                {percent}%
              </span>
            ) : null}
          </div>

          {/* Integrated Flush Progress Track */}
          <div className="h-[2px] w-full bg-border">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCompleted
                  ? "bg-success"
                  : entry.status === "on_hold"
                    ? "bg-amber-400"
                    : "bg-accent",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Information & Action Section Below Poster */}
      <div className="mt-2 flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-1 text-[8px] font-medium uppercase tracking-[0.14em] text-faint">
          <span>{metaSubtitle || "Series"}</span>
          <span
            className={cn(
              "font-semibold uppercase tracking-[0.1em]",
              isCompleted
                ? "text-success"
                : entry.status === "watching"
                  ? "text-accent-strong"
                  : "text-muted",
            )}
          >
            {entry.status}
          </span>
        </div>

        <h3 className="mt-0.5 line-clamp-1 font-display text-[13px] font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong" title={title}>
          <Link href={`/media/${anime.id}`}>{title}</Link>
        </h3>

        {/* One-tap Next Episode Stepper Action */}
        <div className="mt-2.5">
          {isCompleted ? (
            <div className="inline-flex h-7 w-full items-center justify-center gap-1.5 border border-success/30 bg-success-soft/20 text-[9px] font-semibold uppercase tracking-[0.12em] text-success">
              <CheckIcon className="h-3 w-3 shrink-0" />
              <span>
                {total
                  ? `All ${total} ${manga ? "ch read" : "eps logged"}`
                  : "Completed"}
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void incrementProgress(entry.anilistId);
              }}
              className="inline-flex h-7 w-full items-center justify-center gap-1 border border-border bg-surface/60 text-[9px] font-semibold uppercase tracking-[0.12em] text-fg transition-colors hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-50"
              aria-label={`Mark ${manga ? "chapter" : "episode"} ${nextEp} ${manga ? "read" : "watched"} for ${title}`}
            >
              {pending ? (
                <span className="inline-flex items-center gap-1">
                  <LoaderIcon className="h-2.5 w-2.5 animate-spin" />
                  <span>Saving…</span>
                </span>
              ) : (
                <>
                  <PlusIcon className="h-2.5 w-2.5" />
                  <span>
                    +1 {manga ? "Ch" : "Ep"} {nextEp}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {pending ? (
        <span className="sr-only" role="status">
          Updating {title}
        </span>
      ) : null}
    </article>
  );
}
