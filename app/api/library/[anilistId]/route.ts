import { NextResponse } from "next/server";

import {
  getApiContext,
  libraryErrorResponse,
  readJsonBody,
} from "@/lib/api/helpers";
import {
  anilistIdSchema,
  entryUpdateRequestSchema,
} from "@/lib/validation/library";
import {
  resolveEpisodeTotal,
  resolveMediaCounts,
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

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = entryUpdateRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid library update",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const repository = createLibraryRepository(auth.context.supabase);
    const mediaType = parsed.data.mediaType === "manga" ? "manga" : "anime";
    const { totalEpisodes, totalChapters, totalVolumes, ...patch } =
      parsed.data;

    const needsCounts =
      patch.status !== undefined ||
      patch.progress !== undefined ||
      patch.volumesProgress !== undefined;

    let units: number | null = null;
    let volumes: number | null = null;
    if (needsCounts && mediaType === "manga") {
      const counts = await resolveMediaCounts(animeId);
      units =
        totalChapters !== undefined ? totalChapters : counts.chapters;
      volumes =
        totalVolumes !== undefined ? totalVolumes : counts.volumes;
    } else if (needsCounts) {
      units = await resolveEpisodeTotal(totalEpisodes, animeId);
    }

    const entry =
      mediaType === "manga"
        ? await repository.update(
            auth.context.viewer.id,
            animeId,
            patch,
            units,
            volumes,
          )
        : await repository.update(
            auth.context.viewer.id,
            animeId,
            patch,
            units,
          );
    return NextResponse.json({ entry });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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
    await repository.remove(auth.context.viewer.id, animeId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}
