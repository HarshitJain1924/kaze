"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  ChevronRightIcon,
  LoaderIcon,
  PlusIcon,
  SparkIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatRelationType,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import type { Anime, RelatedAnime } from "@/types/anime";

interface AnimeFranchiseSectionProps {
  currentAnime: Anime;
}

type FranchiseFilter = "all" | "main" | "side";

export function AnimeFranchiseSection({
  currentAnime,
}: AnimeFranchiseSectionProps) {
  const { preferences } = usePreferences();
  const { entryFor, addToLibrary } = useLibrary();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FranchiseFilter>("all");
  const [addingId, setAddingId] = useState<number | null>(null);

  const preferEnglish = preferences.titleLanguage === "english";

  // Build the complete franchise list including current anime in chronological sequence
  const { mainStoryline, sideStories, allItems, prequel, sequel } =
    useMemo(() => {
      const prequels: RelatedAnime[] = [];
      const sequels: RelatedAnime[] = [];
      const side: RelatedAnime[] = [];
      const others: RelatedAnime[] = [];

      for (const rel of currentAnime.relations) {
        const type = rel.relationType;
        if (type === "PREQUEL") {
          prequels.push(rel);
        } else if (type === "SEQUEL") {
          sequels.push(rel);
        } else if (
          type === "SIDE_STORY" ||
          type === "SPIN_OFF" ||
          rel.format === "MOVIE" ||
          rel.format === "OVA" ||
          rel.format === "SPECIAL"
        ) {
          side.push(rel);
        } else {
          others.push(rel);
        }
      }

      // Sort prequels chronologically ascending
      prequels.sort((a, b) => (a.seasonYear ?? 0) - (b.seasonYear ?? 0));
      // Sort sequels chronologically ascending
      sequels.sort((a, b) => (a.seasonYear ?? 0) - (b.seasonYear ?? 0));

      // Immediate prequel and sequel for quick navigation
      const immediatePrequel = prequels[prequels.length - 1] ?? null;
      const immediateSequel = sequels[0] ?? null;

      // Current anime formatted as a RelatedAnime entry
      const currentEntry: RelatedAnime = {
        id: currentAnime.id,
        title: currentAnime.title,
        coverImage: currentAnime.coverImage,
        format: currentAnime.format,
        episodes: currentAnime.episodes,
        averageScore: currentAnime.averageScore,
        seasonYear: currentAnime.seasonYear,
        status: currentAnime.status,
        genres: currentAnime.genres,
        relationType: "CURRENT",
      };

      // Main storyline: Prequels -> Current -> Sequels
      const main = [...prequels, currentEntry, ...sequels];

      // All franchise media items
      const all = [...main, ...side, ...others];

      return {
        mainStoryline: main,
        sideStories: side,
        allItems: all,
        prequel: immediatePrequel,
        sequel: immediateSequel,
      };
    }, [currentAnime]);

  // Aggregate user's watch progress across this franchise
  const stats = useMemo(() => {
    let trackedCount = 0;
    let completedCount = 0;
    let episodesWatched = 0;
    let totalEpisodesKnown = 0;

    for (const item of allItems) {
      const entry = entryFor(item.id);
      if (entry) {
        trackedCount += 1;
        if (entry.status === "completed") {
          completedCount += 1;
        }
        episodesWatched += entry.progress ?? 0;
      }
      if (item.episodes && item.episodes > 0) {
        totalEpisodesKnown += item.episodes;
      }
    }

    const percent =
      allItems.length > 0
        ? Math.round((completedCount / allItems.length) * 100)
        : 0;

    return {
      trackedCount,
      completedCount,
      totalEntries: allItems.length,
      episodesWatched,
      totalEpisodesKnown,
      percent,
    };
  }, [allItems, entryFor]);

  const displayedItems = useMemo(() => {
    if (activeFilter === "main") return mainStoryline;
    if (activeFilter === "side") return sideStories;
    return allItems;
  }, [activeFilter, mainStoryline, sideStories, allItems]);

  const handleAdd = useCallback(
    async (item: RelatedAnime) => {
      if (addingId !== null) return;
      setAddingId(item.id);
      const title = getDisplayTitle(item.title, preferEnglish);
      try {
        const ok = await addToLibrary(item, "planning");
        if (ok) {
          toast({
            title: "Added to library",
            description: `"${title}" was added to your Planning list.`,
            tone: "success",
          });
        }
      } finally {
        setAddingId(null);
      }
    },
    [addToLibrary, addingId, preferEnglish, toast],
  );

  if (allItems.length <= 1) {
    // Only current anime with no related entries
    return null;
  }

  return (
    <section
      aria-labelledby="franchise-heading"
      className="space-y-4 rounded-2xl border border-border-subtle bg-surface/50 p-4 sm:p-5"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <SparkIcon className="h-4 w-4" />
          </span>
          <div>
            <h2
              id="franchise-heading"
              className="font-display text-base font-semibold text-fg sm:text-lg"
            >
              Franchise & Seasons
            </h2>
            <p className="text-xs text-muted">
              {allItems.length} connected releases · Follow the storyline and
              track your overall series progress
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFilter === "all"
                ? "bg-accent text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            All ({allItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("main")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFilter === "main"
                ? "bg-accent text-accent-contrast shadow-xs"
                : "text-muted hover:text-fg",
            )}
          >
            Storyline ({mainStoryline.length})
          </button>
          {sideStories.length > 0 ? (
            <button
              type="button"
              onClick={() => setActiveFilter("side")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeFilter === "side"
                  ? "bg-accent text-accent-contrast shadow-xs"
                  : "text-muted hover:text-fg",
              )}
            >
              Side & Movies ({sideStories.length})
            </button>
          ) : null}
        </div>
      </div>

      {/* Franchise Progress Overview Bar */}
      <div className="rounded-xl border border-border-subtle bg-surface-2/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-fg">
            Series Completion:{" "}
            <strong className="text-accent-strong">
              {stats.completedCount} of {stats.totalEntries} entries
            </strong>{" "}
            completed
          </span>
          <span className="text-muted tabular-nums">
            {stats.episodesWatched}{" "}
            {stats.totalEpisodesKnown > 0
              ? `/ ${stats.totalEpisodesKnown}`
              : ""}{" "}
            episodes watched ({stats.percent}%)
          </span>
        </div>

        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </div>

      {/* Quick Prequel / Sequel Bar */}
      {prequel || sequel ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {prequel ? (
            <Link
              href={`/anime/${prequel.id}`}
              className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-2/80 px-3 py-2 text-xs transition-all hover:border-accent/40 hover:bg-surface-3 sm:flex-initial"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-muted uppercase">
                  Prequel
                </span>
                <span className="truncate font-medium text-fg max-w-[180px] sm:max-w-[240px]">
                  {getDisplayTitle(prequel.title, preferEnglish)}
                </span>
              </div>
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 rotate-180 text-muted" />
            </Link>
          ) : null}

          {sequel ? (
            <Link
              href={`/anime/${sequel.id}`}
              className="inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-2/80 px-3 py-2 text-xs transition-all hover:border-accent/40 hover:bg-surface-3 sm:flex-initial"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong uppercase">
                  Sequel
                </span>
                <span className="truncate font-medium text-fg max-w-[180px] sm:max-w-[240px]">
                  {getDisplayTitle(sequel.title, preferEnglish)}
                </span>
              </div>
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Grid of Season & Franchise Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayedItems.map((item) => {
          const isCurrent = item.id === currentAnime.id;
          const entry = entryFor(item.id);
          const isTracked = !!entry;
          const isAdding = addingId === item.id;
          const title = getDisplayTitle(item.title, preferEnglish);
          const cover = item.coverImage.extraLarge ?? item.coverImage.large;
          const score = formatScore(item.averageScore);
          const relationLabel = isCurrent
            ? "Current Season"
            : formatRelationType(item.relationType) ?? "Related";

          return (
            <div
              key={item.id}
              className={cn(
                "group relative flex items-center gap-3.5 rounded-xl border p-3 transition-all duration-200",
                isCurrent
                  ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent/30"
                  : "border-border-subtle bg-surface-2/60 hover:border-border hover:bg-surface-2",
              )}
            >
              {/* Cover Poster */}
              <Link
                href={`/anime/${item.id}`}
                className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-3 transition-transform duration-200 group-hover:scale-102"
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
                  <div className="absolute inset-0 bg-surface-3" />
                )}

                {isCurrent ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-contrast uppercase">
                      Viewing
                    </span>
                  </div>
                ) : null}
              </Link>

              {/* Information & Actions */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      isCurrent
                        ? "bg-accent text-accent-contrast"
                        : "bg-surface-3 text-muted",
                    )}
                  >
                    {relationLabel}
                  </span>
                  {item.seasonYear ? (
                    <span className="text-[11px] text-faint">
                      {item.seasonYear}
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/anime/${item.id}`}
                  className="mt-1 block line-clamp-1 text-xs font-semibold text-fg transition-colors hover:text-accent-strong"
                  title={title}
                >
                  {title}
                </Link>

                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  {score ? (
                    <span className="flex items-center gap-0.5 font-medium text-warning">
                      <StarIcon className="h-3 w-3 fill-warning text-warning" />
                      {score}
                    </span>
                  ) : null}
                  {item.format ? (
                    <span>{formatFormat(item.format)}</span>
                  ) : null}
                  {item.episodes ? (
                    <>
                      <span>·</span>
                      <span>{item.episodes} eps</span>
                    </>
                  ) : null}
                </div>

                {/* Library Action Bar */}
                <div className="mt-2.5 flex items-center gap-2">
                  {isTracked && entry ? (
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={entry.status} />
                      {entry.progress > 0 ? (
                        <span className="text-[11px] text-faint tabular-nums">
                          {entry.progress}
                          {item.episodes ? `/${item.episodes}` : ""} eps
                        </span>
                      ) : null}
                    </div>
                  ) : isCurrent ? (
                    <span className="text-[11px] font-medium text-accent-strong">
                      Manage in sidebar &rarr;
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => void handleAdd(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-60 active:scale-95"
                    >
                      {isAdding ? (
                        <LoaderIcon className="h-3 w-3 animate-spin" />
                      ) : (
                        <PlusIcon className="h-3 w-3" />
                      )}
                      <span>{isAdding ? "Adding…" : "Track"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
