/** Typed error raised by the AniList service layer. */
export class AniListError extends Error {
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryAfterMs?: number | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AniListError";
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}
