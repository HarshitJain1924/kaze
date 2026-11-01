import { NextResponse } from "next/server";

import {
  getApiContext,
  libraryErrorResponse,
  readJsonBody,
} from "@/lib/api/helpers";
import { addToLibrarySchema } from "@/lib/validation/library";
import { createLibraryRepository } from "@/repositories/library";

export async function POST(request: Request) {
  const auth = await getApiContext();
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = addToLibrarySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid library request",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  try {
    const repository = createLibraryRepository(auth.context.supabase);
    const result = await repository.add(auth.context.viewer.id, {
      anilistId: parsed.data.anilistId,
      ...(parsed.data.mediaType === "manga"
        ? { mediaType: "manga" as const }
        : {}),
      status: parsed.data.status,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return libraryErrorResponse(error);
  }
}
