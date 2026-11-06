import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { tmdbDiscoverParamsSchema } from "@/lib/validation/tmdb";
import { discoverTmdb } from "@/services/tmdb/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = tmdbDiscoverParamsSchema.safeParse({
    kind: url.searchParams.get("kind") ?? "movie",
    category: url.searchParams.get("category") ?? "trending",
    page: url.searchParams.get("page") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid discovery request",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const page = await discoverTmdb(
      parsed.data.kind,
      parsed.data.category,
      parsed.data.page,
    );
    return NextResponse.json(page);
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}