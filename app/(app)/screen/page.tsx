import type { Metadata } from "next";

import { ScreenSearch } from "@/features/screen/screen-search";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Films & TV",
  description:
    "Search movies and television series and keep them in your Kaze library.",
};

export default async function ScreenPage() {
  const viewer = await getViewer();

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface/85 p-6 backdrop-blur-xl sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Screen Archive
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Films &amp; TV
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            A separate shelf for cinema and television, matched by TMDB ids.
            Track films as watched, follow series season by season, and keep
            ratings and notes beside your anime archive.
          </p>
        </div>
      </header>

      <ScreenSearch canWrite={viewer !== null} />
    </div>
  );
}
