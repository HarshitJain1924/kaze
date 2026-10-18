import { NextResponse } from "next/server";

import {
  getApiContext,
  libraryErrorResponse,
  readJsonBody,
} from "@/lib/api/helpers";
import {
  anilistIdSchema,
  entryPatchSchema,
} from "@/lib/validation/library";
import { resolveEpisodeCount } from "@/features/library/episode-count";
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

  const parsed = entryPatchSchema.safeParse(await readJsonBody(request));
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
    const episodes =
      parsed.data.status !== undefined || parsed.data.progress !== undefined
        ? await resolveEpisodeCount(animeId)
        : null;

    const repository = createLibraryRepository(auth.context.supabase);
    const entry = await repository.update(
      auth.context.viewer.id,
      animeId,
      parsed.data,
      episodes,
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
