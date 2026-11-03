import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  action,
  actionHref,
  eyebrow,
  editorial = false,
}: {
  title: string;
  description?: React.ReactNode;
  action?: string;
  actionHref?: string;
  eyebrow?: string;
  editorial?: boolean;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", editorial && "border-t border-border pt-5")}>
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("font-display font-semibold tracking-tight text-fg", editorial ? "text-xl sm:text-2xl tracking-[-0.03em]" : "text-lg")}>
          {title}
        </h2>
        {description ? (
          /* A div, not a p: descriptions can embed the timezone picker, which
             renders block markup and would make the paragraph invalid HTML. */
          <div className="mt-1 text-[13px] leading-relaxed text-muted">
            {description}
          </div>
        ) : null}
      </div>
      {action && actionHref ? (
        <Link
          href={actionHref}
          className="group inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
        >
          {action}
          <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
