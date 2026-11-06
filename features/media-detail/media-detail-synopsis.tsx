import Link from "next/link";
import type { ReactNode } from "react";

import { ExternalIcon } from "@/components/icons";
import type { MediaDetailGenre } from "@/lib/media/detail-view";

interface MediaDetailSynopsisProps {
  synopsis: string | null;
  genres: MediaDetailGenre[];
  tags: string[];
  sourceUrl: string;
  sourceLabel: string;
  children?: ReactNode;
}

/** Shared synopsis, genre/tag treatment and source attribution. */
export function MediaDetailSynopsis({
  synopsis,
  genres,
  tags,
  sourceUrl,
  sourceLabel,
  children,
}: MediaDetailSynopsisProps) {
  return (
    <section aria-labelledby="synopsis-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="synopsis-heading"
          className="font-display text-lg font-semibold text-fg"
        >
          Synopsis
        </h2>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-fg"
        >
          {sourceLabel}
          <ExternalIcon className="h-3 w-3" />
        </a>
      </div>

      <p className="mt-3 max-w-[68ch] whitespace-pre-line text-sm leading-[1.65] text-muted sm:text-[15px]">
        {synopsis ?? "No synopsis has been provided for this title."}
      </p>

      {genres.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {genres.map((genre) =>
            genre.href ? (
              <Link
                key={genre.name}
                href={genre.href}
                className="rounded border border-border-subtle bg-surface-2/80 px-2.5 py-1 text-xs font-medium text-muted shadow-xs transition-colors hover:border-border hover:bg-surface-3 hover:text-fg"
              >
                {genre.name}
              </Link>
            ) : (
              <span
                key={genre.name}
                className="rounded border border-border-subtle bg-surface-2/80 px-2.5 py-1 text-xs font-medium text-muted"
              >
                {genre.name}
              </span>
            ),
          )}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
            Tags
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {tags.slice(0, 12).join(" · ")}
          </p>
        </div>
      ) : null}

      {children ? (
        <div className="mt-6 border-t border-border pt-5">{children}</div>
      ) : null}
    </section>
  );
}
