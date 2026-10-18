import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { LibraryProvider } from "@/features/library/library-provider";
import { loadLibraryItems } from "@/features/library/load-library";
import { getViewer } from "@/lib/auth";
import type { LibraryItem } from "@/types/library";

// Every screen in this group depends on the signed-in viewer and live
// provider data, so nothing here should be prerendered as static HTML.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getViewer();

  let items: LibraryItem[] = [];
  let libraryError = false;

  if (viewer) {
    try {
      items = await loadLibraryItems(viewer.id);
    } catch (error) {
      console.error("[app-layout] could not load library", error);
      libraryError = true;
    }
  }

  const librarySnapshotKey = libraryError
    ? "error"
    : items.length === 0
      ? "empty"
      : items
          .map((item) => `${item.entry.id}:${item.entry.updatedAt}`)
          .join("|");

  return (
    <LibraryProvider
      key={librarySnapshotKey}
      initialItems={items}
      canWrite={viewer !== null}
      loadError={libraryError}
    >
      <AppShell viewer={viewer}>{children}</AppShell>
    </LibraryProvider>
  );
}
