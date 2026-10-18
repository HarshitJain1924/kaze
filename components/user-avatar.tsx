import { cn, getInitials } from "@/lib/utils";

export function UserAvatar({
  email,
  size = "md",
  className,
}: {
  email: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft font-semibold uppercase text-accent-strong",
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs",
        className,
      )}
    >
      {getInitials(email)}
    </span>
  );
}
