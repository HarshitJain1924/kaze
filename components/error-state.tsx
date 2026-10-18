import type { ReactNode } from "react";

import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  action,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-danger/25 bg-danger-soft/40 px-5 py-10 text-center",
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-danger/25 bg-surface text-danger">
        <AlertIcon className="h-5 w-5" />
      </div>
      <h3 className="font-display text-base font-semibold text-fg">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
        {message}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
