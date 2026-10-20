import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** A single-screen block: used inside the dashboard where a tall empty
      panel would push real content below the fold. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-surface/60 px-5 text-center",
        compact ? "gap-2 py-6" : "gap-2.5 py-10 sm:py-12",
        className,
      )}
    >
      {icon ? (
        <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-[15px] font-semibold text-fg">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
