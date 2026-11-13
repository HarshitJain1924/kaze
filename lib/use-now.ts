"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * A clock that starts at the server-provided instant, so the first client
 * render matches SSR exactly, then ticks on the client.
 *
 * Reading `Date.now()` during render makes relative labels ("Aired 2h ago")
 * disagree between the server and the browser, which React reports as a
 * hydration mismatch. Pass the page's server time as `initialNowMs`.
 */
const minuteListeners = new Set<() => void>();
let minuteTimer: ReturnType<typeof setInterval> | null = null;

function subscribeToMinute(onChange: () => void) {
  minuteListeners.add(onChange);
  if (minuteTimer === null) {
    minuteTimer = setInterval(() => {
      for (const listener of minuteListeners) listener();
    }, 30_000);
  }
  return () => {
    minuteListeners.delete(onChange);
    if (minuteListeners.size === 0 && minuteTimer !== null) {
      clearInterval(minuteTimer);
      minuteTimer = null;
    }
  };
}

function getMinuteSnapshot(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/**
 * The current minute-aligned instant, or `null` during SSR and the hydration
 * render. Components use the null snapshot to keep the server markup and let
 * timezone-sensitive labels settle on the viewer's clock afterwards.
 */
export function useMinuteClock(): number | null {
  return useSyncExternalStore(
    subscribeToMinute,
    getMinuteSnapshot,
    () => null,
  );
}

export function useNow(initialNowMs: number, intervalMs = 60_000): number {
  const [now, setNow] = useState(initialNowMs);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
