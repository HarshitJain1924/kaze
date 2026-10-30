"use client";

import Image from "next/image";
import Link from "next/link";

import {
  CheckIcon,
  ChevronRightIcon,
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
  formatEpisodeCount,
  formatFormat,
  formatShortIsoDate,
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
      <FilmIcon className="h-6 w-6 text-faint/60" />
    </div>
  );
}

export function LibraryList({ items }: { items: LibraryItem[] }) {
  const { incrementProgress, requestRemove, pendingIds, watchedEpisodesFor } =
    useLibrary();
  const { preferences } = usePreferences();

  return (
    <ul className="space-y-3" role="list">
      {items.map((item) => {
        const { entry, anime } = item;
        const title = anime
          ? getDisplayTitle(
              anime.title,
              preferences.titleLanguage === "english",
            )
          : "Untitled entry";
        const cover = anime
          ? anime.coverImage.extraLarge ?? anime.coverImage.large ?? null
          : null;
        const total = anime?.episodes ?? null;
        const { nextEp, atEnd } = getNextEpisodeNumber(
          entry.progress,
          watchedEpisodesFor(entry.anilistId),
          total,
        );
        const isCompleted = entry.status === "completed" || atEnd;
        const percent =
          total && total > 0
            ? Math.min(100, Math.round((entry.progress / total) * 100))
            : entry.progress > 0
              ? 100
              : 0;
        const pending = pendingIds.has(entry.anilistId);

        const formatText = anime ? formatFormat(anime.format) : null;
        const yearText = anime?.seasonYear ? String(anime.seasonYear) : null;

        return (
          <li
            key={entry.id}
            className="group relative flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface/70 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 backdrop-blur-md transition-all duration-200 hover:border-white/[0.18] hover:bg-surface-2/80 hover:shadow-lg"
          >
            {/* Thumbnail Poster */}
            <Link
              href={`/anime/${entry.anilistId}`}
              className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-3 shadow-sm transition-transform duration-200 group-hover:scale-[1.02]"
              aria-label={`Open details for ${title}`}
            >
              {cover && isHttpUrl(cover) ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <PosterFallback color={anime?.coverImage?.color ?? null} />
              )}
              {/* Integrated Bottom Progress Bar on Thumbnail */}
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    isCompleted
                      ? "bg-emerald-400"
                      : entry.status === "on_hold"
                        ? "bg-amber-400"
                        : "bg-accent-strong",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </Link>

            {/* Central Information & Progress Column */}
            <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/anime/${entry.anilistId}`}
                    className="line-clamp-1 font-display text-sm font-semibold text-fg transition-colors hover:text-accent-strong sm:text-base"
                  >
                    {title}
                  </Link>
                  <StatusBadge status={entry.status} className="shrink-0" />
                </div>

                {/* Subtitle Metadata Chips */}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                  {formatText && (
                    <span className="rounded-md border border-white/10 bg-surface-3/60 px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      {formatText}
                    </span>
                  )}
                  {yearText && <span>{yearText}</span>}
                  {total ? (
                    <span>· {formatEpisodeCount(total, { short: true })}</span>
                  ) : null}
                  {entry.score ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                      · <StarIcon className="h-3 w-3 fill-current" />
                      {entry.score}/10
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Episode Progress Bar & Timeline */}
              <div className="mt-3 space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-medium tabular-nums text-fg">
                    {entry.progress}
                    {total ? ` / ${total}` : ""} episodes watched
                    {total && total > 0 ? ` (${percent}%)` : ""}
                  </span>
                  <span className="text-[11px] text-faint">
                    Updated {formatShortIsoDate(entry.updatedAt)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
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

            {/* Right Action Controls Column */}
            <div className="flex items-center justify-end gap-2 pt-1 sm:flex-col sm:justify-center sm:pt-0">
              {isCompleted ? (
                <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400">
                  <CheckIcon className="h-3.5 w-3.5" />
                  <span>Finished</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void incrementProgress(entry.anilistId)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3.5 text-xs font-semibold text-fg transition-all duration-150 hover:border-accent hover:bg-accent hover:text-white active:scale-95 disabled:opacity-50"
                  aria-label={`Add one watched episode to ${title}`}
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving…</span>
                    </span>
                  ) : (
                    <>
                      <PlusIcon className="h-3.5 w-3.5 text-accent-strong" />
                      <span>+ Ep {nextEp}</span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center gap-1">
                <Link
                  href={`/anime/${entry.anilistId}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-surface-2 text-faint transition-colors hover:border-white/20 hover:text-fg"
                  aria-label={`View full details for ${title}`}
                  title="View anime details"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => requestRemove(entry.anilistId)}
                  aria-label={`Remove ${title} from library`}
                  title="Remove from library"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-faint transition-colors hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
