"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during the server render and the hydration pass, true afterwards.
 *
 * Client-only stores (localStorage lists) must not paint before hydration, or
 * the server markup and the first client render disagree. This keeps them on a
 * stable placeholder instead of triggering a hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
