import { apiFetch } from "@/lib/http";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 60;

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Catalogue payloads are public metadata, so a short-lived memory cache is safe. */
export function readCachedRequest<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeCachedRequest<T>(key: string, value: T): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function clearRequestCache(): void {
  store.clear();
  inflight.clear();
}

function abortError(): Error {
  if (typeof DOMException === "function") {
    return new DOMException("Aborted", "AbortError");
  }
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * GET JSON through a short-lived cache with in-flight de-duplication, so
 * flipping between tabs, filters and pages reuses what was already fetched.
 * Aborting only detaches the caller; the shared request still fills the cache.
 */
export function fetchCachedJson<T>(
  url: string,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const cached = readCachedRequest<T>(url);
  if (cached !== null) return abortable(Promise.resolve(cached), options.signal);

  let shared = inflight.get(url) as Promise<T> | undefined;
  if (!shared) {
    shared = apiFetch<T>(url)
      .then((value) => {
        writeCachedRequest(url, value);
        return value;
      })
      .finally(() => {
        inflight.delete(url);
      });
    inflight.set(url, shared);
  }

  return abortable(shared, options.signal);
}
