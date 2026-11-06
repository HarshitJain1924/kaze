import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScreenDetail } from "@/features/screen/screen-detail";
import { getViewer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTmdbLibraryRepository } from "@/repositories/tmdb-library";
import {
  TmdbNotConfiguredError,
  TmdbNotFoundError,
  TmdbRateLimitError,
} from "@/services/tmdb/errors";
import { getTmdbDetails } from "@/services/tmdb/service";
import { tmdbIdSchema, tmdbKindSchema } from "@/lib/validation/tmdb";
import type { TmdbDetails, TmdbLibraryEntry, TmdbWatchedEpisode } from "@/types/tmdb";

export const metadata: Metadata = {
  title: "Film & TV details",
};

export default async function ScreenDetailPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind: rawKind, id: rawId } = await params;
  const kind = tmdbKindSchema.safeParse(rawKind);
  const id = tmdbIdSchema.safeParse(Number(rawId));

  if (!kind.success || !id.success) {
    notFound();
  }

  let details: TmdbDetails;
  try {
    details = await getTmdbDetails(kind.data, id.data);
  } catch (error) {
    if (error instanceof TmdbNotFoundError) {
      notFound();
    }
    const message =
      error instanceof TmdbNotConfiguredError
        ? error.message
        : error instanceof TmdbRateLimitError
          ? error.message
          : "TMDB could not be reached. Try again in a moment.";

    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
          Films &amp; TV
        </p>
        <h1 className="font-display text-xl font-bold text-fg">
          Details unavailable
        </h1>
        <p className="text-sm leading-relaxed text-muted">{message}</p>
        {error instanceof TmdbNotConfiguredError ? (
          <p className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4 text-left text-xs text-faint">
            Add <code className="font-mono">TMDB_READ_ACCESS_TOKEN</code> to the
            server environment and restart Kaze. No placeholder metadata is
            shown in the meantime.
          </p>
        ) : null}
        <Link
          href="/screen"
          className="inline-flex text-sm font-medium text-accent-strong hover:underline"
        >
          Back to Films &amp; TV
        </Link>
      </div>
    );
  }

  const viewer = await getViewer();
  let entry: TmdbLibraryEntry | null = null;
  let watchedEpisodes: TmdbWatchedEpisode[] = [];

  if (viewer) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      try {
        const repository = createTmdbLibraryRepository(supabase);
        entry = await repository.find(
          viewer.id,
          details.kind,
          details.tmdbId,
        );
        if (entry && entry.mediaType === "tv") {
          watchedEpisodes = await repository.listWatchedEpisodes(
            viewer.id,
            entry.id,
          );
        }
      } catch (error) {
        // Catalogue details must still render if the optional library tables
        // are not migrated yet; the add action will surface the real error.
        console.error(
          "[screen] could not load the viewer's library entry",
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }
  }

  return (
    <ScreenDetail
      details={details}
      initialEntry={entry}
      initialEpisodes={watchedEpisodes}
      canWrite={viewer !== null}
    />
  );
}
