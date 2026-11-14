"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/http";
import type { TmdbLibraryItem } from "@/types/tmdb";

/** Fired after a film or TV entry is written so every reader refetches. */
export const SCREEN_LIBRARY_CHANGED_EVENT = "kaze:screen-library-changed";

export function notifyScreenLibraryChanged(): void {
  window.dispatchEvent(new Event(SCREEN_LIBRARY_CHANGED_EVENT));
}

/**
 * Loads the viewer's film and TV library once per mount so client surfaces such
 * as custom lists can match curated entries against real watch state. Signed-out
 * visitors simply get an empty list.
 *
 * A write anywhere in the app (including a quick edit from Discover) dispatches
 * `SCREEN_LIBRARY_CHANGED_EVENT`, which refetches instead of leaving stale rows.
 */
export function useScreenLibraryItems(): TmdbLibraryItem[] {
  const [items, setItems] = useState<TmdbLibraryItem[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const onChanged = () => setRevision((current) => current + 1);
    window.addEventListener(SCREEN_LIBRARY_CHANGED_EVENT, onChanged);
    return () =>
      window.removeEventListener(SCREEN_LIBRARY_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ items: TmdbLibraryItem[] }>("/api/tmdb/library", {
      signal: controller.signal,
    })
      .then((data) => setItems(data.items ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [revision]);

  return items;
}
