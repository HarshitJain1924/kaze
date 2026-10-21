import { CircuitBreakerOpenError } from "./errors";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  serviceName?: string;
  failureThreshold?: number;
  cooldownMs?: number;
  tripImmediatelyOn?: (error: unknown) => boolean;
  now?: () => number;
}

/**
 * Lightweight in-memory circuit breaker that prevents request storms against
 * degraded or suspended upstream services.
 */
export class CircuitBreaker {
  readonly serviceName: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly tripImmediatelyOn: (error: unknown) => boolean;
  private readonly now: () => number;

  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private nextProbeAt = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.serviceName = options.serviceName ?? "AniList";
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.tripImmediatelyOn =
      options.tripImmediatelyOn ??
      ((error: unknown) => {
        if (!error || typeof error !== "object") return false;
        if (
          "isSuspended" in error &&
          Boolean((error as { isSuspended?: unknown }).isSuspended)
        ) {
          return true;
        }
        if (
          "status" in error &&
          (error as { status?: unknown }).status === 403
        ) {
          return true;
        }
        return false;
      });
    this.now = options.now ?? Date.now.bind(Date);
  }

  isOpen(): boolean {
    const current = this.now();
    if (this.state === "OPEN") {
      if (current >= this.nextProbeAt) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }
    return false;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new CircuitBreakerOpenError(this.serviceName, this.nextProbeAt);
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.nextProbeAt = 0;
  }

  recordFailure(error?: unknown): void {
    this.consecutiveFailures += 1;
    const shouldTripNow = error ? this.tripImmediatelyOn(error) : false;

    if (shouldTripNow || this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextProbeAt = this.now() + this.cooldownMs;
    }
  }

  trip(): void {
    this.state = "OPEN";
    this.nextProbeAt = this.now() + this.cooldownMs;
  }

  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.nextProbeAt = 0;
  }

  getState(): {
    state: CircuitState;
    consecutiveFailures: number;
    nextProbeAt: number | null;
  } {
    // Calling isOpen() triggers the lazy transition from OPEN -> HALF_OPEN when cooldown expired
    const open = this.isOpen();
    return {
      state: open ? "OPEN" : this.state,
      consecutiveFailures: this.consecutiveFailures,
      nextProbeAt: this.state === "OPEN" ? this.nextProbeAt : null,
    };
  }
}
