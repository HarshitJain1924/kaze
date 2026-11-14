"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/providers/toast-provider";
import { notifyScreenLibraryChanged } from "@/features/screen/use-screen-library";
import { kindLabel } from "@/features/screen/screen-poster";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn, isHttpUrl } from "@/lib/utils";
import { MAX_SCORE, MIN_SCORE, type WatchStatus } from "@/types/library";
import type { TmdbLibraryEntry, TmdbSearchResult } from "@/types/tmdb";

const SCORE_OPTIONS = Array.from(
  { length: MAX_SCORE - MIN_SCORE + 1 },
  (_, index) => MAX_SCORE - index,
);

/**
 * Status, rating and (for films) watched state for one search result, saved
 * without leaving Discover. Episode progress and notes stay on the title page
 * because they need more room than a quick sheet should take.
 */
export function ScreenQuickEdit({
  item,
  entry,
  canWrite,
  onClose,
}: {
  item: TmdbSearchResult | null;
  entry: TmdbLibraryEntry | null;
  canWrite: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<WatchStatus>(entry?.status ?? "planning");
  const [score, setScore] = useState(
    entry?.score != null ? String(entry.score) : "",
  );
  const [watched, setWatched] = useState(entry?.watched ?? false);
  const [busy, setBusy] = useState(false);

  const isTv = item?.kind === "tv";
  const poster =
    item?.posterUrl && isHttpUrl(item.posterUrl) ? item.posterUrl : null;

  const handleSave = async () => {
    if (!item || busy) return;
    const parsedScore = score === "" ? null : Number(score);
    setBusy(true);
    try {
      if (!entry) {
        const created = await apiFetch<{ entry: TmdbLibraryEntry }>(
          "/api/tmdb/library",
          {
            method: "POST",
            body: JSON.stringify({
              kind: item.kind,
              tmdbId: item.tmdbId,
              status,
            }),
          },
        );
        const patch: Record<string, unknown> = {};
        if (parsedScore !== created.entry.score) patch.score = parsedScore;
        if (!isTv && watched !== created.entry.watched) patch.watched = watched;
        if (Object.keys(patch).length > 0) {
          await apiFetch(`/api/tmdb/library/${item.kind}/${item.tmdbId}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          });
        }
      } else {
        const patch: Record<string, unknown> = {};
        if (status !== entry.status) patch.status = status;
        if (parsedScore !== entry.score) patch.score = parsedScore;
        if (!isTv && watched !== entry.watched) patch.watched = watched;
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        await apiFetch(`/api/tmdb/library/${item.kind}/${item.tmdbId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      }

      notifyScreenLibraryChanged();
      toast({
        title: entry ? "Details saved" : "Added to your library",
        description: item.title,
        tone: "success",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Could not save",
        description:
          error instanceof ApiRequestError
            ? error.message
            : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title="Quick edit"
      description={
        item
          ? `${item.title} · ${kindLabel(item.kind)}${item.year ? ` · ${item.year}` : ""}`
          : undefined
      }
      size="sm"
      mobileSheet
      footer={
        <>
          {item ? (
            <Link
              href={`/screen/${item.kind}/${item.tmdbId}`}
              className="mr-auto inline-flex h-9 items-center justify-center whitespace-nowrap px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
            >
              Open full page
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={busy || !canWrite}
          >
            {busy ? "Saving…" : entry ? "Save changes" : "Add to library"}
          </Button>
        </>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden border border-border bg-surface-2">
              {poster ? (
                <Image src={poster} alt="" fill unoptimized sizes="48px" className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-fg">
                {item.title}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                {entry ? "Already tracked" : "Not in your library yet"}
              </p>
            </div>
          </div>

          {!canWrite ? (
            <p className="border border-border bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-muted">
              Sign in to save status and ratings. Everything you change here is
              private to your account.
            </p>
          ) : null}

          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
              Status
            </span>
            <div
              role="group"
              aria-label="Watch status"
              className="mt-1.5 flex flex-wrap gap-1.5"
            >
              {WATCH_STATUS_ORDER.map((option) => {
                const meta = WATCH_STATUS_META[option];
                const active = status === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => setStatus(option)}
                    className={cn(
                      "border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50",
                      active
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-border text-muted hover:border-accent/60 hover:text-fg",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">
              Your rating
            </span>
            <Select
              value={score}
              disabled={busy}
              onChange={(event) => setScore(event.target.value)}
              aria-label="Your rating"
              className="h-9 rounded-none border-border bg-surface text-xs font-medium focus:border-accent"
            >
              <option value="">Unrated</option>
              {SCORE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} / 10
                </option>
              ))}
            </Select>
          </label>

          {isTv ? (
            <p className="text-[11px] leading-relaxed text-faint">
              Episode progress and notes stay on the title page.
            </p>
          ) : (
            <label className="flex items-center justify-between gap-3 border border-border bg-surface-2/40 px-3 py-2">
              <span className="text-xs font-medium text-fg">Watched</span>
              <input
                type="checkbox"
                checked={watched}
                disabled={busy}
                onChange={(event) => setWatched(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
