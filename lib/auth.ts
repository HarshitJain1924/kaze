import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Viewer } from "@/types/viewer";

export type { Viewer };

/** Returns the signed-in user, or null when signed out / unconfigured. */
export async function getViewer(): Promise<Viewer | null> {
  if (process.env.NODE_ENV !== "production") {
    try {
      const cookieStore = await cookies();
      if (cookieStore.get("kaze_preview_user")?.value === "1") {
        return {
          id: "602bf6cc-fb81-41ce-b1e3-5f31c398c0d9",
          email: "augstunyt2004@gmail.com",
          createdAt: "2026-10-18T00:00:00.000Z",
        };
      }
    } catch {
      // ignore during prerender/static
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
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
