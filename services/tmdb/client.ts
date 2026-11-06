import "server-only";

import {
  TmdbNotConfiguredError,
  TmdbNotFoundError,
  TmdbRateLimitError,
  TmdbUpstreamError,
} from "@/services/tmdb/errors";

const TMDB_BASE = "https://api.themoviedb.org/3";
const REQUEST_TIMEOUT_MS = 10_000;

export interface TmdbRequestOptions {
  /** Next.js fetch revalidation window in seconds. */
  revalidateSeconds?: number;
  query?: Record<string, string | number | boolean | undefined>;
}

function readToken(): string {
  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new TmdbNotConfiguredError();
  }
  return token;
}

function readRetryAfter(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const parsed = Number(header);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Performs one TMDB v3 request. The read access token is used as a Bearer
 * credential and is never placed in a URL, log line, or client bundle.
 */
export async function tmdbGet<T>(
  path: string,
  options: TmdbRequestOptions = {},
): Promise<T> {
  const token = readToken();
  const url = new URL(`${TMDB_BASE}${path}`);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      next: { revalidate: options.revalidateSeconds ?? 3600 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new TmdbUpstreamError("TMDB took too long to respond.", null, {
        cause: error,
      });
    }
    throw new TmdbUpstreamError(undefined, null, { cause: error });
  }

  if (response.status === 404) {
    throw new TmdbNotFoundError();
  }
  if (response.status === 429) {
    throw new TmdbRateLimitError(readRetryAfter(response));
  }
  if (response.status === 401 || response.status === 403) {
    throw new TmdbUpstreamError(
      "TMDB rejected the configured credentials. Check TMDB_READ_ACCESS_TOKEN.",
      response.status,
    );
  }
  if (!response.ok) {
    throw new TmdbUpstreamError(
      "TMDB could not complete this request.",
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new TmdbUpstreamError("TMDB returned unreadable data.", null, {
      cause: error,
    });
  }
}
