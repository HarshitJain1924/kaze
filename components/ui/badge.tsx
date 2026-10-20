import { WATCH_STATUS_META } from "@/lib/library-meta";
import { cn } from "@/lib/utils";
import type { WatchStatus } from "@/types/library";

export function StatusBadge({
  status,
  className,
  showLabel = true,
}: {
  status: WatchStatus;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = WATCH_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border-subtle bg-surface-2/90 px-2.5 py-1 text-xs font-medium leading-none text-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}
