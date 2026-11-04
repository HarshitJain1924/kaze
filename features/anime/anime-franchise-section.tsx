"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import {
  LoaderIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useToast } from "@/components/providers/toast-provider";
import { StatusBadge } from "@/components/ui/badge";
import { useLibrary } from "@/features/library/library-provider";
import {
  cn,
  formatFormat,
  formatMediaKind,
  formatRelationType,
  formatScore,
  getDisplayTitle,
  isHttpUrl,
  isManga,
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
        bannerImage: currentAnime.bannerImage,
        mediaType: currentAnime.mediaType,
        format: currentAnime.format,
        episodes: currentAnime.episodes,
        chapters: currentAnime.chapters,
        volumes: currentAnime.volumes,
        countryOfOrigin: currentAnime.countryOfOrigin,
        isAdult: currentAnime.isAdult,
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
      className="space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="franchise-heading"
              className="font-display text-lg font-semibold text-fg"
            >
              Franchise & Chronology
            </h2>
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">
              {allItems.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Follow the canonical storyline, spin-offs, and track overall completion across releases
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-border-subtle bg-surface-2/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFilter === "all"
                ? "bg-accent text-accent-contrast shadow-xs font-semibold"
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
                ? "bg-accent text-accent-contrast shadow-xs font-semibold"
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
                  ? "bg-accent text-accent-contrast shadow-xs font-semibold"
                  : "text-muted hover:text-fg",
              )}
            >
              Side & Movies ({sideStories.length})
            </button>
          ) : null}
        </div>
      </div>

      {/* Franchise Progress Overview Bar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border-subtle bg-surface/90 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-medium text-fg">
            Series Completion:{" "}
            <strong className="text-accent-strong font-semibold">
              {stats.completedCount} of {stats.totalEntries} entries
            </strong>{" "}
            completed
          </span>
          <span className="text-faint hidden sm:inline">·</span>
          <span className="text-muted tabular-nums">
            {stats.episodesWatched}{" "}
            {stats.totalEpisodesKnown > 0
              ? `/ ${stats.totalEpisodesKnown}`
              : ""}{" "}
            episodes logged ({stats.percent}%)
          </span>
        </div>

        <div className="h-1.5 w-full sm:w-48 overflow-hidden rounded-full bg-surface-3 shrink-0">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${stats.percent}%` }}
          />
        </div>
      </div>

      {/* Quick Prequel / Sequel Bar */}
      {prequel || sequel ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {prequel ? (
            <Link
              href={`/media/${prequel.id}`}
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-surface/90 px-3 py-1.5 text-xs transition-colors hover:border-border hover:bg-surface text-fg"
            >
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                &larr; Prequel
              </span>
              <span className="truncate max-w-[160px] sm:max-w-[220px] font-medium">
                {getDisplayTitle(prequel.title, preferEnglish)}
              </span>
            </Link>
          ) : null}

          {sequel ? (
            <Link
              href={`/media/${sequel.id}`}
              className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft/30 px-3 py-1.5 text-xs transition-colors hover:border-accent hover:bg-accent-soft/50 text-fg"
            >
              <span className="text-[10px] font-semibold text-accent-strong uppercase tracking-wider">
                Sequel &rarr;
              </span>
              <span className="truncate max-w-[160px] sm:max-w-[220px] font-medium">
                {getDisplayTitle(sequel.title, preferEnglish)}
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Grid of Season & Franchise Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {displayedItems.map((item) => {
          const isCurrent = item.id === currentAnime.id;
          const entry = entryFor(item.id);
          const isTracked = !!entry;
          const isAdding = addingId === item.id;
          const title = getDisplayTitle(item.title, preferEnglish);
          const cover = item.coverImage.extraLarge ?? item.coverImage.large;
          const score = formatScore(item.averageScore);
          const manga = isManga(item);
          const formatLabel = manga
            ? formatMediaKind(item)
            : formatFormat(item.format);
          const unitCount = manga ? item.chapters : item.episodes;
          const unitLabel = manga ? "ch" : "eps";
          const relationLabel = isCurrent
            ? "Current Title"
            : formatRelationType(item.relationType) ?? "Related";

          return (
            <div
              key={item.id}
              className={cn(
                "group relative flex items-center gap-3.5 rounded-xl border p-3 transition-all duration-200 shadow-xs",
                isCurrent
                  ? "border-accent/60 bg-accent-soft/30 ring-1 ring-accent/25 shadow-sm"
                  : "border-border-subtle bg-surface/90 hover:border-border hover:bg-surface",
              )}
            >
              {/* Cover Poster */}
              <Link
                href={`/media/${item.id}`}
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
                  <div className="absolute inset-x-0 bottom-0 bg-accent py-0.5 text-center text-[8px] font-bold text-accent-contrast uppercase tracking-wider">
                    Viewing
                  </div>
                ) : null}
              </Link>

              {/* Information & Actions */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                      isCurrent
                        ? "bg-accent text-accent-contrast"
                        : "bg-surface-2 text-muted border border-border-subtle",
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
                  href={`/media/${item.id}`}
                  className="mt-1 block line-clamp-1 text-xs sm:text-[13px] font-semibold text-fg transition-colors hover:text-accent-strong"
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
                  {formatLabel ? <span>{formatLabel}</span> : null}
                  {unitCount ? (
                    <>
                      <span>·</span>
                      <span>
                        {unitCount} {unitLabel}
                      </span>
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
                      Viewing details &rarr;
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => void handleAdd(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-fg transition-all hover:border-accent hover:bg-accent hover:text-accent-contrast disabled:opacity-60 active:scale-95 shadow-xs"
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
