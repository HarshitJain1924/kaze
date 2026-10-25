import { NextResponse } from "next/server";

import {
  getApiContext,
  libraryErrorResponse,
  readJsonBody,
} from "@/lib/api/helpers";
import {
  anilistIdSchema,
  bulkEpisodeSchema,
  toggleEpisodeSchema,
} from "@/lib/validation/library";
import {
  resolveEpisodeCount,
  resolveEpisodeTotal,
} from "@/features/library/episode-count";
import { createLibraryRepository } from "@/repositories/library";

interface RouteContext {
  params: Promise<{ anilistId: string }>;
}

async function readAnimeId(context: RouteContext): Promise<number | null> {
  const { anilistId } = await context.params;
  const parsed = anilistIdSchema.safeParse(Number(anilistId));
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) {
    return auth.response;
  }

  const animeId = await readAnimeId(context);
  if (animeId === null) {
    return NextResponse.json(
      { error: "Invalid anime id", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const repository = createLibraryRepository(auth.context.supabase);
    const watchedEpisodes = await repository.getWatchedEpisodes(
      auth.context.viewer.id,
      animeId,
    );
    return NextResponse.json({ watchedEpisodes });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) {
    return auth.response;
  }

  const animeId = await readAnimeId(context);
  if (animeId === null) {
    return NextResponse.json(
      { error: "Invalid anime id", code: "invalid_request" },
      { status: 400 },
    );
  }

  const rawBody = await readJsonBody(request);

  // Check if bulk action
  const bulkParsed = bulkEpisodeSchema.safeParse(rawBody);
  if (bulkParsed.success) {
    try {
      const repository = createLibraryRepository(auth.context.supabase);
      if (bulkParsed.data.action === "markAll") {
        const total =
          bulkParsed.data.totalEpisodes ??
          (await resolveEpisodeCount(animeId));
        if (!total || total <= 0) {
          return NextResponse.json(
            {
              error: "Cannot mark all episodes for unknown episode count",
              code: "invalid_request",
            },
            { status: 400 },
          );
        }
        const result = await repository.markAllEpisodes(
          auth.context.viewer.id,
          animeId,
          total,
        );
        return NextResponse.json(result);
      } else {
        const total = await resolveEpisodeCount(animeId);
        const result = await repository.clearAllEpisodes(
          auth.context.viewer.id,
          animeId,
          total,
        );
        return NextResponse.json(result);
      }
    } catch (error) {
      return libraryErrorResponse(error);
    }
  }

  // Otherwise single episode toggle
  const toggleParsed = toggleEpisodeSchema.safeParse(rawBody);
  if (!toggleParsed.success) {
    return NextResponse.json(
      {
        error:
          toggleParsed.error.issues[0]?.message ?? "Invalid episode update",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const totalEpisodes = await resolveEpisodeTotal(
      toggleParsed.data.totalEpisodes,
      animeId,
    );

    const repository = createLibraryRepository(auth.context.supabase);
    const result = await repository.toggleEpisode(
      auth.context.viewer.id,
      animeId,
      toggleParsed.data.episodeNumber,
      toggleParsed.data.watched,
      totalEpisodes,
    );
    return NextResponse.json(result);
  } catch (error) {
    return libraryErrorResponse(error);
  }
}
