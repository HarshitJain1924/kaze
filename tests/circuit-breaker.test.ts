import { describe, expect, it, vi } from "vitest";

import { CircuitBreaker } from "@/services/anilist/circuit-breaker";
import {
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";

function clock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("CircuitBreaker", () => {
  it("opens immediately on a confirmed suspension", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      cooldownMs: 30_000,
      now: time.now,
    });

    breaker.recordFailure(new AniListSuspendedError());

    expect(breaker.getState()).toMatchObject({
      state: "OPEN",
      nextProbeAt: 30_000,
    });
    expect(breaker.isBlocked()).toBe(true);
  });

  it("opens after the configured number of transient failures", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000,
      now: time.now,
    });

    breaker.recordFailure(new Error("1"));
    breaker.recordFailure(new Error("2"));
    expect(breaker.getState().state).toBe("CLOSED");

    breaker.recordFailure(new Error("3"));
    expect(breaker.getState().state).toBe("OPEN");
  });

  it("grants exactly one half-open probe after the cooldown", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: time.now,
    });

    breaker.recordFailure(new Error("boom"));
    expect(breaker.isBlocked()).toBe(true);

    time.advance(1000);
    expect(breaker.getState().state).toBe("HALF_OPEN");

    const permits = Array.from({ length: 10 }, () => breaker.tryAcquire());
    expect(permits.filter(Boolean)).toHaveLength(1);
    expect(breaker.isBlocked()).toBe(true);
  });

  it("closes the circuit when the probe succeeds", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: time.now,
    });

    breaker.recordFailure(new Error("boom"));
    time.advance(1000);
    expect(breaker.tryAcquire()).toBe(true);

    breaker.recordSuccess();

    expect(breaker.getState().state).toBe("CLOSED");
    expect(breaker.isBlocked()).toBe(false);
    expect(breaker.getState().consecutiveFailures).toBe(0);
  });

  it("reopens immediately when the probe fails", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000,
      now: time.now,
    });

    // Trip it with a single confirmed suspension.
    breaker.recordFailure(new AniListSuspendedError());
    time.advance(1000);

    expect(breaker.tryAcquire()).toBe(true);
    // A failed probe reopens even though the failure threshold is 3.
    breaker.recordFailure(new Error("probe failed"));

    expect(breaker.getState()).toMatchObject({
      state: "OPEN",
      nextProbeAt: 2000,
    });
    expect(breaker.isBlocked()).toBe(true);
  });

  it("does not mutate state when status is read", () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: time.now,
    });

    breaker.recordFailure(new Error("boom"));
    time.advance(1000);

    // Repeated reads must not consume the probe permit.
    for (let index = 0; index < 5; index += 1) {
      expect(breaker.getState().state).toBe("HALF_OPEN");
      expect(breaker.getStatus()).toBe("HALF_OPEN");
    }
    expect(breaker.isBlocked()).toBe(false);
  });

  it("wraps actions and records exactly one outcome per call", async () => {
    const time = clock();
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000,
      now: time.now,
    });

    await expect(
      breaker.execute(async () => {
        throw new Error("upstream down");
      }),
    ).rejects.toThrow("upstream down");
    expect(breaker.getState().consecutiveFailures).toBe(1);

    await expect(breaker.execute(async () => "ok")).resolves.toBe("ok");
    expect(breaker.getState().state).toBe("CLOSED");
  });

  it("rejects callers while blocked without invoking the action", async () => {
    const breaker = new CircuitBreaker({ cooldownMs: 10_000 });
    breaker.trip();

    const action = vi.fn(async () => "never");
    await expect(breaker.execute(action)).rejects.toBeInstanceOf(
      CircuitBreakerOpenError,
    );
    expect(action).not.toHaveBeenCalled();
  });
});
