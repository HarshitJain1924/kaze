import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseAnimeSearchParams,
  toAnimeSearchParams,
} from "@/lib/validation/anime";
import { getCatalogService } from "@/services/catalog/catalog-service";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";

/**
 * Server-side proxy for anime search with outage resilience.
 * Uses CatalogService which coordinates primary AniList, fallback Kitsu, and local cache.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = parseAnimeSearchParams(url.searchParams);
    const catalog = getCatalogService();
    const page = await catalog.searchAnime(toAnimeSearchParams(input));

    const status = catalog.getStatus();
    const headers: Record<string, string> = {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    };
    if (status.isSuspended) {
      headers["x-catalog-fallback"] = status.activeProvider;
    }

    return NextResponse.json(page, { headers });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid search parameters",
          code: "invalid_request",
        },
        { status: 400 },
      );
    }

    if (
      error instanceof AniListSuspendedError ||
      error instanceof CircuitBreakerOpenError
    ) {
      return NextResponse.json(
        {
          error:
            "The AniList API has been temporarily disabled due to severe stability issues. Showing available cached titles.",
          code: "upstream_suspended",
        },
        { status: 503 },
      );
    }

    if (error instanceof AniListError) {
      const isSuspended = error.isSuspended || error.status === 403;
      const status = error.status === 429 ? 429 : isSuspended ? 503 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "AniList is rate limiting requests. Please retry in a moment."
              : isSuspended
                ? "The AniList API is temporarily suspended upstream."
                : error.message,
          code:
            status === 429
              ? "rate_limited"
              : isSuspended
                ? "upstream_suspended"
                : "upstream_error",
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
