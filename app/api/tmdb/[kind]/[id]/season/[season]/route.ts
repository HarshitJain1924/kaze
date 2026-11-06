import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { tmdbIdSchema, tmdbKindSchema } from "@/lib/validation/tmdb";
import { getTmdbSeason } from "@/services/tmdb/service";

interface RouteContext {
  params: Promise<{ kind: string; id: string; season: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { kind: rawKind, id: rawId, season: rawSeason } = await context.params;
  const kind = tmdbKindSchema.safeParse(rawKind);
  const id = tmdbIdSchema.safeParse(Number(rawId));
  const season = Number(rawSeason);

  if (
    !kind.success ||
    !id.success ||
    kind.data !== "tv" ||
    !Number.isInteger(season) ||
    season < 0 ||
    season > 100
  ) {
    return NextResponse.json(
      { error: "Invalid season request", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getTmdbSeason(id.data, season));
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
