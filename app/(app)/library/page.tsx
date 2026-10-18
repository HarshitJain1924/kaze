import type { Metadata } from "next";

import type { LibraryStatusFilter } from "@/components/library-toolbar";
import { LibraryBrowser } from "@/features/library/library-browser";
import { requireViewer } from "@/lib/auth";
import { isWatchStatus } from "@/types/library";

export const metadata: Metadata = {
  title: "My library",
  description: "Your personal anime watchlist, progress, ratings and notes.",
};

function parseStatus(value: string | string[] | undefined): LibraryStatusFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isWatchStatus(candidate) ? candidate : "all";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireViewer("/library");
  const params = await searchParams;
  const initialStatus = parseStatus(params.status);
  return (
    <LibraryBrowser key={initialStatus} initialStatus={initialStatus} />
  );
}
