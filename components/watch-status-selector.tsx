"use client";

import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { cn } from "@/lib/utils";
import type { WatchStatus } from "@/types/library";

import { Select } from "./ui/field";

export function WatchStatusSelector({
  value,
  onChange,
  disabled = false,
  label = "Watch status",
  className,
  id,
}: {
  value: WatchStatus;
  onChange: (status: WatchStatus) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)} htmlFor={id}>
      <span className="block text-xs font-medium text-muted">
        {label}
      </span>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as WatchStatus)}
      >
        {WATCH_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {WATCH_STATUS_META[status].label}
          </option>
        ))}
      </Select>
    </label>
  );
}
