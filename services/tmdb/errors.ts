export class TmdbNotConfiguredError extends Error {
  constructor() {
    super(
      "TMDB is not configured. Set TMDB_READ_ACCESS_TOKEN on the server to search movies and TV shows.",
    );
    this.name = "TmdbNotConfiguredError";
  }
}

export class TmdbNotFoundError extends Error {
  constructor(message = "This title could not be found on TMDB.") {
    super(message);
    this.name = "TmdbNotFoundError";
  }
}

export class TmdbRateLimitError extends Error {
  readonly retryAfterSeconds: number | null;

  constructor(retryAfterSeconds: number | null = null) {
    super("TMDB is rate limiting requests. Try again in a moment.");
    this.name = "TmdbRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class TmdbUpstreamError extends Error {
  readonly status: number | null;

  constructor(
    message = "TMDB could not be reached. Try again in a moment.",
    status: number | null = null,
    options: { cause?: unknown } = {},
  ) {
    super(message, options);
    this.name = "TmdbUpstreamError";
    this.status = status;
  }
}

export class TmdbValidationError extends Error {
  constructor(message = "TMDB returned an unexpected response.") {
    super(message);
    this.name = "TmdbValidationError";
  }
}
