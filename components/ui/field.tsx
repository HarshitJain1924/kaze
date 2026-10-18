import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-xl border border-border bg-surface-2/70 px-3 text-sm text-fg placeholder:text-faint transition-colors hover:border-border focus:border-accent focus:bg-surface-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const selectClass =
  "h-10 w-full appearance-none rounded-xl border border-border bg-surface-2/70 pl-3 pr-9 text-sm text-fg transition-colors hover:border-border focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "w-full resize-y rounded-xl border border-border bg-surface-2/70 px-3 py-2.5 text-sm leading-relaxed text-fg placeholder:text-faint transition-colors hover:border-border focus:border-accent focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: ComponentProps<"textarea">) {
  return <textarea className={cn(textareaClass, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(selectClass, className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-[0.08em] text-muted"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}
