import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-contrast shadow-lg shadow-accent/20",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        className="h-5 w-5"
      >
        <path d="M4 7.5h16" />
        <path d="M6.5 7.5V19M17.5 7.5V19" />
        <path d="M4 11h16" />
        <path d="M12 4v3.5" />
      </svg>
    </span>
  );
}

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg",
        className,
      )}
      aria-label="Kaze home"
    >
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-bold tracking-[0.22em] text-fg">
          KAZE
        </span>
        {compact ? null : (
          <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.3em] text-faint">
            Anime tracker
          </span>
        )}
      </span>
    </Link>
  );
}
