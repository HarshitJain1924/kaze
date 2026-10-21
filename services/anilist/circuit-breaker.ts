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
 * In-memory circuit breaker that prevents request storms against a degraded
 * or suspended upstream service.
 *
 * A half-open circuit grants exactly one probe request. While that probe is in
 * flight every other caller is rejected, so recovery can never turn into a
 * burst of simultaneous requests. A successful probe closes the circuit; a
 * failed probe reopens it immediately with a fresh cooldown.
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
  private probeInFlight = false;

  constructor(options: CircuitBreakerOptions = {}) {
    this.serviceName = options.serviceName ?? "AniList";
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? 30_000);
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

  /**
   * Pure view of the circuit state. Reading status never mutates the breaker,
   * so diagnostics cannot accidentally grant a probe.
   */
  getStatus(now: number = this.now()): CircuitState {
    if (this.state === "OPEN" && now >= this.nextProbeAt) {
      return "HALF_OPEN";
    }
    return this.state;
  }

  /** True while no request may be sent upstream. */
  isBlocked(now: number = this.now()): boolean {
    const status = this.getStatus(now);
    if (status === "OPEN") return true;
    if (status === "HALF_OPEN") return this.probeInFlight;
    return false;
  }

  /** Backwards-compatible alias: `true` means requests are being rejected. */
  isOpen(): boolean {
    return this.isBlocked();
  }

  /**
   * Requests permission for one upstream attempt. The `OPEN -> HALF_OPEN`
   * transition happens here and only one caller receives the probe permit.
   */
  tryAcquire(): boolean {
    const now = this.now();

    if (this.state === "OPEN") {
      if (now < this.nextProbeAt) {
        return false;
      }
      this.state = "HALF_OPEN";
      this.probeInFlight = true;
      return true;
    }

    if (this.state === "HALF_OPEN") {
      if (this.probeInFlight) {
        return false;
      }
      this.probeInFlight = true;
      return true;
    }

    return true;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (!this.tryAcquire()) {
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
    this.probeInFlight = false;
  }

  /**
   * Records one failed *request* (not one failed retry). Callers must invoke
   * this at most once per upstream operation.
   */
  recordFailure(error?: unknown): void {
    this.probeInFlight = false;
    this.consecutiveFailures += 1;

    if (this.state === "HALF_OPEN") {
      // A failed recovery probe reopens the circuit right away.
      this.open();
      return;
    }

    if (error && this.tripImmediatelyOn(error)) {
      this.open();
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.open();
    }
  }

  trip(): void {
    this.open();
  }

  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.nextProbeAt = 0;
    this.probeInFlight = false;
  }

  getState(): {
    state: CircuitState;
    consecutiveFailures: number;
    nextProbeAt: number | null;
    probeInFlight: boolean;
  } {
    const state = this.getStatus();
    return {
      state,
      consecutiveFailures: this.consecutiveFailures,
      nextProbeAt: state === "OPEN" ? this.nextProbeAt : null,
      probeInFlight: this.probeInFlight,
    };
  }

  private open(): void {
    this.state = "OPEN";
    this.nextProbeAt = this.now() + this.cooldownMs;
    this.probeInFlight = false;
  }
}
