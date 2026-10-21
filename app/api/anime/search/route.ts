import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  parseAnimeSearchParams,
  toAnimeSearchParams,
} from "@/lib/validation/anime";
import { getCatalogService } from "@/services/catalog/catalog-service";
import { CatalogUnavailableError } from "@/services/catalog/errors";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";

/**
 * Server-side proxy for anime search with outage resilience.
 * CatalogueService coordinates primary AniList, verified Kitsu fallback and
 * cached metadata. A failed catalogue is reported as unavailable — never as a
 * successful empty result.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = parseAnimeSearchParams(url.searchParams);
    const catalog = getCatalogService();
    // Provider and degraded state come from this operation only, so
    // concurrent requests cannot relabel each other's responses.
    const result = await catalog.searchAnime(toAnimeSearchParams(input));
    const { provider, degraded, stale } = result.meta;

    const headers: Record<string, string> = {
      "x-catalog-provider": provider,
    };
    if (degraded) {
      headers["x-catalog-degraded"] = "1";
      headers["cache-control"] = "private, max-age=0, must-revalidate";
    } else {
      headers["cache-control"] =
        "public, s-maxage=60, stale-while-revalidate=300";
    }
    if (stale) {
      headers["x-catalog-stale"] = "1";
    }

    return NextResponse.json(result.data, { headers });
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

    if (error instanceof CatalogUnavailableError) {
      const headers: Record<string, string> = {};
      if (error.retryAfterMs !== null && error.retryAfterMs > 0) {
        headers["retry-after"] = String(
          Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
        );
      }
      return NextResponse.json(
        { error: error.userMessage, code: error.code },
        {
          status: error.reason === "rate_limited" ? 429 : 503,
          headers,
        },
      );
    }

    if (
      error instanceof AniListSuspendedError ||
      error instanceof CircuitBreakerOpenError
    ) {
      return NextResponse.json(
        {
          error:
            "The anime catalogue provider is temporarily unavailable. Your library and progress are unaffected.",
          code: "upstream_suspended",
        },
        { status: 503 },
      );
    }

    if (error instanceof AniListError) {
      // Preserve the rate-limit signal; never surface provider internals.
      const headers: Record<string, string> = {};
      if (error.status === 429) {
        if (error.retryAfterSeconds !== null) {
          headers["retry-after"] = String(
            Math.max(1, error.retryAfterSeconds),
          );
        }
        return NextResponse.json(
          {
            error:
              "The anime catalogue is rate limiting requests. Please try again in a moment.",
            code: "rate_limited",
          },
          { status: 429, headers },
        );
      }

      console.error("[api/anime/search] upstream catalogue failure", {
        status: error.status,
        suspended: error.isSuspended,
      });
      return NextResponse.json(
        {
          error:
            "The anime catalogue is temporarily unavailable. Your library and progress are unaffected.",
          code: "upstream_error",
        },
        { status: 502 },
      );
    }

    console.error(
      "[api/anime/search] unexpected failure",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Could not load anime right now.", code: "unexpected_error" },
      { status: 500 },
    );
  }
}
