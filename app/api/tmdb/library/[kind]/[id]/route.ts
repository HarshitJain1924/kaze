import { NextResponse } from "next/server";

import { getApiContext, readJsonBody } from "@/lib/api/helpers";
import { tmdbErrorResponse } from "@/lib/api/tmdb";
import {
  tmdbEntryPatchSchema,
  tmdbIdSchema,
  tmdbKindSchema,
} from "@/lib/validation/tmdb";
import { createTmdbLibraryRepository } from "@/repositories/tmdb-library";

interface RouteContext {
  params: Promise<{ kind: string; id: string }>;
}

async function readParams(context: RouteContext) {
  const { kind: rawKind, id: rawId } = await context.params;
  const kind = tmdbKindSchema.safeParse(rawKind);
  const id = tmdbIdSchema.safeParse(Number(rawId));
  return kind.success && id.success
    ? { ok: true as const, kind: kind.data, id: id.data }
    : { ok: false as const };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;

  const params = await readParams(context);
  if (!params.ok) {
    return NextResponse.json(
      { error: "Invalid movie or TV id", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const repository = createTmdbLibraryRepository(auth.context.supabase);
    const entry = await repository.find(
      auth.context.viewer.id,
      params.kind,
      params.id,
    );
    if (!entry) {
      return NextResponse.json(
        { error: "This title is not in your library", code: "not_found" },
        { status: 404 },
      );
    }
    const watchedEpisodes = await repository.listWatchedEpisodes(
      auth.context.viewer.id,
      entry.id,
    );
    return NextResponse.json({ entry, watchedEpisodes });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;

  const params = await readParams(context);
  if (!params.ok) {
    return NextResponse.json(
      { error: "Invalid movie or TV id", code: "invalid_request" },
      { status: 400 },
    );
  }

  const parsed = tmdbEntryPatchSchema.safeParse(await readJsonBody(request));
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
    const repository = createTmdbLibraryRepository(auth.context.supabase);
    const entry = await repository.update(
      auth.context.viewer.id,
      params.kind,
      params.id,
      parsed.data,
    );
    const watchedEpisodes = await repository.listWatchedEpisodes(
      auth.context.viewer.id,
      entry.id,
    );
    return NextResponse.json({ entry, watchedEpisodes });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;

  const params = await readParams(context);
  if (!params.ok) {
    return NextResponse.json(
      { error: "Invalid movie or TV id", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    const repository = createTmdbLibraryRepository(auth.context.supabase);
    await repository.remove(
      auth.context.viewer.id,
      params.kind,
      params.id,
    );
    return NextResponse.json({ removed: true });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
