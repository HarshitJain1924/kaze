import { handleMediaSearch } from "@/lib/api/media-search";

/** Legacy anime-only search endpoint. */
export async function GET(request: Request) {
  return handleMediaSearch(request, { forcedType: "anime" });
}
