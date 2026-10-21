/** Typed error raised by the AniList service layer. */
export class AniListError extends Error {
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  readonly isSuspended: boolean;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryAfterMs?: number | null;
      cause?: unknown;
      isSuspended?: boolean;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AniListError";
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.isSuspended = options.isSuspended ?? false;
  }

  get retryAfterSeconds(): number | null {
    return this.retryAfterMs !== null
      ? Math.round(this.retryAfterMs / 1000)
      : null;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Specific error raised when AniList returns an upstream service suspension (HTTP 403 / maintenance). */
export class AniListSuspendedError extends AniListError {
  constructor(
    message = "The AniList API has been temporarily disabled due to severe stability issues.",
    options: { cause?: unknown } = {},
  ) {
    super(message, { status: 403, isSuspended: true, cause: options.cause });
    this.name = "AniListSuspendedError";
  }
}

/** Raised when a circuit breaker blocks requests to a degraded or suspended service. */
export class CircuitBreakerOpenError extends Error {
  readonly serviceName: string;
  readonly resetAt: number;

  constructor(serviceName: string, resetAt: number) {
    super(
      `${serviceName} is temporarily unavailable (circuit breaker open). Next probe at ${new Date(resetAt).toISOString()}`,
    );
    this.name = "CircuitBreakerOpenError";
    this.serviceName = serviceName;
    this.resetAt = resetAt;
  }
}
