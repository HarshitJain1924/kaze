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
import { StatusBadge } from "@/components/ui/badge";
import { getNextEpisodeNumber } from "@/features/library/continue-watching";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
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
      <article className="flex flex-col">
        <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2/60 p-4 text-center">
          <AlertIcon className="h-6 w-6 text-faint" />
          <p className="text-xs font-semibold text-muted">Metadata unavailable</p>
          <p className="text-[11px] text-faint">
            AniList ID {item.entry.anilistId}
          </p>
          <button
            type="button"
            onClick={() => requestRemove(item.entry.anilistId)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/20"
          >
            <TrashIcon className="h-3 w-3" />
            Remove
          </button>
        </div>
        <div className="mt-2.5 space-y-1">
          <p className="text-sm font-semibold text-muted">Untitled entry</p>
          <div className="flex items-center gap-2 text-xs text-faint">
            <StatusBadge status={item.entry.status} />
            <span className="tabular-nums">{item.entry.progress} watched</span>
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
  const total = anime.episodes ?? null;
  const { nextEp, atEnd } = getNextEpisodeNumber(
    entry.progress,
    watchedEpisodesFor(entry.anilistId),
    total,
  );
  const isCompleted = entry.status === "completed" || atEnd;
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

  const formatText = formatFormat(anime.format);
  const yearText = anime.seasonYear ? String(anime.seasonYear) : null;
  const metaSubtitle = [formatText, yearText].filter(Boolean).join(" · ");

  return (
    <article className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-surface/70 p-2.5 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-white/[0.18] hover:bg-surface-2/80 hover:shadow-xl">
      {/* Poster Artwork container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface-3">
        {cover && isHttpUrl(cover) && !imageFailed ? (
          <Image
            src={cover}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 20vw, 16vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PosterFallback color={anime.coverImage.color} />
        )}

        {/* Ambient Dark Scrim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent"
        />

        {/* Clickable Full Poster Link */}
        <Link
          href={`/anime/${anime.id}`}
          aria-label={`View details for ${title}`}
          className="absolute inset-0 z-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent"
        />

        {/* Top Badges Row */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-1">
          {scoreDisplay ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold backdrop-blur-md shadow-xs tabular-nums",
                scoreDisplay.isPersonal
                  ? "border-amber-400/40 bg-black/80 text-amber-300"
                  : "border-white/15 bg-black/75 text-amber-300/90",
              )}
            >
              <StarIcon className="h-3 w-3 fill-current" />
              <span>{scoreDisplay.value}</span>
            </span>
          ) : (
            <span />
          )}

          {formatText && (
            <span className="rounded-md border border-white/15 bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
              {formatText}
            </span>
          )}
        </div>

        {/* Bottom Progress Telemetry on Poster */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="flex items-center justify-between px-2.5 pb-2 text-[11px] font-medium text-white/90 drop-shadow-sm">
            <span className="tabular-nums">
              {entry.progress}
              {total ? ` / ${total}` : ""} eps
            </span>
            {total && total > 0 ? (
              <span className="text-[10px] font-bold tabular-nums text-white/75">
                {percent}%
              </span>
            ) : null}
          </div>

          {/* Integrated Flush Progress Track */}
          <div className="h-1.5 w-full overflow-hidden bg-white/20">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCompleted
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : entry.status === "on_hold"
                    ? "bg-amber-400"
                    : "bg-accent-strong shadow-[0_0_8px_rgba(167,139,250,0.8)]",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Information & Action Section Below Poster */}
      <div className="mt-2.5 flex flex-1 flex-col">
        <Link
          href={`/anime/${anime.id}`}
          className="line-clamp-1 font-display text-[13px] font-semibold text-fg transition-colors hover:text-accent-strong sm:text-sm"
          title={title}
        >
          {title}
        </Link>

        <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-faint">
          <span>{metaSubtitle || "Series"}</span>
          <StatusBadge
            status={entry.status}
            className="border-0 bg-transparent px-0 py-0 text-[11px]"
          />
        </div>

        {/* One-tap Next Episode Stepper Action */}
        <div className="mt-3 pt-0.5">
          {isCompleted ? (
            <div className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-400">
              <CheckIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{total ? `All ${total} eps watched` : "Completed"}</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void incrementProgress(entry.anilistId);
              }}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-2 text-xs font-semibold text-fg transition-all duration-150 hover:border-accent hover:bg-accent hover:text-white active:scale-95 disabled:opacity-50"
              aria-label={`Mark episode ${nextEp} watched for ${title}`}
            >
              {pending ? (
                <span className="inline-flex items-center gap-1.5">
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </span>
              ) : (
                <>
                  <PlusIcon className="h-3.5 w-3.5 text-accent-strong" />
                  <span>Episode {nextEp}</span>
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
