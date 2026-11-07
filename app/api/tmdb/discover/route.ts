import { NextResponse } from "next/server";

import { tmdbErrorResponse } from "@/lib/api/tmdb";
import { getViewer } from "@/lib/auth";
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
    adult: read("adult"),
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

  // 18+ catalogues are only served to viewers who enabled adult titles.
  const viewer = await getViewer();
  const requestedAdult = parsed.data.adult ?? "filtered";
  const adult = viewer?.showAdult === true ? requestedAdult : "filtered";

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
        adult: adult === "filtered" ? undefined : adult,
      },
    );
    return NextResponse.json(page, {
      headers:
        adult === "filtered"
          ? {
              // Catalogue pages are public metadata, so browsers and proxies
              // may reuse them instead of re-hitting TMDB.
              "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
            }
          : { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return tmdbErrorResponse(error);
  }
}
