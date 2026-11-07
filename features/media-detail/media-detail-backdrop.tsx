import Image from "next/image";

import { isHttpUrl } from "@/lib/utils";
import type { MediaDetailView } from "@/lib/media/detail-view";

/**
 * Full-viewport atmospheric artwork extracted from the existing anime detail
 * page. It uses a landscape backdrop when available and falls back to a
 * portrait poster stage, so TMDB movies and TV share the same treatment.
 */
export function MediaDetailBackdrop({
  view,
}: {
  view: Pick<MediaDetailView, "backdropUrl" | "posterUrl" | "accentColor">;
}) {
  const hasBanner = Boolean(view.backdropUrl && isHttpUrl(view.backdropUrl));
  const hasCover = Boolean(view.posterUrl && isHttpUrl(view.posterUrl));
  const accentColor = view.accentColor;

  if (hasBanner && view.backdropUrl) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen select-none overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 scale-110 opacity-15 blur-[80px] saturate-[1.4] dark:opacity-20 dark:brightness-95">
          <Image
            src={view.backdropUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div className="relative h-full w-full">
          <Image
            src={view.backdropUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover object-top opacity-100 transition-opacity dark:opacity-65 dark:brightness-95 dark:contrast-105"
          />
        </div>

        {accentColor ? (
          <div
            className="pointer-events-none absolute inset-0 hidden opacity-15 mix-blend-screen dark:block"
            style={{
              background: `radial-gradient(circle at 75% 25%, ${accentColor} 0%, transparent 65%)`,
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/15 via-black/5 to-transparent dark:from-black/60 dark:via-black/20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-30% via-bg/25 via-60% to-bg/75 dark:via-bg/40 dark:to-bg" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 via-35% to-transparent dark:from-bg dark:via-bg/75 dark:via-45%" />
      </div>
    );
  }

  if (hasCover && view.posterUrl) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen select-none overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0 scale-125 opacity-20 blur-[90px] saturate-[1.4] dark:opacity-25">
          <Image
            src={view.posterUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-full overflow-hidden opacity-90 dark:opacity-40 sm:w-[500px] lg:w-[680px]">
          <Image
            src={view.posterUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="(max-width: 640px) 100vw, 680px"
            className="object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 via-30% to-transparent dark:via-bg/50" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg/80 to-transparent dark:from-bg" />
        </div>

        {accentColor ? (
          <div
            className="pointer-events-none absolute inset-0 hidden opacity-15 mix-blend-screen dark:block"
            style={{
              background: `radial-gradient(circle at 75% 25%, ${accentColor} 0%, transparent 65%)`,
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/15 via-black/5 to-transparent dark:from-black/60 dark:via-black/20" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 via-35% to-transparent dark:from-bg dark:via-bg/75 dark:via-45%" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen select-none overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_70%_20%,var(--accent-soft),transparent_70%)] opacity-40" />
    </div>
  );
}
