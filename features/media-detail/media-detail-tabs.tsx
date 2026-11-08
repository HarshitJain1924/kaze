"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MediaDetailSection } from "@/lib/media/detail-view";

type TabKey = string;

interface MediaDetailTabsProps {
  sections: MediaDetailSection[];
  detailsContent: ReactNode;
}

function tabCount(count: number | null | undefined) {
  return count !== null && count !== undefined && count > 0 ? count : null;
}

export function MediaDetailTabs({
  sections,
  detailsContent,
}: MediaDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const tabSections = useMemo(
    () => sections.filter((section) => section.tab !== false),
    [sections],
  );
  const availableTabs = useMemo(
    () => [
      "overview",
      ...tabSections.map((section) => section.id),
      "details",
      "all",
    ],
    [tabSections],
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex === -1) return;

    const direction =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (direction === 0) return;

    event.preventDefault();
    const nextIndex =
      (currentIndex + direction + availableTabs.length) %
      availableTabs.length;
    const nextTab = availableTabs[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab);
    document.getElementById(`tab-${nextTab}`)?.focus();
  };

  const overviewSections = sections.filter((section) => section.overview);
  const activeSection = tabSections.find(
    (section) => section.id === activeTab,
  );

  return (
    <div className="space-y-6">
      <div className="optical-glass flex items-center justify-between gap-4 px-3 pt-1.5">
        <nav
          role="tablist"
          aria-label="Media detail sections"
          onKeyDown={handleTabKeyDown}
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-4 overflow-x-auto pr-2 sm:gap-6"
        >
          {[
            { id: "overview", label: "Overview", count: null },
            ...tabSections.map((section) => ({
              id: section.id,
              label: section.label,
              count: tabCount(section.count),
            })),
            { id: "details", label: "Details", count: null },
            { id: "all", label: "All Sections", count: null },
          ].map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                aria-selected={selected}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 whitespace-nowrap pb-3 pt-1 text-sm transition-colors",
                  selected
                    ? "font-semibold text-white"
                    : "font-medium text-white/55 hover:text-white/85",
                )}
              >
                <span>{tab.label}</span>
                {tab.count ? (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.2 text-[10px] font-semibold tabular-nums",
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white/60",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
                {selected ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={activeTab === "all" ? undefined : `tab-${activeTab}`}
        className="space-y-8"
      >
        {activeTab === "all" ? (
          <>
            {sections.map((section) => (
              <div key={section.id}>{section.content}</div>
            ))}
            {detailsContent}
          </>
        ) : activeTab === "overview" ? (
          <>
            {overviewSections.map((section) => (
              <div key={section.id}>{section.content}</div>
            ))}
          </>
        ) : activeTab === "details" ? (
          detailsContent
        ) : (
          activeSection?.content
        )}
      </div>
    </div>
  );
}
