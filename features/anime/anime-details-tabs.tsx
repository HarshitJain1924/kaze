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

  return (
    <div className="space-y-6">
      {/* Restrained Editorial Tab Navigation */}
      <div className="flex items-center justify-between border-b border-border">
        <nav
          role="tablist"
          aria-label="Media detail sections"
          className="no-scrollbar -mx-4 flex gap-6 sm:gap-7 overflow-x-auto px-4 sm:-mx-0 sm:px-0"
        >
          {/* Overview */}
          <button
            type="button"
            role="tab"
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
              aria-selected={activeTab === "themes"}
              onClick={() => setActiveTab("themes")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "themes"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>Themes & Music</span>
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
              aria-selected={activeTab === "franchise"}
              onClick={() => setActiveTab("franchise")}
              className={cn(
                "relative inline-flex items-center gap-1.5 pb-3 pt-1 text-sm transition-colors whitespace-nowrap",
                activeTab === "franchise"
                  ? "text-fg font-semibold"
                  : "text-muted hover:text-fg font-medium",
              )}
            >
              <span>Franchise & Related</span>
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
        </nav>

        {/* View all sections toggle */}
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === "all" ? "overview" : "all")}
          className="pb-3 pt-1 text-[11px] font-medium text-faint hover:text-fg transition-colors hidden sm:inline-block shrink-0"
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
