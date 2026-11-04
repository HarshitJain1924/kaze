"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AnimeDetailsTabsProps {
  synopsisContent: ReactNode;
  franchiseContent: ReactNode;
  episodesContent: ReactNode;
  charactersContent?: ReactNode;
  themesContent?: ReactNode;
  detailsContent: ReactNode;
  hasFranchise: boolean;
  franchiseCount: number;
  hasCharacters?: boolean;
  charactersCount?: number;
  hasThemes?: boolean;
  themesCount?: number;
  episodesCount: number | null;
  showEpisodes?: boolean;
  episodeLabel?: string;
}

type TabKey =
  | "overview"
  | "characters"
  | "themes"
  | "franchise"
  | "episodes"
  | "details"
  | "all";

export function AnimeDetailsTabs({
  synopsisContent,
  franchiseContent,
  episodesContent,
  charactersContent,
  themesContent,
  detailsContent,
  hasFranchise,
  franchiseCount,
  hasCharacters = false,
  charactersCount = 0,
  hasThemes = false,
  themesCount = 0,
  episodesCount,
  showEpisodes = true,
  episodeLabel = "Episodes",
}: AnimeDetailsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const availableTabs: TabKey[] = useMemo(() => {
    const list: TabKey[] = ["overview"];
    if (hasCharacters && charactersContent) list.push("characters");
    if (hasThemes && themesContent) list.push("themes");
    if (hasFranchise) list.push("franchise");
    if (showEpisodes) list.push("episodes");
    list.push("details");
    list.push("all");
    return list;
  }, [hasCharacters, charactersContent, hasThemes, themesContent, hasFranchise, showEpisodes]);

  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = availableTabs.indexOf(activeTab);
    if (currentIndex === -1) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextTab = availableTabs[(currentIndex + 1) % availableTabs.length];
      if (nextTab) {
        setActiveTab(nextTab);
        document.getElementById(`tab-${nextTab}`)?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevTab =
        availableTabs[(currentIndex - 1 + availableTabs.length) % availableTabs.length];
      if (prevTab) {
        setActiveTab(prevTab);
        document.getElementById(`tab-${prevTab}`)?.focus();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Restrained Editorial Tab Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-border">
        <nav
          role="tablist"
          aria-label="Media detail sections"
          onKeyDown={handleTabKeyDown}
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-4 sm:gap-6 overflow-x-auto pr-2"
        >
          {/* Overview */}
          <button
            type="button"
            role="tab"
            id="tab-overview"
            aria-controls="tabpanel-overview"
            tabIndex={activeTab === "overview" ? 0 : -1}
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            className={cn(
              "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
              activeTab === "overview"
                ? "text-fg font-semibold"
                : "text-muted hover:text-fg font-medium",
            )}
          >
            <span>Overview</span>
            {activeTab === "overview" ? (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </button>

          {/* Characters */}
          {hasCharacters && charactersContent ? (
            <button
              type="button"
              role="tab"
              id="tab-characters"
              aria-controls="tabpanel-characters"
              tabIndex={activeTab === "characters" ? 0 : -1}
              aria-selected={activeTab === "characters"}
              onClick={() => setActiveTab("characters")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "characters"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>Characters</span>
              {charactersCount ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                    activeTab === "characters"
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-surface-2 text-faint",
                  )}
                >
                  {charactersCount}
                </span>
              ) : null}
              {activeTab === "characters" ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ) : null}

          {/* Themes & Music */}
          {hasThemes && themesContent ? (
            <button
              type="button"
              role="tab"
              id="tab-themes"
              aria-controls="tabpanel-themes"
              tabIndex={activeTab === "themes" ? 0 : -1}
              aria-selected={activeTab === "themes"}
              onClick={() => setActiveTab("themes")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "themes"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>Themes</span>
              {themesCount ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                    activeTab === "themes"
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-surface-2 text-faint",
                  )}
                >
                  {themesCount}
                </span>
              ) : null}
              {activeTab === "themes" ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ) : null}

          {/* Franchise & Related */}
          {hasFranchise ? (
            <button
              type="button"
              role="tab"
              id="tab-franchise"
              aria-controls="tabpanel-franchise"
              tabIndex={activeTab === "franchise" ? 0 : -1}
              aria-selected={activeTab === "franchise"}
              onClick={() => setActiveTab("franchise")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "franchise"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>Franchise</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                  activeTab === "franchise"
                    ? "bg-accent-soft text-accent-strong"
                    : "bg-surface-2 text-faint",
                )}
              >
                {franchiseCount}
              </span>
              {activeTab === "franchise" ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ) : null}

          {/* Episodes / Chapters */}
          {showEpisodes ? (
            <button
              type="button"
              role="tab"
              id="tab-episodes"
              aria-controls="tabpanel-episodes"
              tabIndex={activeTab === "episodes" ? 0 : -1}
              aria-selected={activeTab === "episodes"}
              onClick={() => setActiveTab("episodes")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "episodes"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>{episodeLabel}</span>
              {episodesCount ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                    activeTab === "episodes"
                      ? "bg-accent-soft text-accent-strong"
                      : "bg-surface-2 text-faint",
                  )}
                >
                  {episodesCount}
                </span>
              ) : null}
              {activeTab === "episodes" ? (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ) : null}

          {/* Details */}
          <button
            type="button"
            role="tab"
            id="tab-details"
            aria-controls="tabpanel-details"
            tabIndex={activeTab === "details" ? 0 : -1}
            aria-selected={activeTab === "details"}
            onClick={() => setActiveTab("details")}
            className={cn(
              "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
              activeTab === "details"
                ? "text-fg font-semibold"
                : "text-muted hover:text-fg font-medium",
            )}
          >
            <span>Details</span>
            {activeTab === "details" ? (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </button>

          {/* All Sections */}
          <button
            type="button"
            role="tab"
            id="tab-all"
            aria-controls="tabpanel-all"
            tabIndex={activeTab === "all" ? 0 : -1}
            aria-selected={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            className={cn(
              "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
              activeTab === "all"
                ? "text-fg font-semibold"
                : "text-muted hover:text-fg font-medium",
            )}
          >
            <span>All Sections</span>
            {activeTab === "all" ? (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id={activeTab === "all" ? "tabpanel-all" : `tabpanel-${activeTab}`}
        aria-labelledby={activeTab === "all" ? undefined : `tab-${activeTab}`}
        className="space-y-8"
      >
        {activeTab === "all" ? (
          <>
            {synopsisContent}
            {hasThemes ? themesContent : null}
            {hasCharacters ? charactersContent : null}
            {hasFranchise ? franchiseContent : null}
            {showEpisodes ? episodesContent : null}
            {detailsContent}
          </>
        ) : activeTab === "overview" ? (
          <>
            {synopsisContent}
            {hasThemes ? themesContent : null}
            {hasCharacters ? charactersContent : null}
            {hasFranchise ? franchiseContent : null}
            {showEpisodes ? episodesContent : null}
          </>
        ) : activeTab === "themes" ? (
          themesContent
        ) : activeTab === "characters" ? (
          charactersContent
        ) : activeTab === "franchise" ? (
          franchiseContent
        ) : activeTab === "episodes" ? (
          showEpisodes ? episodesContent : null
        ) : (
          detailsContent
        )}
      </div>
    </div>
  );
}
