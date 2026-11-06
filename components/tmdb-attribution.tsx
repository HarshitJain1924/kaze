import Link from "next/link";

import { cn } from "@/lib/utils";

export function TmdbAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-faint", className)}>
      This product uses the TMDB API but is not endorsed or certified by TMDB.{" "}
      <Link
        href="/about"
        className="underline decoration-border underline-offset-2 transition-colors hover:text-fg"
      >
        About &amp; credits
      </Link>
    </p>
  );
}
