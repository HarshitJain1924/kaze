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
        "flex shrink-0 items-center justify-center border border-accent/40 bg-accent/15 font-mono font-bold uppercase text-accent-strong select-none",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs",
        className,
      )}
    >
      {getInitials(email)}
    </span>
  );
}
