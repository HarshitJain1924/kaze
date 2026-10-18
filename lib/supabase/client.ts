"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Browser client using only the publishable (anon) key. RLS enforces access
 * to personal data, so this key is safe to ship to the browser.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (browserClient) {
    return browserClient;
  }

  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  browserClient = createBrowserClient<Database>(
    config.url,
    config.publishableKey,
  );
  return browserClient;
}
