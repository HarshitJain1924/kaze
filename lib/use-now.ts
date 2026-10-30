"use client";

import { useEffect, useState } from "react";

/**
 * A clock that starts at the server-provided instant, so the first client
 * render matches SSR exactly, then ticks on the client.
 *
 * Reading `Date.now()` during render makes relative labels ("Aired 2h ago")
 * disagree between the server and the browser, which React reports as a
 * hydration mismatch. Pass the page's server time as `initialNowMs`.
 */
export function useNow(initialNowMs: number, intervalMs = 60_000): number {
  const [now, setNow] = useState(initialNowMs);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
