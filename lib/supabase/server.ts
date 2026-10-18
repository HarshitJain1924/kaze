import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

import { getSupabaseConfig } from "./config";

/**
 * Request-scoped Supabase client for Server Components, Server Actions and
 * route handlers. Auth cookies are read from the incoming request; the root
 * proxy is responsible for refreshing them on the response.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database> | null> {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies. Session refresh happens
          // in proxy.ts, so this is expected during render.
        }
      },
    },
  });
}
