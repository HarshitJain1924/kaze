"use client";

import Image from "next/image";
import Link from "next/link";

import { PlayIcon, PlusIcon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatEpisodeCount,
  getDisplayTitle,
  isHttpUrl,
  pluralize,
} from "@/lib/utils";

export function ContinueWatching() {
  const { items, incrementProgress, pendingIds } = useLibrary();
  const { preferences } = usePreferences();

  const watching = items
    .filter(
      (item) =>
        item.entry.status === "watching" && item.anime !== null,
    )
    .sort(
      (a, b) =>
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime(),
    )
    .slice(0, 6);

  return (
    <section aria-label="Continue watching">
      <SectionHeader
        title="Continue watching"
        action={watching.length > 0 ? "My library" : undefined}
        actionHref="/library"
      />

      {watching.length === 0 ? (
        <EmptyState
          icon={<PlayIcon className="h-5 w-5" />}
          title="Nothing in progress"
          description="Mark an anime as Watching and it will appear here with one-tap episode updates."
          action={
            <Link
              href="/discover"
              className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 px-3 text-[13px] font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-3"
            >
              Browse anime
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {watching.map(({ entry, anime }) => {
            if (!anime) {
              return null;
            }
            const title = getDisplayTitle(
              anime.title,
              preferences.titleLanguage === "english",
            );
            const cover =
              anime.coverImage.extraLarge ?? anime.coverImage.large;
            const total = anime.episodes;
            const percent =
              total && total > 0
                ? Math.min(100, Math.round((entry.progress / total) * 100))
                : 0;
            const atEnd = total !== null && total > 0 && entry.progress >= total;

            return (
              <div
                key={entry.id}
                className="group flex gap-3 rounded-2xl border border-border-subtle bg-surface p-2.5 transition-colors hover:border-border"
              >
                <Link
                  href={`/anime/${anime.id}`}
                  className="relative block h-[104px] w-[70px] shrink-0 overflow-hidden rounded-lg bg-surface-2"
                  aria-label={`Open ${title}`}
                >
                  {cover && isHttpUrl(cover) ? (
                    <Image
                      src={cover}
                      alt=""
                      fill
                      sizes="70px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : null}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/anime/${anime.id}`}
                    className="line-clamp-2-safe text-sm font-semibold leading-snug text-fg transition-colors hover:text-accent-strong"
                  >
                    {title}
                  </Link>
                  <p className="mt-1 text-xs text-faint">
                    {total !== null
                      ? formatEpisodeCount(total, { short: true })
                      : "Episode count unknown"}
                    {total !== null && total > 0
                      ? ` · ${percent}% complete`
                      : ""}
                  </p>

                  <div className="mt-auto space-y-2 pt-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span className="tabular-nums">
                        Episode {entry.progress}
                        {total ? ` of ${total}` : ""}
                      </span>
                      <span>
                        {entry.progress > 0
                          ? `${entry.progress} ${pluralize(entry.progress, "episode")} watched`
                          : "Not started"}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      disabled={pendingIds.has(anime.id) || atEnd}
                      onClick={() => void incrementProgress(anime.id)}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      {atEnd ? "Finished" : "Watch next episode"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
