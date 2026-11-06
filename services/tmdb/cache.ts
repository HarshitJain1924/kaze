import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

const TABLE = "catalog_cache";
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

interface MemoryRecord {
  payload: unknown;
  freshUntil: number;
  expiresAt: number;
}

const memory = new Map<string, MemoryRecord>();

let client: SupabaseClient<Database> | null | undefined;

function getClient(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    client = null;
    return client;
  }

  try {
    new URL(url);
  } catch {
    client = null;
    return client;
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** Only public catalogue metadata is ever written here. */
export async function readTmdbCache<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const local = memory.get(key);
  if (local) {
    if (local.expiresAt > now) return local.payload as T;
    memory.delete(key);
  }

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("payload,expires_at")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return null;
    if (Date.parse(data.expires_at) <= now) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function writeTmdbCache(
  key: string,
  payload: unknown,
): Promise<void> {
  const now = Date.now();
  const freshUntil = now + FRESH_MS;
  const expiresAt = now + FRESH_MS + STALE_MS;

  memory.set(key, {
    payload,
    freshUntil,
    expiresAt,
  });

  const supabase = getClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from(TABLE).upsert(
      {
        key,
        payload: payload as Json,
        cached_at: new Date(now).toISOString(),
        fresh_until: new Date(freshUntil).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) {
      console.warn("[tmdb-cache] could not persist metadata", error.message);
    }
  } catch {
    // Cache failures must never fail a user request.
  }
}
