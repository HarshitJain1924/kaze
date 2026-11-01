import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getViewer } from "@/lib/auth";
import {
  parseAnimeSearchParams,
  toAnimeSearchParams,
} from "@/lib/validation/anime";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";
import { getCatalogService } from "@/services/catalog/catalog-service";
import { CatalogUnavailableError } from "@/services/catalog/errors";
import type { MediaType } from "@/types/anime";

interface SearchHandlerOptions {
  /** Legacy /api/anime/search is always anime-only. */
  forcedType?: MediaType;
}

/**
 * Server-side catalogue search for anime and manga.
 *
 * Adult titles are gated server-side from the signed-in viewer's account
 * preference; a query parameter can narrow the result set but can never widen
 * it for a guest or an account that has not opted in.
 */
export async function handleMediaSearch(
  request: Request,
  options: SearchHandlerOptions = {},
) {
  try {
    const url = new URL(request.url);
    const input = parseAnimeSearchParams(url.searchParams);
    const viewer = await getViewer();
    const adultAllowed = viewer?.showAdult === true;
    const mediaType = options.forcedType ?? input.type ?? "anime";
    const restrictedInput = {
      ...input,
      type: mediaType,
      adult: adultAllowed ? input.adult : ("filtered" as const),
    };

    const catalog = getCatalogService();
    const result = await catalog.searchMedia(
      toAnimeSearchParams(restrictedInput),
    );
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
            "The catalogue provider is temporarily unavailable. Your library and progress are unaffected.",
          code: "upstream_suspended",
        },
        { status: 503 },
      );
    }

    if (error instanceof AniListError) {
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
              "The catalogue is rate limiting requests. Please try again in a moment.",
            code: "rate_limited",
          },
          { status: 429, headers },
        );
      }

      console.error("[api/media/search] upstream catalogue failure", {
        status: error.status,
        suspended: error.isSuspended,
      });
      return NextResponse.json(
        {
          error:
            "The catalogue is temporarily unavailable. Your library and progress are unaffected.",
          code: "upstream_error",
        },
        { status: 502 },
      );
    }

    console.error(
      "[api/media/search] unexpected failure",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Could not load titles right now.", code: "unexpected_error" },
      { status: 500 },
    );
  }
}
