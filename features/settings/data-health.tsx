"use client";

import Link from "next/link";
import { useMemo } from "react";

import { CheckIcon, InfoIcon } from "@/components/icons";
import { useLibrary } from "@/features/library/library-provider";
import { useScreenLibraryItems } from "@/features/screen/use-screen-library";
import {
  computeLibraryHealth,
  type HealthFinding,
} from "@/lib/library-health";

function FindingList({
  heading,
  hint,
  findings,
}: {
  heading: string;
  hint: string;
  findings: HealthFinding[];
}) {
  if (findings.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-display text-xs font-semibold text-fg">
          {heading}
        </span>
        <span className="font-mono text-[10px] text-faint">
          {findings.length}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p>
      <ul className="mt-1.5 space-y-1">
        {findings.slice(0, 5).map((finding) => (
          <li key={finding.id} className="text-[11px] leading-relaxed">
            <Link
              href={finding.href}
              className="font-medium text-fg transition-colors hover:text-accent-strong"
            >
              {finding.title}
            </Link>
            <span className="text-faint"> — {finding.detail}</span>
          </li>
        ))}
      </ul>
      {findings.length > 5 ? (
        <p className="mt-1 text-[10px] text-faint">
          +{findings.length - 5} more
        </p>
      ) : null}
    </div>
  );
}

export function DataHealthPanel() {
  const { items } = useLibrary();
  const screenItems = useScreenLibraryItems();
  const health = useMemo(
    () => computeLibraryHealth(items, screenItems),
    [items, screenItems],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {health.clean
            ? "No structural problems found in either catalogue."
            : `${health.total} ${health.total === 1 ? "record needs" : "records need"} a look.`}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          read-only audit
        </span>
      </div>

      {health.clean ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
          <CheckIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            Progress, totals and catalogue ids all agree across{" "}
            {items.length + screenItems.length} tracked titles.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <FindingList
            heading="Progress past the known total"
            hint="Recorded progress is higher than the provider's episode or chapter count. Lower it on the title page to restore a truthful percentage."
            findings={health.overrun}
          />
          <FindingList
            heading="Unknown episode totals"
            hint="AniList has no episode count for these, so they can never be auto-completed. They stay counted by recorded progress only."
            findings={health.missingTotals}
          />
          <FindingList
            heading="Metadata did not load"
            hint="The catalogue request failed for these entries. Your progress, rating and notes are unchanged; open the title to retry the lookup."
            findings={health.unhydrated}
          />
          <FindingList
            heading="Duplicate catalogue ids"
            hint="Two rows point at the same title. One of them is usually a stale duplicate; remove the extra from your library."
            findings={health.duplicates}
          />
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-faint">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Nothing here is changed automatically — an audit should never rewrite
          your archive. Fix a record by opening it.
        </span>
      </p>
    </div>
  );
}
