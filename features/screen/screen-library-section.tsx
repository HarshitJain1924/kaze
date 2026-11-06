import { ScreenLibrary } from "@/features/screen/screen-library";
import { loadScreenLibrary } from "@/lib/api/tmdb";

export async function ScreenLibrarySection({
  viewerId,
}: {
  viewerId: string;
}) {
  const items = await loadScreenLibrary(viewerId).catch((error: unknown) => {
    console.error(
      "[screen-library] could not load film and TV entries",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  });

  if (!items || items.length === 0) return null;
  return <ScreenLibrary items={items} />;
}
