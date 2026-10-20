"use client";

import { useRef } from "react";

import { CheckIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn, pluralize } from "@/lib/utils";

export function WatchProgressControl({
  progress,
  episodes,
  onChange,
  disabled = false,
  compact = false,
  className,
}: {
  progress: number;
  episodes: number | null;
  onChange: (progress: number) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const max = episodes !== null && episodes > 0 ? episodes : null;
  const atEnd = max !== null && progress >= max;

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = String(progress);
    }
  };

  const commit = () => {
    const raw = inputRef.current?.value ?? "";
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value < 0) {
      resetInput();
      return;
    }
    const bounded = max !== null ? Math.min(value, max) : value;
    if (bounded === progress) {
      resetInput();
      return;
    }
    onChange(bounded);
  };

  const percent = max !== null ? Math.min(100, (progress / max) * 100) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted">Episode progress</span>
        <span className="text-xs text-faint">
          {max !== null
            ? `${progress} of ${max} ${pluralize(max, "episode")}`
            : episodes === null
              ? "Total episodes unknown"
              : `${progress} watched`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onChange(Math.max(0, progress - 1))}
          disabled={disabled || progress <= 0}
          aria-label="Decrease episode progress"
        >
          <MinusIcon className="h-4 w-4" />
        </Button>

        <label className="sr-only" htmlFor={`progress-${progress}`}>
          Episodes watched
        </label>
        <input
          key={progress}
          ref={inputRef}
          id={`progress-${progress}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={max ?? undefined}
          defaultValue={progress}
          disabled={disabled}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              resetInput();
              event.currentTarget.blur();
            }
          }}
          className={cn(inputClass, "h-9 w-16 px-2 text-center tabular-nums")}
        />

        <Button
          variant="secondary"
          size="icon"
          onClick={() =>
            onChange(max !== null ? Math.min(max, progress + 1) : progress + 1)
          }
          disabled={disabled || atEnd}
          aria-label="Increase episode progress"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>

        {atEnd ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckIcon className="h-3.5 w-3.5" />
            Complete
          </span>
        ) : null}
      </div>

      {!compact && max !== null ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
