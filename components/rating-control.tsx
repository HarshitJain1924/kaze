"use client";

import { useState } from "react";
import { StarIcon } from "@/components/icons";
import { MAX_SCORE } from "@/types/library";
import { cn } from "@/lib/utils";

const SCORE_LABELS: Record<number, string> = {
  10: "Masterpiece",
  9: "Great",
  8: "Very Good",
  7: "Good",
  6: "Fine",
  5: "Average",
  4: "Bad",
  3: "Very Bad",
  2: "Horrible",
  1: "Appalling",
};

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
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const displayScore = hoverScore ?? score;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">Your rating</span>
        <span className="text-xs text-faint">
          {displayScore ? (
            <span className="text-warning font-medium">
              {displayScore} / {MAX_SCORE} · {SCORE_LABELS[displayScore]}
            </span>
          ) : (
            "Not rated"
          )}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Personal rating from 1 to 10"
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHoverScore(null)}
      >
        {Array.from({ length: MAX_SCORE }, (_, index) => {
          const value = index + 1;
          const active = displayScore !== null && value <= displayScore;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={score === value}
              aria-label={`Rate ${value} out of ${MAX_SCORE}`}
              disabled={disabled}
              onMouseEnter={() => !disabled && setHoverScore(value)}
              onClick={() => onChange(score === value ? null : value)}
              className={cn(
                "flex h-8 w-7 items-center justify-center rounded-lg transition-transform duration-150 hover:scale-110 disabled:opacity-50",
                active ? "text-warning" : "text-faint hover:text-warning/80",
              )}
            >
              <StarIcon
                className={cn("h-4 w-4 transition-transform", active && "fill-current")}
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
