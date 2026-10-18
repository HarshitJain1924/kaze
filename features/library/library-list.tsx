"use client";

import Image from "next/image";
import Link from "next/link";

import {
  AlertIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatEpisodeCount,
  formatFormat,
  formatShortIsoDate,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { LibraryItem } from "@/types/library";

export function LibraryList({ items }: { items: LibraryItem[] }) {
  const { incrementProgress, requestRemove, pendingIds } = useLibrary();
  const { preferences } = usePreferences();

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const { entry, anime } = item;
        const title = anime
          ? getDisplayTitle(
              anime.title,
              preferences.titleLanguage === "english",
            )
          : "Untitled entry";
        const cover = anime
          ? (anime.coverImage.extraLarge ?? anime.coverImage.large)
          : null;
        const total = anime?.episodes ?? null;
        const percent =
          total && total > 0
            ? Math.min(100, Math.round((entry.progress / total) * 100))
            : 0;
        const atEnd = total !== null && total > 0 && entry.progress >= total;

        return (
          <li
            key={entry.id}
            className="flex items-stretch gap-3 rounded-xl border border-border-subtle bg-surface p-3 transition-colors hover:border-border"
          >
            <Link
              href={`/anime/${entry.anilistId}`}
              className="relative block h-[88px] w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2"
              aria-label={`Open ${title}`}
            >
              {cover && isHttpUrl(cover) ? (
                <Image
                  src={cover}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-faint">
                  <AlertIcon className="h-4 w-4" />
                </span>
              )}
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/anime/${entry.anilistId}`}
                  className="line-clamp-1 text-sm font-semibold text-fg transition-colors hover:text-accent-strong"
                >
                  {title}
                </Link>
                <StatusBadge status={entry.status} className="shrink-0" />
              </div>

              <p className="mt-1 text-[11px] text-faint">
                {anime
                  ? [
                      formatFormat(anime.format),
                      anime.seasonYear ? String(anime.seasonYear) : null,
                      formatEpisodeCount(total, { short: true }),
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "AniList metadata unavailable"}
              </p>

              <div className="mt-auto space-y-1.5 pt-2">
                <div className="flex items-center gap-3 text-[11px] text-muted">
                  <span className="tabular-nums">
                    {entry.progress}
                    {total ? ` / ${total}` : ""} episodes
                  </span>
                  {entry.score ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <StarIcon className="h-3 w-3 fill-current" />
                      {entry.score}
                    </span>
                  ) : null}
                  <span className="ml-auto text-faint">
                    {formatShortIsoDate(entry.updatedAt)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => requestRemove(entry.anilistId)}
                aria-label={`Remove ${title} from library`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
              {!atEnd ? (
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={pendingIds.has(entry.anilistId)}
                  onClick={() => void incrementProgress(entry.anilistId)}
                  aria-label={`Add one watched episode to ${title}`}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
