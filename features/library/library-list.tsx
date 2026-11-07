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
import { getNextEpisodeNumber } from "@/features/library/continue-watching";
import { useLibrary } from "@/features/library/library-provider";
import { getWatchStatusLabel } from "@/lib/library-meta";
import {
  cn,
  formatFormat,
  formatMediaKind,
  formatShortIsoDate,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

export type UnifiedLibraryItem =
  | { kind: "anilist"; item: LibraryItem }
  | { kind: "screen"; item: TmdbLibraryItem };

export type LibraryListItem = LibraryItem | UnifiedLibraryItem;

function isUnifiedItem(item: LibraryListItem): item is UnifiedLibraryItem {
  return "kind" in item && (item.kind === "anilist" || item.kind === "screen");
}

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

export function LibraryList({ items }: { items: LibraryListItem[] }) {
  const { incrementProgress, requestRemove, pendingIds, watchedEpisodesFor } =
    useLibrary();
  const { preferences } = usePreferences();

  return (
    <ul className="divide-y divide-border border-y border-border" role="list">
      {items.map((rawItem) => {
        if (isUnifiedItem(rawItem) && rawItem.kind === "screen") {
          const { entry, watchedCount } = rawItem.item;
          const total = entry.totalEpisodes ?? 0;
          const isMovie = entry.mediaType === "movie";
          const percent =
            !isMovie && total > 0
              ? Math.min(100, Math.round((watchedCount / total) * 100))
              : isMovie && entry.watched
                ? 100
                : 0;
          const isCompleted =
            (isMovie && entry.watched) ||
            (!isMovie && total > 0 && watchedCount >= total) ||
            entry.status === "completed";

          return (
            <li
              key={`screen:${entry.id}`}
              className="group flex flex-col gap-4 py-4 sm:flex-row sm:items-start"
            >
              {/* Thumbnail Poster */}
              <Link
                href={`/screen/${entry.mediaType}/${entry.tmdbId}`}
                className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-24"
                aria-label={`Open details for ${entry.title}`}
              >
                {entry.posterPath && isHttpUrl(entry.posterPath) ? (
                  <Image
                    src={entry.posterPath}
                    alt=""
                    fill
                    unoptimized
                    sizes="96px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-3">
                    <FilmIcon className="h-6 w-6 text-faint/60" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-full bg-border">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      isCompleted ? "bg-success" : "bg-accent",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </Link>

              {/* Central Information & Progress Column */}
              <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                      {[
                        isMovie ? "Film" : "Series",
                        entry.releaseDate ? entry.releaseDate.slice(0, 4) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {entry.score ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-400 tabular-nums">
                        <StarIcon className="h-2.5 w-2.5 fill-current" />
                        {entry.score}/10
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "text-[9px] font-semibold uppercase tracking-[0.14em]",
                        isCompleted
                          ? "text-success"
                          : entry.status === "watching"
                            ? "text-accent-strong"
                            : "text-muted",
                      )}
                    >
                      · {getWatchStatusLabel(entry.status)}
                    </span>
                  </div>

                  <h3 className="mt-1 font-display text-base font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong">
                    <Link href={`/screen/${entry.mediaType}/${entry.tmdbId}`}>
                      {entry.title}
                    </Link>
                  </h3>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] tabular-nums text-fg">
                      {isMovie
                        ? entry.watched
                          ? "Watched"
                          : "Not watched"
                        : `${watchedCount}${total ? ` / ${total}` : ""} episodes (${percent}%)`}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                      Updated {formatShortIsoDate(entry.updatedAt)}
                    </span>
                  </div>

                  <div className="h-[2px] w-full bg-border">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        isCompleted ? "bg-success" : "bg-accent",
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Action Controls Column */}
              <div className="flex items-center justify-end gap-2 pt-1 sm:flex-col sm:items-end sm:justify-start sm:pt-0">
                <Link
                  href={`/screen/${entry.mediaType}/${entry.tmdbId}`}
                  className="flex h-8 w-8 items-center justify-center border border-border bg-surface text-faint transition-colors hover:border-accent hover:text-fg"
                  aria-label={`View details for ${entry.title}`}
                  title="View details"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          );
        }

        const item = isUnifiedItem(rawItem) ? rawItem.item : rawItem;
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
        const manga = entry.mediaType === "manga" || anime?.mediaType === "manga";
        const total = manga ? (anime?.chapters ?? null) : (anime?.episodes ?? null);
        const nextInfo = manga
          ? { nextEp: entry.progress + 1, atEnd: total !== null && entry.progress >= total }
          : getNextEpisodeNumber(
              entry.progress,
              watchedEpisodesFor(entry.anilistId),
              total,
            );
        const { nextEp, atEnd } = nextInfo;
        const isCompleted = entry.status === "completed" || atEnd;
        const unitShort = manga ? "chapters" : "episodes";
        const percent =
          total && total > 0
            ? Math.min(100, Math.round((entry.progress / total) * 100))
            : entry.progress > 0
              ? 100
              : 0;
        const pending = pendingIds.has(entry.anilistId);

        const formatText = anime
          ? manga
            ? formatMediaKind(anime)
            : formatFormat(anime.format)
          : null;
        const yearText = anime?.seasonYear ? String(anime.seasonYear) : null;

        return (
          <li
            key={`anilist:${entry.id}`}
            className="group flex flex-col gap-4 py-4 sm:flex-row sm:items-start"
          >
            {/* Thumbnail Poster */}
            <Link
              href={`/media/${entry.anilistId}`}
              className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-24"
              aria-label={`Open details for ${title}`}
            >
              {cover && isHttpUrl(cover) ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  unoptimized
                  sizes="96px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <PosterFallback color={anime?.coverImage?.color ?? null} />
              )}

              {/* Flush bottom progress bar */}
              <div className="absolute inset-x-0 bottom-0 h-[2px] w-full bg-border">
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
            </Link>

            {/* Central Information & Progress Column */}
            <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                    {[formatText, yearText].filter(Boolean).join(" · ") || "Series"}
                  </span>
                  {entry.score ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-400 tabular-nums">
                      <StarIcon className="h-2.5 w-2.5 fill-current" />
                      {entry.score}/10
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-[0.14em]",
                      isCompleted
                        ? "text-success"
                        : entry.status === "watching"
                          ? "text-accent-strong"
                          : "text-muted",
                    )}
                  >
                    · {entry.status}
                  </span>
                </div>

                <h3 className="mt-1 font-display text-base font-medium leading-snug text-fg transition-colors group-hover:text-accent-strong">
                  <Link href={`/media/${entry.anilistId}`}>{title}</Link>
                </h3>
              </div>

              {/* Episode Progress Bar & Timeline */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] tabular-nums text-fg">
                    {entry.progress}
                    {total ? ` / ${total}` : ""} {unitShort} {manga ? "read" : "watched"}
                    {total && total > 0 ? ` (${percent}%)` : ""}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                    Updated {formatShortIsoDate(entry.updatedAt)}
                  </span>
                </div>

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

            {/* Right Action Controls Column */}
            <div className="flex items-center justify-end gap-2 pt-1 sm:flex-col sm:items-end sm:justify-start sm:pt-0">
              {isCompleted ? (
                <div className="inline-flex h-8 items-center gap-1.5 border border-success/30 bg-success-soft/20 px-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-success">
                  <CheckIcon className="h-3 w-3" />
                  <span>Finished</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void incrementProgress(entry.anilistId)}
                  className="inline-flex h-8 items-center gap-1.5 border border-border bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg transition-colors hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-50"
                  aria-label={`Add one ${manga ? "read chapter" : "watched episode"} to ${title}`}
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LoaderIcon className="h-3 w-3 animate-spin" />
                      <span>Saving…</span>
                    </span>
                  ) : (
                    <>
                      <PlusIcon className="h-3 w-3" />
                      <span>
                        +1 {manga ? "Ch" : "Ep"} {nextEp}
                      </span>
                    </>
                  )}
                </button>
              )}

              <div className="flex items-center gap-1">
                <Link
                  href={`/media/${entry.anilistId}`}
                  className="flex h-8 w-8 items-center justify-center border border-border bg-surface text-faint transition-colors hover:border-accent hover:text-fg"
                  aria-label={`View full details for ${title}`}
                  title="View details"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => requestRemove(entry.anilistId)}
                  aria-label={`Remove ${title} from library`}
                  title="Remove from library"
                  className="flex h-8 w-8 items-center justify-center border border-border bg-surface text-faint transition-colors hover:border-danger/40 hover:bg-danger-soft/20 hover:text-danger"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
