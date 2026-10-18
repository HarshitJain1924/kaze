import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";

export function SectionHeader({
  title,
  description,
  action,
  actionHref,
}: {
  title: string;
  description?: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-fg sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action && actionHref ? (
        <Link
          href={actionHref}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-accent-strong"
        >
          {action}
          <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
