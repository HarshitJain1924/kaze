import "server-only";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TmdbLibraryConflictError,
  TmdbLibraryDataError,
  TmdbLibraryNotFoundError,
  createTmdbLibraryRepository,
} from "@/repositories/tmdb-library";
import {
  TmdbNotConfiguredError,
  TmdbNotFoundError,
  TmdbRateLimitError,
  TmdbUpstreamError,
  TmdbValidationError,
} from "@/services/tmdb/errors";
import type { TmdbLibraryItem } from "@/types/tmdb";

/** Maps provider and repository failures to safe client responses. */
export function tmdbErrorResponse(error: unknown): NextResponse {
  if (error instanceof TmdbNotConfiguredError) {
    return NextResponse.json(
      {
        error:
          "TMDB is not configured. Add TMDB_READ_ACCESS_TOKEN to the server environment.",
        code: "tmdb_not_configured",
      },
      { status: 503 },
    );
  }
  if (error instanceof TmdbNotFoundError) {
    return NextResponse.json(
      { error: error.message, code: "not_found" },
      { status: 404 },
    );
  }
  if (error instanceof TmdbRateLimitError) {
    return NextResponse.json(
      { error: error.message, code: "rate_limited" },
      {
        status: 429,
        headers: error.retryAfterSeconds
          ? { "retry-after": String(error.retryAfterSeconds) }
          : undefined,
      },
    );
  }
  if (error instanceof TmdbValidationError) {
    return NextResponse.json(
      {
        error: "TMDB returned data Kaze could not read. Try again later.",
        code: "invalid_provider_response",
      },
      { status: 502 },
    );
  }
  if (error instanceof TmdbUpstreamError) {
    return NextResponse.json(
      { error: error.message, code: "provider_unavailable" },
      { status: 502 },
    );
  }
  if (error instanceof TmdbLibraryNotFoundError) {
    return NextResponse.json(
      { error: "This title is not in your library", code: "not_found" },
      { status: 404 },
    );
  }
  if (error instanceof TmdbLibraryConflictError) {
    return NextResponse.json(
      { error: error.message, code: "already_in_library" },
      { status: 409 },
    );
  }
  if (error instanceof TmdbLibraryDataError) {
    console.error("[api/tmdb] library failure", error.message);
    return NextResponse.json(
      { error: error.message, code: "library_unavailable" },
      { status: 500 },
    );
  }

  console.error("[api/tmdb] unexpected failure", error);
  return NextResponse.json(
    { error: "Something went wrong.", code: "unexpected_error" },
    { status: 500 },
  );
}

export async function loadScreenLibrary(
  userId: string,
): Promise<TmdbLibraryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const repository = createTmdbLibraryRepository(supabase);

  const [entries, episodes] = await Promise.all([
    repository.list(userId),
    repository.listWatchedEpisodes(userId),
  ]);

  const grouped = new Map<string, typeof episodes>();
  for (const episode of episodes) {
    const list = grouped.get(episode.entryId);
    if (list) list.push(episode);
    else grouped.set(episode.entryId, [episode]);
  }

  return entries.map((entry) => {
    const watchedEpisodes = grouped.get(entry.id) ?? [];
    return {
      entry,
      watchedEpisodes,
      watchedCount: watchedEpisodes.length,
    };
  });
}
