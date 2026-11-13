"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/http";
import type { TmdbLibraryItem } from "@/types/tmdb";

/**
 * Loads the viewer's film and TV library once per mount so client surfaces such
 * as custom lists can match curated entries against real watch state. Signed-out
 * visitors simply get an empty list.
 */
export function useScreenLibraryItems(): TmdbLibraryItem[] {
  const [items, setItems] = useState<TmdbLibraryItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ items: TmdbLibraryItem[] }>("/api/tmdb/library", {
      signal: controller.signal,
    })
      .then((data) => setItems(data.items ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return items;
}
