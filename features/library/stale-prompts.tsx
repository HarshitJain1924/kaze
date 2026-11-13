"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { ChevronRightIcon, ClockIcon } from "@/components/icons";
import { useLibrary } from "@/features/library/library-provider";
import { getDisplayTitle } from "@/lib/utils";
import { useMinuteClock } from "@/lib/use-now";

const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;
const MAX_PROMPTS = 3;

export function StalePrompts() {
  const { items, updateEntry, pendingIds } = useLibrary();
  const now = useMinuteClock();
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(new Set());

  const mark = useCallback(
    async (anilistId: number, status: "watching" | "on_hold") => {
      setDismissed((current) => new Set(current).add(anilistId));
      await updateEntry(anilistId, { status });
    },
    [updateEntry],
  );

  if (!now) return null;

  const stale = items
    .filter((item) => item.entry.status === "watching")
    .filter((item) => !dismissed.has(item.entry.anilistId))
    .filter((item) => {
      const touched = Date.parse(item.entry.updatedAt);
      return Number.isFinite(touched) && now - touched >= SIX_WEEKS_MS;
    })
    .sort(
      (a, b) => Date.parse(a.entry.updatedAt) - Date.parse(b.entry.updatedAt),
    );

  if (stale.length === 0) return null;

  const shown = stale.slice(0, MAX_PROMPTS);

  return (
    <section
      aria-labelledby="stale-heading"
      className="border border-border bg-surface/40 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-3.5 w-3.5 text-accent-strong" />
          <h2
            id="stale-heading"
            className="font-display text-sm font-semibold text-fg"
          >
            Still watching?
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          untouched for six weeks or more
        </span>
      </div>

      <ul className="mt-2 divide-y divide-border">
        {shown.map((item) => {
          const title = item.anime
            ? getDisplayTitle(item.anime.title, true)
            : `AniList #${item.entry.anilistId}`;
          const weeks = Math.floor(
            (now - Date.parse(item.entry.updatedAt)) / (7 * 24 * 60 * 60 * 1000),
          );
          const busy = pendingIds.has(item.entry.anilistId);

          return (
            <li
              key={item.entry.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/media/${item.entry.anilistId}`}
                  className="group inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-fg transition-colors hover:text-accent-strong"
                >
                  <span className="truncate">{title}</span>
                  <ChevronRightIcon className="h-3 w-3 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                </Link>
                <span className="mt-0.5 block text-[11px] text-muted">
                  {item.entry.progress > 0
                    ? `${item.entry.progress} ${item.entry.mediaType === "manga" ? "chapters" : "episodes"} in`
                    : "No progress yet"}{" "}
                  · quiet for {weeks} {weeks === 1 ? "week" : "weeks"}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void mark(item.entry.anilistId, "watching")}
                  className="border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-50"
                >
                  Still on it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void mark(item.entry.anilistId, "on_hold")}
                  className="border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-50"
                >
                  On hold
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {stale.length > shown.length ? (
        <p className="mt-2 text-[11px] text-faint">
          {stale.length - shown.length} more waiting in{" "}
          <Link
            href="/library?status=watching"
            className="text-accent-strong hover:underline"
          >
            your library
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
