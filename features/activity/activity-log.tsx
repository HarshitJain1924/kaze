"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CheckIcon, ChevronRightIcon, ClockIcon } from "@/components/icons";
import { useToast } from "@/components/providers/toast-provider";
import {
  formatActivityDay,
  groupActivityByMonth,
  monthSummary,
  type ActivityEvent,
  type ActivityUndo,
} from "@/lib/activity";
import { apiFetch } from "@/lib/http";

const KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  anime_episode: "Episode",
  screen_episode: "Episode",
  completed: "Completed",
};

async function undoThrough(undo: ActivityUndo): Promise<void> {
  if (undo.type === "anime_episode") {
    await apiFetch(`/api/library/${undo.anilistId}/episodes`, {
      method: "POST",
      body: JSON.stringify({
        episodeNumber: undo.episodeNumber,
        watched: false,
      }),
    });
    return;
  }
  await apiFetch(
    `/api/tmdb/library/${undo.kind}/${undo.tmdbId}/episodes`,
    {
      method: "POST",
      body: JSON.stringify({
        episodes: [
          {
            seasonNumber: undo.seasonNumber,
            episodeNumber: undo.episodeNumber,
          },
        ],
        watched: false,
      }),
    },
  );
}

export function ActivityLog({ events: initialEvents }: { events: ActivityEvent[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [events, setEvents] = useState(initialEvents);
  const [undoing, setUndoing] = useState<string | null>(null);

  const months = useMemo(() => groupActivityByMonth(events), [events]);
  const totalEpisodes = months.reduce((sum, month) => sum + month.episodeCount, 0);

  const handleUndo = async (event: ActivityEvent) => {
    if (!event.undo || undoing) return;
    setUndoing(event.id);
    try {
      await undoThrough(event.undo);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      toast({
        title: "Unmarked",
        description: `${event.title} · ${event.detail}`,
        tone: "success",
      });
      router.refresh();
    } catch {
      toast({
        title: "Could not undo that",
        description: "The entry may have changed elsewhere. Try again.",
        tone: "error",
      });
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="space-y-6 pb-14">
      <header className="border border-border bg-surface/40 p-5 sm:p-7">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Personal Activity Ledger
          </span>
        </div>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-fg">
          Watch log
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted sm:text-sm">
          Every episode you marked and every title you finished, newest first.
          Times come from the moment you recorded each entry.
        </p>
        <p className="mt-3 font-mono text-[11px] text-faint">
          {events.length} {events.length === 1 ? "entry" : "entries"} ·{" "}
          {totalEpisodes} {totalEpisodes === 1 ? "episode" : "episodes"} across{" "}
          {months.length} {months.length === 1 ? "month" : "months"}
        </p>
      </header>

      {months.length === 0 ? (
        <div className="border border-border bg-surface/40 p-12 text-center">
          <ClockIcon className="mx-auto h-7 w-7 text-muted opacity-50" />
          <h2 className="mt-3 font-display text-sm font-semibold text-fg">
            Nothing logged yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
            Mark an episode watched on a title page or from Continue Watching and
            it will appear here with the date it was recorded.
          </p>
          <Link
            href="/library"
            className="mt-4 inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            <span>Open library</span>
          </Link>
        </div>
      ) : (
        months.map((month) => (
          <section key={month.key} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-fg">
                {month.label}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                {monthSummary(month)}
              </p>
            </div>

            <ul className="divide-y divide-border border border-border bg-surface/30">
              {month.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors hover:bg-surface/60"
                >
                  <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {formatActivityDay(event.at)}
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-border bg-surface text-accent-strong">
                    {event.kind === "completed" ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <ClockIcon className="h-3 w-3" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={event.href}
                      className="group inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-fg transition-colors hover:text-accent-strong"
                    >
                      <span className="truncate">{event.title}</span>
                      <ChevronRightIcon className="h-3 w-3 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {KIND_LABEL[event.kind]} · {event.detail}
                    </span>
                  </span>
                  {event.undo ? (
                    <button
                      type="button"
                      onClick={() => void handleUndo(event)}
                      disabled={undoing === event.id}
                      className="shrink-0 border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-50"
                    >
                      {undoing === event.id ? "Undoing…" : "Undo"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
