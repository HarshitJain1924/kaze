"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TmdbAttribution } from "@/components/tmdb-attribution";
import { ApiRequestError, apiFetch } from "@/lib/http";
import { adaptTmdbDetailView } from "@/lib/media/detail-view";
import type { MediaDetailSection } from "@/lib/media/detail-view";
import { MediaDetailFacts } from "@/features/media-detail/media-detail-facts";
import { MediaDetailShell } from "@/features/media-detail/media-detail-shell";
import { MediaDetailSynopsis } from "@/features/media-detail/media-detail-synopsis";
import { TmdbCollectionSection } from "@/features/screen/tmdb-collection";
import { TmdbCreditsSection } from "@/features/screen/tmdb-credits";
import { TmdbRecommendations } from "@/features/screen/tmdb-recommendations";
import { TmdbSeasonsSection, tmdbEpisodeKey } from "@/features/screen/tmdb-seasons";
import { TmdbTrackingPanel } from "@/features/screen/tmdb-tracking-panel";
import type { WatchStatus } from "@/types/library";
import type {
  TmdbDetails,
  TmdbLibraryEntry,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

interface LibraryResponse {
  entry: TmdbLibraryEntry;
  watchedEpisodes: TmdbWatchedEpisode[];
}

export function ScreenDetail({
  details,
  initialEntry,
  initialEpisodes,
  canWrite,
}: {
  details: TmdbDetails;
  initialEntry: TmdbLibraryEntry | null;
  initialEpisodes: TmdbWatchedEpisode[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState<TmdbLibraryEntry | null>(initialEntry);
  const [watched, setWatched] = useState<Set<string>>(
    () =>
      new Set(
        initialEpisodes.map((episode) =>
          tmdbEpisodeKey(episode.seasonNumber, episode.episodeNumber),
        ),
      ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<WatchStatus>("planning");
  const [notes, setNotes] = useState(initialEntry?.notes ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const [seasonData, setSeasonData] = useState<
    Record<number, TmdbSeasonDetails>
  >({});
  const [seasonLoading, setSeasonLoading] = useState<number | null>(null);

  const isTv = details.kind === "tv";
  const totalEpisodes =
    entry?.totalEpisodes ?? details.numberOfEpisodes ?? 0;
  const watchedCount = watched.size;
  const percent =
    totalEpisodes > 0
      ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100))
      : 0;
  const view = adaptTmdbDetailView(details);

  function messageFor(cause: unknown): string {
    if (cause instanceof ApiRequestError) {
      if (cause.status === 401) {
        return "Sign in to save films and TV shows to your library.";
      }
      return cause.message;
    }
    return "Something went wrong. Please try again.";
  }

  function syncEntry(data: LibraryResponse) {
    setEntry(data.entry);
    setWatched(
      new Set(
        data.watchedEpisodes.map((episode) =>
          tmdbEpisodeKey(episode.seasonNumber, episode.episodeNumber),
        ),
      ),
    );
    router.refresh();
  }

  async function addEntry() {
    if (!canWrite) {
      setError("Sign in to add this title to your library.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ entry: TmdbLibraryEntry }>(
        "/api/tmdb/library",
        {
          method: "POST",
          body: JSON.stringify({
            kind: details.kind,
            tmdbId: details.tmdbId,
            status: addStatus,
          }),
        },
      );
      setEntry(data.entry);
      setNotes(data.entry.notes ?? "");
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function patchEntry(patch: Record<string, unknown>) {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<LibraryResponse>(
        `/api/tmdb/library/${details.kind}/${details.tmdbId}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      syncEntry(data);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry() {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch<{ removed: boolean }>(
        `/api/tmdb/library/${details.kind}/${details.tmdbId}`,
        { method: "DELETE" },
      );
      setEntry(null);
      setWatched(new Set());
      setNotes("");
      setConfirmRemove(false);
      router.refresh();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function loadSeason(season: TmdbSeasonSummary) {
    if (openSeason === season.seasonNumber) {
      setOpenSeason(null);
      return;
    }
    setOpenSeason(season.seasonNumber);
    if (seasonData[season.seasonNumber]) return;

    setSeasonLoading(season.seasonNumber);
    setError(null);
    try {
      const data = await apiFetch<TmdbSeasonDetails>(
        `/api/tmdb/tv/${details.tmdbId}/season/${season.seasonNumber}`,
      );
      setSeasonData((current) => ({
        ...current,
        [season.seasonNumber]: data,
      }));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSeasonLoading(null);
    }
  }

  async function writeEpisodes(
    refs: Array<{ seasonNumber: number; episodeNumber: number }>,
    watchedState: boolean,
  ) {
    if (!entry || refs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<LibraryResponse>(
        `/api/tmdb/library/tv/${details.tmdbId}/episodes`,
        {
          method: "POST",
          body: JSON.stringify({ episodes: refs, watched: watchedState }),
        },
      );
      syncEntry(data);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  async function clearProgress() {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<LibraryResponse>(
        `/api/tmdb/library/tv/${details.tmdbId}/episodes`,
        {
          method: "POST",
          body: JSON.stringify({ action: "clearAll" }),
        },
      );
      syncEntry(data);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setBusy(false);
    }
  }

  const sections: MediaDetailSection[] = [
    {
      id: "synopsis",
      label: "Synopsis",
      tab: false,
      overview: true,
      content: (
        <MediaDetailSynopsis
          synopsis={view.synopsis}
          genres={view.genres}
          tags={view.tags}
          sourceUrl={view.sourceUrl}
          sourceLabel={view.sourceLabel}
        />
      ),
    },
  ];

  if (details.cast.length > 0 || details.crew.length > 0) {
    sections.push({
      id: "credits",
      label: "Cast & Crew",
      count: details.cast.length + details.crew.length,
      overview: true,
      content: (
        <TmdbCreditsSection cast={details.cast} crew={details.crew} />
      ),
    });
  }

  if (isTv) {
    sections.push({
      id: "seasons",
      label: "Seasons & Episodes",
      count: details.seasons.length,
      overview: true,
      content: (
        <TmdbSeasonsSection
          seasons={details.seasons}
          entry={entry}
          watched={watched}
          openSeason={openSeason}
          seasonData={seasonData}
          seasonLoading={seasonLoading}
          busy={busy}
          watchedCount={watchedCount}
          onLoadSeason={(season) => void loadSeason(season)}
          onToggleEpisode={(seasonNumber, episodeNumber, watchedState) =>
            void writeEpisodes(
              [{ seasonNumber, episodeNumber }],
              watchedState,
            )
          }
          onWriteEpisodes={(episodes, watchedState) =>
            void writeEpisodes(episodes, watchedState)
          }
        />
      ),
    });
  }

  if (details.collection && details.collection.parts.length > 0) {
    sections.push({
      id: "collection",
      label: "Collection",
      count: details.collection.parts.length,
      overview: true,
      content: (
        <TmdbCollectionSection
          collection={details.collection}
          currentTmdbId={details.tmdbId}
        />
      ),
    });
  }

  return (
    <MediaDetailShell
      view={view}
      sections={sections}
      detailsContent={
        <MediaDetailFacts title="Details" facts={view.facts} />
      }
      sidebar={
        <TmdbTrackingPanel
          entry={entry}
          isTv={isTv}
          canWrite={canWrite}
          busy={busy}
          addStatus={addStatus}
          onAddStatusChange={setAddStatus}
          notes={notes}
          onNotesChange={setNotes}
          confirmRemove={confirmRemove}
          onConfirmRemoveChange={setConfirmRemove}
          watchedCount={watchedCount}
          totalEpisodes={totalEpisodes}
          percent={percent}
          posterUrl={details.posterUrl}
          tmdbId={details.tmdbId}
          onAdd={() => void addEntry()}
          onPatch={(patch) => void patchEntry(patch)}
          onRemove={() => void removeEntry()}
          onClearProgress={() => void clearProgress()}
        />
      }
      recommendations={
        details.recommendations.length > 0 ? (
          <TmdbRecommendations recommendations={details.recommendations} />
        ) : undefined
      }
      notice={
        error ? (
          <div
            role="alert"
            className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
          >
            {error}
          </div>
        ) : undefined
      }
      footer={<TmdbAttribution className="mt-3 px-1" />}
    />
  );
}
