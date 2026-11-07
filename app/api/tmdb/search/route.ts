import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { tmdbSearchParamsSchema } from "@/lib/validation/tmdb";
import { searchTmdb } from "@/services/tmdb/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = tmdbSearchParamsSchema.safeParse({
    kind: url.searchParams.get("kind") ?? "movie",
    q: url.searchParams.get("q") ?? "",
    page: url.searchParams.get("page") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid search request",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const page = await searchTmdb(
      parsed.data.kind,
      parsed.data.q,
      parsed.data.page,
    );
    return NextResponse.json(page, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
