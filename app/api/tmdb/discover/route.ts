import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { tmdbDiscoverParamsSchema } from "@/lib/validation/tmdb";
import { discoverTmdb } from "@/services/tmdb/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const read = (key: string) => url.searchParams.get(key) ?? undefined;
  const parsed = tmdbDiscoverParamsSchema.safeParse({
    kind: url.searchParams.get("kind") ?? "movie",
    category: url.searchParams.get("category") ?? "trending",
    page: url.searchParams.get("page") ?? "1",
    genres: read("genre"),
    year: read("year"),
    rating: read("rating"),
    sort: read("sort"),
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
      {
        genres: parsed.data.genres,
        year: parsed.data.year,
        minRating: parsed.data.rating,
        sort: parsed.data.sort,
      },
    );
    return NextResponse.json(page, {
      headers: {
        // Catalogue pages are public metadata, so browsers and proxies may
        // reuse them for a few minutes instead of re-hitting TMDB.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
