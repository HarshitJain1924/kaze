import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Viewer } from "@/types/viewer";

export type { Viewer };

/**
 * Returns the signed-in user, or null when signed out / unconfigured.
 * In development, an explicit, synthetic preview fixture is only enabled if
 * ALLOW_LOCAL_PREVIEW is set in the environment, protecting real identities and
 * preventing preview mechanisms from running in production.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_LOCAL_PREVIEW === "true"
    ) {
      return {
        id: "00000000-0000-0000-0000-000000000001",
        email: "preview-developer@kaze.local",
        createdAt: "2026-01-01T00:00:00.000Z",
      };
    }
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (
      error.name === "AuthSessionMissingError" ||
      error.status === 400 ||
      error.status === 401
    ) {
      return null;
    }
    console.error("[auth] failed to resolve viewer", error.message);
    return null;
  }

  if (!data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    createdAt: data.user.created_at ?? null,
  };
}

/** Requires a signed-in viewer, redirecting to the login screen otherwise. */
export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    const next = encodeURIComponent(returnTo);
    redirect(`/login?next=${next}`);
  }
  return viewer;
}
