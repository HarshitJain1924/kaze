import { handleMediaSearch } from "@/lib/api/media-search";

/** Server-side proxy for anime and manga search. */
export async function GET(request: Request) {
  return handleMediaSearch(request);
}
