"use client";

import { EpisodeTracker } from "@/components/episode-tracker";
import { LinkButton } from "@/components/ui/link-button";
import { useLibrary } from "@/features/library/library-provider";
import type { Anime } from "@/types/anime";

export function AnimeEpisodeSection({ anime }: { anime: Anime }) {
  const { canWrite, entryFor } = useLibrary();
  const entry = entryFor(anime.id);

  return (
    <section aria-labelledby="episodes-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2
          id="episodes-heading"
          className="font-display text-lg font-semibold text-fg"
        >
          Episodes
        </h2>
        {anime.episodes ? (
          <span className="text-xs text-muted">
            {anime.episodes} total {anime.episodes === 1 ? "episode" : "episodes"}
          </span>
        ) : null}
      </div>

      {!canWrite ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 text-center">
          <p className="text-sm text-muted">
            Sign in to track individual episodes and save your progress.
          </p>
          <LinkButton
            href={`/login?next=${encodeURIComponent(`/anime/${anime.id}`)}`}
            variant="primary"
            size="sm"
            className="mt-3"
          >
            Sign in to track
          </LinkButton>
        </div>
      ) : (
        <EpisodeTracker anime={anime} entry={entry} />
      )}
    </section>
  );
}
