"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ChevronRightIcon, ClockIcon, FilmIcon, PlayIcon } from "@/components/icons";
import { useLibrary } from "@/features/library/library-provider";
import { useScreenLibraryItems } from "@/features/screen/use-screen-library";
import { formatFormat, getDisplayTitle, isHttpUrl } from "@/lib/utils";

const BUDGETS = [
  { id: "30", label: "30 min", minutes: 30 },
  { id: "60", label: "1 hour", minutes: 60 },
  { id: "120", label: "2 hours", minutes: 120 },
  { id: "any", label: "Any length", minutes: Number.POSITIVE_INFINITY },
] as const;

type BudgetId = (typeof BUDGETS)[number]["id"];

interface Candidate {
  key: string;
  title: string;
  href: string;
  cover: string | null;
  badge: string;
  detail: string;
  minutes: number;
}

/**
 * "One thing tonight": a single recommendation that fits the time the viewer
 * actually has. Reading chapters count as a short slot, TV episodes as a medium
 * one, films as the long one.
 */
export function TonightPicker() {
  const { items } = useLibrary();
  const screenItems = useScreenLibraryItems();
  const [budgetId, setBudgetId] = useState<BudgetId>("any");
  const [rotation, setRotation] = useState(0);

  const candidates = useMemo<Candidate[]>(() => {
    const list: Candidate[] = [];

    for (const item of items) {
      const anime = item.anime;
      if (!anime) continue;
      if (item.entry.status !== "watching" && item.entry.status !== "planning") {
        continue;
      }

      const isManga = (item.entry.mediaType ?? "anime") === "manga";
      const total = isManga ? (anime.chapters ?? null) : anime.episodes;
      const next = item.entry.progress + 1;
      if (total !== null && total > 0 && next > total) continue;

      list.push({
        key: `anime-${item.entry.id}`,
        title: getDisplayTitle(anime.title, true),
        href: `/media/${item.entry.anilistId}`,
        cover: anime.coverImage.extraLarge ?? anime.coverImage.large,
        badge: isManga
          ? (formatFormat(anime.format) ?? "Manga")
          : (formatFormat(anime.format) ?? "Anime"),
        detail: isManga
          ? `Chapter ${next}${total ? ` of ${total}` : ""} · ~8 min`
          : `Episode ${next}${total ? ` of ${total}` : ""} · ~24 min`,
        minutes: isManga ? 8 : 24,
      });
    }

    for (const item of screenItems) {
      const { entry } = item;
      if (entry.status === "completed" || entry.status === "dropped") continue;

      if (entry.mediaType === "movie") {
        if (entry.watched) continue;
        list.push({
          key: `movie-${entry.id}`,
          title: entry.title,
          href: `/screen/movie/${entry.tmdbId}`,
          cover: entry.posterPath,
          badge: "Film",
          detail: "Feature film · ~2 h",
          minutes: 120,
        });
        continue;
      }

      const total = entry.totalEpisodes;
      if (total !== null && item.watchedCount >= total) continue;
      list.push({
        key: `tv-${entry.id}`,
        title: entry.title,
        href: `/screen/tv/${entry.tmdbId}`,
        cover: entry.posterPath,
        badge: "TV",
        detail: `Episode ${item.watchedCount + 1}${total ? ` of ${total}` : ""} · ~45 min`,
        minutes: 45,
      });
    }

    return list.sort((a, b) => a.minutes - b.minutes);
  }, [items, screenItems]);

  const budget = BUDGETS.find((option) => option.id === budgetId) ?? BUDGETS[3];
  const fitting = candidates.filter(
    (candidate) => candidate.minutes <= budget.minutes,
  );
  const pick =
    fitting.length > 0 ? fitting[rotation % fitting.length] : undefined;

  return (
    <section
      aria-label="One thing tonight"
      className="border border-border bg-surface/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Right now
          </p>
          <h2 className="mt-1 font-display text-base font-semibold tracking-tight text-fg sm:text-lg">
            One thing tonight
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Pick the slot you have, not the pile you own.
          </p>
        </div>

        <div
          role="group"
          aria-label="Time available"
          className="flex flex-wrap items-center gap-px border border-border bg-border"
        >
          {BUDGETS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={budgetId === option.id}
              onClick={() => {
                setBudgetId(option.id);
                setRotation(0);
              }}
              className={`h-7 px-2.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                budgetId === option.id
                  ? "bg-accent text-accent-contrast"
                  : "bg-surface text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {pick ? (
        <div className="mt-3.5 flex items-center gap-3.5">
          <Link
            href={pick.href}
            className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden border border-border bg-surface-2 sm:w-16"
          >
            {pick.cover && isHttpUrl(pick.cover) ? (
              <Image
                src={pick.cover}
                alt=""
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <FilmIcon className="h-5 w-5 text-faint/60" />
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="border border-border bg-surface px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
                {pick.badge}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                <ClockIcon className="h-2.5 w-2.5" />
                {pick.minutes === 120 ? "2 h" : `${pick.minutes} min`}
              </span>
            </div>

            <Link
              href={pick.href}
              className="mt-1 block truncate font-display text-[15px] font-semibold text-fg transition-colors hover:text-accent-strong"
              title={pick.title}
            >
              {pick.title}
            </Link>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {pick.detail}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Link
              href={pick.href}
              className="inline-flex h-8 items-center gap-1.5 border border-accent bg-accent px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              <PlayIcon className="h-2.5 w-2.5 fill-current" />
              Open
            </Link>
            <button
              type="button"
              onClick={() => setRotation((value) => value + 1)}
              className="inline-flex h-7 items-center gap-1 border border-border bg-surface px-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg"
            >
              Another
              <ChevronRightIcon className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            {candidates.length === 0
              ? "Nothing waiting. Add a few titles and this becomes your nightly pick."
              : "Nothing fits that slot. Try a longer one."}
          </p>
          <Link
            href={candidates.length === 0 ? "/discover" : "/library"}
            className="inline-flex h-8 items-center border border-border bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:border-accent/50 hover:bg-surface-2"
          >
            {candidates.length === 0 ? "Discover titles" : "Open library"}
          </Link>
        </div>
      )}
    </section>
  );
}
