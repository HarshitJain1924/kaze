import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseAnimeSearchParams,
  toAnimeSearchParams,
} from "@/lib/validation/anime";
import { getAniListClient } from "@/services/anilist/client";
import { AniListError } from "@/services/anilist/errors";

/**
 * Server-side proxy for AniList search. Keeping the upstream request on the
 * server centralizes caching, rate-limit backoff and input validation, and
 * prevents the browser from depending on AniList CORS behavior.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = parseAnimeSearchParams(url.searchParams);
    const page = await getAniListClient().searchAnime(
      toAnimeSearchParams(input),
    );

    return NextResponse.json(page, {
      headers: {
        "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ?? "Invalid search parameters",
          code: "invalid_request",
        },
        { status: 400 },
      );
    }

    if (error instanceof AniListError) {
      const status = error.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "AniList is rate limiting requests. Please retry in a moment."
              : error.message,
          code: status === 429 ? "rate_limited" : "upstream_error",
        },
        { status },
      );
    }

    console.error("[api/anime/search] unexpected failure", error);
    return NextResponse.json(
      { error: "Could not load anime right now.", code: "unexpected_error" },
      { status: 500 },
    );
  }
}
