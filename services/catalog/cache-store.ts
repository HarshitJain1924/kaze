import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database";

/**
 * A single catalogue metadata record that is safe to persist outside the
 * process. Payloads only ever contain public provider metadata — never a
 * user id, library entry or episode progress.
 */
export interface PersistedCacheRecord {
  key: string;
  payload: unknown;
  cachedAt: number;
  freshUntil: number;
  expiresAt: number;
}

/**
 * Durable, cross-instance storage for public catalogue metadata.
 *
 * Implementations must never throw on read; callers treat any error as a cache
 * miss so a broken store cannot take the catalogue down with it.
 */
export interface CatalogPersistence {
  readonly name: string;
  load(): Promise<PersistedCacheRecord[]>;
  save(records: PersistedCacheRecord[]): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export class CatalogPersistenceError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "CatalogPersistenceError";
  }
}

const TABLE = "catalog_cache";
/** Hard ceiling on how many records are hydrated into one server instance. */
const MAX_HYDRATED_RECORDS = 1_500;

/**
 * Reads the server-only Supabase credentials.
 *
 * The service-role key is used exclusively on the server to write the shared
 * catalogue cache. It is never exposed through a `NEXT_PUBLIC_` variable and
 * the table has no policies for `anon` or `authenticated`, so browser clients
 * cannot read or write it.
 */
export interface CatalogPersistenceEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
}

export function createCatalogPersistence(
  env: CatalogPersistenceEnv = process.env,
): CatalogPersistence | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
  } catch {
    return null;
  }

  return new SupabaseCatalogPersistence(url, serviceRoleKey);
}

export class SupabaseCatalogPersistence implements CatalogPersistence {
  readonly name = "supabase";

  private readonly client: SupabaseClient<Database>;
  private lastPruneAt = 0;
  private static readonly PRUNE_INTERVAL_MS = 60 * 60 * 1000;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async load(): Promise<PersistedCacheRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("key,payload,cached_at,fresh_until,expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(MAX_HYDRATED_RECORDS);

    if (error) {
      throw new CatalogPersistenceError(
        "Could not read the catalogue cache",
        { cause: error },
      );
    }

    const records: PersistedCacheRecord[] = [];
    for (const row of data ?? []) {
      const cachedAt = Date.parse(row.cached_at);
      const freshUntil = Date.parse(row.fresh_until);
      const expiresAt = Date.parse(row.expires_at);
      if (
        typeof row.key !== "string" ||
        !Number.isFinite(cachedAt) ||
        !Number.isFinite(freshUntil) ||
        !Number.isFinite(expiresAt)
      ) {
        continue;
      }
      records.push({
        key: row.key,
        payload: row.payload,
        cachedAt,
        freshUntil,
        expiresAt,
      });
    }
    return records;
  }

  async save(records: PersistedCacheRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const rows = records.map((record) => ({
      key: record.key,
      payload: record.payload as Json,
      cached_at: new Date(record.cachedAt).toISOString(),
      fresh_until: new Date(record.freshUntil).toISOString(),
      expires_at: new Date(record.expiresAt).toISOString(),
      updated_at: updatedAt,
    }));

    const { error } = await this.client
      .from(TABLE)
      .upsert(rows, { onConflict: "key" });

    if (error) {
      throw new CatalogPersistenceError(
        "Could not write the catalogue cache",
        { cause: error },
      );
    }

    // Keep the shared table from accumulating expired rows. Pruning is
    // best-effort: failing it must not fail the write that just succeeded.
    const now = Date.now();
    if (now - this.lastPruneAt >= SupabaseCatalogPersistence.PRUNE_INTERVAL_MS) {
      this.lastPruneAt = now;
      const { error: pruneError } = await this.client
        .from(TABLE)
        .delete()
        .lt("expires_at", new Date(now).toISOString());
      if (pruneError) {
        console.warn(
          "[catalog-cache] could not prune expired rows",
          pruneError.message,
        );
      }
    }
  }

  async remove(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const { error } = await this.client.from(TABLE).delete().in("key", keys);
    if (error) {
      throw new CatalogPersistenceError(
        "Could not prune the catalogue cache",
        { cause: error },
      );
    }
  }
}
