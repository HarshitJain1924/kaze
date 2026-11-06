import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeftIcon } from "@/components/icons";
import { ErrorState } from "@/components/error-state";

export function MediaDetailError({
  backHref,
  backLabel,
  eyebrow,
  title,
  message,
  action,
  children,
}: {
  backHref: string;
  backLabel: string;
  eyebrow?: string;
  title: string;
  message: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {backLabel}
      </Link>
      {eyebrow ? (
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
          {eyebrow}
        </p>
      ) : null}
      <ErrorState className="mt-4" title={title} message={message} action={action} />
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
