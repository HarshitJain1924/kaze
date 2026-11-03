"use client";

import { useState } from "react";
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

type TabKey = "overview" | "characters" | "themes" | "franchise" | "episodes" | "details" | "all";

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

  return (
    <div className="space-y-6">
      {/* Navigation Tab Bar */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div
          role="tablist"
          aria-label="Anime sections"
          className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl liquid-glass"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "overview"
                ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            Overview
          </button>

          {hasCharacters && charactersContent ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "characters"}
              onClick={() => setActiveTab("characters")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "characters"
                  ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span>Characters</span>
              {charactersCount ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    activeTab === "characters"
                      ? "bg-accent-contrast/20 text-accent-contrast"
                      : "bg-surface-3 text-faint",
                  )}
                >
                  {charactersCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {hasThemes && themesContent ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "themes"}
              onClick={() => setActiveTab("themes")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "themes"
                  ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span>Themes & Music</span>
              {themesCount ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    activeTab === "themes"
                      ? "bg-accent-contrast/20 text-accent-contrast"
                      : "bg-surface-3 text-faint",
                  )}
                >
                  {themesCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {hasFranchise ? (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "franchise"}
              onClick={() => setActiveTab("franchise")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "franchise"
                  ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span>Franchise & Related</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  activeTab === "franchise"
                    ? "bg-accent-contrast/20 text-accent-contrast"
                    : "bg-surface-3 text-faint",
                )}
              >
                {franchiseCount}
              </span>
            </button>
          ) : null}

          {showEpisodes ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "episodes"}
            onClick={() => setActiveTab("episodes")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "episodes"
                ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <span>{episodeLabel}</span>
            {episodesCount ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  activeTab === "episodes"
                    ? "bg-accent-contrast/20 text-accent-contrast"
                    : "bg-surface-3 text-faint",
                )}
              >
                {episodesCount}
              </span>
            ) : null}
          </button>
          ) : null}

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "details"}
            onClick={() => setActiveTab("details")}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-semibold transition-all",
              activeTab === "details"
                ? "bg-accent text-accent-contrast shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_4px_12px_rgba(139,92,246,0.35)]"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            Details
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "all" ? "overview" : "all")}
          className="text-[11px] font-medium text-faint hover:text-fg transition-colors hidden sm:inline-block"
        >
          {activeTab === "all" ? "Collapse to tabs" : "View all sections"}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-8">
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
