export type CatalogUnavailableReason =
  | "upstream_suspended"
  | "upstream_unavailable"
  | "rate_limited";

export interface CatalogUnavailableOptions {
  reason?: CatalogUnavailableReason;
  retryAfterMs?: number | null;
  cause?: unknown;
}

/**
 * Raised when the catalogue cannot answer at all — every provider and the
 * cache failed. Callers must show an unavailable state instead of
 * misrepresenting the result as a genuine empty result set.
 */
export class CatalogUnavailableError extends Error {
  readonly reason: CatalogUnavailableReason;
  readonly retryAfterMs: number | null;

  constructor(message: string, options: CatalogUnavailableOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "CatalogUnavailableError";
    this.reason = options.reason ?? "upstream_unavailable";
    this.retryAfterMs = options.retryAfterMs ?? null;
  }

  /** Stable machine-readable code for API responses. */
  get code(): string {
    switch (this.reason) {
      case "upstream_suspended":
        return "upstream_suspended";
      case "rate_limited":
        return "rate_limited";
      default:
        return "catalog_unavailable";
    }
  }

  /** User-facing text; never contains provider internals or stack traces. */
  get userMessage(): string {
    switch (this.reason) {
      case "upstream_suspended":
        return "The anime catalogue provider is temporarily suspended. Your library, ratings and progress are unaffected.";
      case "rate_limited":
        return "The anime catalogue is rate limiting requests. Please try again in a moment.";
      default:
        return "The anime catalogue is temporarily unavailable. Your library, ratings and progress are unaffected.";
    }
  }
}
