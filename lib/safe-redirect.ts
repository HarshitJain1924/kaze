/**
 * Allows only same-origin, absolute paths as post-auth destinations.
 *
 * A plain `startsWith("/") && !startsWith("//")` check is not enough: the URL
 * parser treats a backslash as a path separator, so `/\evil.com` resolves to
 * `https://evil.com/`. Resolving against a fixed origin and comparing origins
 * rejects every such form, including `//host` and control-character tricks.
 */
const PLACEHOLDER_ORIGIN = "https://kaze.invalid";
const FALLBACK = "/";

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return FALLBACK;

  const candidate = value.trim();
  if (!candidate.startsWith("/")) return FALLBACK;
  // Browsers normalise these to a separator before parsing the URL.
  if (candidate.includes("\\")) return FALLBACK;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return FALLBACK;

  try {
    const url = new URL(candidate, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return FALLBACK;
    const target = `${url.pathname}${url.search}${url.hash}`;
    return target.startsWith("/") ? target : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
