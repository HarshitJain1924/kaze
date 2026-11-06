import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { tmdbIdSchema, tmdbKindSchema } from "@/lib/validation/tmdb";
import { getTmdbDetails } from "@/services/tmdb/service";

interface RouteContext {
  params: Promise<{ kind: string; id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { kind: rawKind, id: rawId } = await context.params;
  const kind = tmdbKindSchema.safeParse(rawKind);
  const id = tmdbIdSchema.safeParse(Number(rawId));

  if (!kind.success || !id.success) {
    return NextResponse.json(
      { error: "Invalid movie or TV id", code: "invalid_request" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await getTmdbDetails(kind.data, id.data));
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
