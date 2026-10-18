"use client";

import { StarIcon } from "@/components/icons";
import { MAX_SCORE } from "@/types/library";
import { cn } from "@/lib/utils";

export function RatingControl({
  score,
  onChange,
  disabled = false,
  className,
}: {
  score: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Your rating
        </span>
        <span className="text-xs text-faint">
          {score ? `${score} / ${MAX_SCORE}` : "Not rated"}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Personal rating from 1 to 10"
        className="flex items-center gap-0.5"
      >
        {Array.from({ length: MAX_SCORE }, (_, index) => {
          const value = index + 1;
          const active = score !== null && value <= score;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={score === value}
              aria-label={`Rate ${value} out of ${MAX_SCORE}`}
              disabled={disabled}
              onClick={() => onChange(score === value ? null : value)}
              className={cn(
                "flex h-8 w-7 items-center justify-center rounded-md transition-colors hover:bg-surface-2 disabled:opacity-50",
                active ? "text-warning" : "text-faint",
              )}
            >
              <StarIcon
                className={cn("h-4 w-4", active && "fill-current")}
              />
            </button>
          );
        })}
      </div>

      {score ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-xs text-faint underline-offset-2 transition-colors hover:text-fg hover:underline disabled:opacity-50"
        >
          Clear rating
        </button>
      ) : null}
    </div>
  );
}
