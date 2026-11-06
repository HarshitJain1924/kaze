import { NextResponse } from "next/server";

import { getApiContext, readJsonBody } from "@/lib/api/helpers";
import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { addTmdbEntrySchema } from "@/lib/validation/tmdb";
import { createTmdbLibraryRepository } from "@/repositories/tmdb-library";
import { getTmdbDetails } from "@/services/tmdb/service";

export async function POST(request: Request) {
  const auth = await getApiContext();
  if (!auth.ok) return auth.response;

  const parsed = addTmdbEntrySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid library request",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    // Metadata is resolved server-side from TMDB; the client can never inject
    // a fake title, poster or episode count into the library.
    const details = await getTmdbDetails(parsed.data.kind, parsed.data.tmdbId);
    const repository = createTmdbLibraryRepository(auth.context.supabase);
    const result = await repository.add(
      auth.context.viewer.id,
      details,
      parsed.data.status,
    );
    return NextResponse.json(
      {
        ...result,
        watchedEpisodes: [],
        watchedCount: 0,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
