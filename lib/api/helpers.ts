import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getViewer, type Viewer } from "@/lib/auth";
import { LibraryProgressError } from "@/lib/library-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  LibraryDataError,
  LibraryEntryNotFoundError,
} from "@/repositories/library";
import type { Database } from "@/types/database";

export interface ApiContext {
  viewer: Viewer;
  supabase: SupabaseClient<Database>;
}

type ApiContextResult =
  | { ok: true; context: ApiContext }
  | { ok: false; response: NextResponse };

export async function getApiContext(): Promise<ApiContextResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in to manage your library.", code: "unauthenticated" },
        { status: 401 },
      ),
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Supabase is not configured for this environment.",
          code: "not_configured",
        },
        { status: 503 },
      ),
    };
  }

  return { ok: true, context: { viewer, supabase } };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonError(
  message: string,
  status: number,
  code: string,
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

/** Maps repository errors to safe client responses. */
export function libraryErrorResponse(error: unknown): NextResponse {
  if (error instanceof LibraryProgressError) {
    return jsonError(error.message, 422, "invalid_progress");
  }
  if (error instanceof LibraryEntryNotFoundError) {
    return jsonError(error.message, 404, "not_found");
  }
  if (error instanceof LibraryDataError) {
    console.error("[api/library] database failure", error);
    return jsonError(
      "Could not save your library change.",
      500,
      "library_unavailable",
    );
  }

  console.error("[api/library] unexpected failure", error);
  return jsonError("Something went wrong.", 500, "unexpected_error");
}
