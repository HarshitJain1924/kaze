"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DownloadIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import {
  useTheme,
  type DesignDirection,
  type ThemeMode,
} from "@/components/providers/theme-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { TimezoneSelector } from "@/components/timezone-selector";
import { useLibrary } from "@/features/library/library-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  cn,
  formatIsoDate,
  getDisplayTitle,
} from "@/lib/utils";
import type { LibraryView } from "@/types/library";
import type { Viewer } from "@/types/viewer";

const DESIGN_OPTIONS: Array<{
  value: DesignDirection;
  label: string;
  description: string;
}> = [
  {
    value: "broadcast",
    label: "Midnight Violet",
    description: "Kaze signature: Obsidian dark with electric violet & lavender glow",
  },
  {
    value: "editorial",
    label: "Cyber Neon",
    description: "Tokyo night: Deep oceanic slate with electric cyan & teal",
  },
  {
    value: "shelf",
    label: "Sakura Bloom",
    description: "Cherry blossom: Velvety dark with vibrant sakura rose & crimson",
  },
];

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "dark", label: "Dark", icon: <MoonIcon className="h-4 w-4" /> },
  { value: "light", label: "Light", icon: <SunIcon className="h-4 w-4" /> },
  {
    value: "system",
    label: "System",
    icon: <MonitorIcon className="h-4 w-4" />,
  },
];

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsView({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const { toast } = useToast();
  const { mode, resolved, design, setMode, setDesign } = useTheme();
  const { preferences, setPreference } = usePreferences();
  const { items } = useLibrary();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [signingOut, setSigningOut] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preferences write to this device immediately. Say so, quietly, instead of
  // leaving the user unsure whether anything was persisted.
  const markSaved = useCallback(() => {
    setSavedVisible(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedVisible(false), 2200);
  }, []);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const availableTitles = items.filter((item) => item.anime !== null).length;

  const handleSignOut = async () => {
    if (!supabase) {
      toast({
        title: "Authentication is not configured",
        description: "Add Supabase environment variables to enable accounts.",
        tone: "error",
      });
      return;
    }
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Could not sign out",
        description: error.message,
        tone: "error",
      });
      setSigningOut(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  const exportJson = () => {
    const payload = {
      app: "Kaze",
      exportedAt: new Date().toISOString(),
      count: items.length,
      entries: items.map(({ entry, anime }) => ({
        anilistId: entry.anilistId,
        title: anime
          ? getDisplayTitle(anime.title, preferences.titleLanguage === "english")
          : null,
        titles: anime?.title ?? null,
        status: entry.status,
        progress: entry.progress,
        episodes: anime?.episodes ?? null,
        score: entry.score,
        notes: entry.notes,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    };

    downloadFile(
      `kaze-library-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast({ title: "JSON export downloaded", tone: "success" });
  };

  const exportCsv = () => {
    const header = [
      "title",
      "anilist_id",
      "status",
      "progress",
      "episodes",
      "score",
      "notes",
      "started_at",
      "completed_at",
      "updated_at",
    ];
    const lines = [header.map(csvCell).join(",")];

    for (const { entry, anime } of items) {
      lines.push(
        [
          anime
            ? getDisplayTitle(
                anime.title,
                preferences.titleLanguage === "english",
              )
            : "",
          entry.anilistId,
          entry.status,
          entry.progress,
          anime?.episodes ?? "",
          entry.score ?? "",
          entry.notes ?? "",
          entry.startedAt ?? "",
          entry.completedAt ?? "",
          entry.updatedAt,
        ]
          .map(csvCell)
          .join(","),
      );
    }

    downloadFile(
      `kaze-library-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8",
    );
    toast({ title: "CSV export downloaded", tone: "success" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
            Account & preferences
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Manage your account, appearance and personal data.
          </p>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="mt-1 min-h-4 text-xs font-medium text-success"
        >
          {savedVisible ? "Saved on this device" : ""}
        </p>
      </header>

      <Section
        title="Account"
        description="Your library is private to this account and protected by row level security."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-2 text-muted">
              <UserIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {viewer.email ?? "Signed in"}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                {viewer.createdAt
                  ? `Member since ${formatIsoDate(viewer.createdAt)}`
                  : "Authenticated account"}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleSignOut}
            disabled={signingOut}
            className="sm:w-auto"
          >
            <LogOutIcon className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Section>

      <Section
        title="Appearance"
        description="How Kaze looks and how titles are labelled on this device. Changes save immediately."
      >
        <div className="space-y-6">
          <div>
            <p className="text-xs font-medium text-muted">Design</p>
            <div
              role="group"
              aria-label="Design direction"
              className="mt-1.5 grid gap-2 sm:grid-cols-3"
            >
              {DESIGN_OPTIONS.map((option) => {
                const active = design === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDesign(option.value);
                      markSaved();
                    }}
                    className={cn(
                      "rounded-xl border p-2 text-left transition-colors",
                      active
                        ? "border-accent/60 ring-1 ring-accent/30"
                        : "border-border-subtle hover:border-border",
                    )}
                  >
                    {/* The preview carries its own direction tokens, so it shows
                        that design in the appearance currently in use. */}
                    <div
                      data-design={option.value}
                      className={cn(
                        "rounded-lg border border-border-subtle bg-bg p-2.5",
                        resolved === "light" && "light",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-semibold leading-none text-fg">
                          Aa
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-muted">
                          21:30
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1">
                        <span className="h-5 flex-1 rounded-md border border-border-subtle bg-surface" />
                        <span className="h-5 flex-1 rounded-md bg-surface-3" />
                        <span className="h-5 flex-1 rounded-md bg-accent" />
                      </div>
                    </div>
                    <span className="mt-2 block text-xs font-semibold text-fg">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-faint">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted">Theme</p>
            <div
              role="group"
              aria-label="Theme preference"
              className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-2/60 p-1"
            >
              {THEME_OPTIONS.map((option) => {
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setMode(option.value);
                      markSaved();
                    }}
                    className={`flex h-9 items-center justify-center gap-2 rounded-md text-xs font-medium transition-colors ${
                      active
                        ? "bg-surface-3 text-fg"
                        : "text-faint hover:text-muted"
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-faint">
              System follows your operating system preference and updates
              automatically.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1.5" htmlFor="title-language">
              <span className="text-xs font-medium text-muted">
                Poster title language
              </span>
              <Select
                id="title-language"
                value={preferences.titleLanguage}
                onChange={(event) => {
                  setPreference(
                    "titleLanguage",
                    event.target.value as "english" | "romaji",
                  );
                  markSaved();
                }}
              >
                <option value="english">English title (when available)</option>
                <option value="romaji">Romaji title</option>
              </Select>
            </label>

            <label className="block space-y-1.5" htmlFor="library-view">
              <span className="text-xs font-medium text-muted">
                Preferred library view
              </span>
              <Select
                id="library-view"
                value={preferences.libraryView}
                onChange={(event) => {
                  setPreference(
                    "libraryView",
                    event.target.value as LibraryView,
                  );
                  markSaved();
                }}
              >
                <option value="grid">Poster grid</option>
                <option value="list">Compact list</option>
              </Select>
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted">
                Schedule & broadcast timezone
              </span>
              <TimezoneSelector variant="select" onSelect={() => markSaved()} />
              <p className="text-[11px] leading-relaxed text-faint">
                Episode release times on the weekly schedule and home dashboard are converted to this timezone.
              </p>
            </div>
          </div>
          </div>
        </div>
      </Section>

      <Section
        title="Your data"
        description="Download a copy of your library. Exports include every entry, including titles whose AniList metadata is currently unavailable."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted">
            {items.length} {items.length === 1 ? "entry" : "entries"} ·{" "}
            {availableTitles} with AniList metadata
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={exportJson}
              disabled={items.length === 0}
            >
              <DownloadIcon className="h-4 w-4" />
              Export JSON
            </Button>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={items.length === 0}
            >
              <DownloadIcon className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </Section>

      <Section title="About this app">
        <dl className="grid gap-4 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-[13px] font-medium text-fg">Anime metadata</dt>
            <dd className="mt-1 leading-relaxed text-muted">
              Sourced from the public AniList GraphQL API. Community scores are
              provided by AniList, not calculated here.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-fg">Personal library</dt>
            <dd className="mt-1 leading-relaxed text-muted">
              Stored in Supabase with row level security, so only your account
              can read or change your entries.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-fg">Privacy</dt>
            <dd className="mt-1 leading-relaxed text-muted">
              There are no public profiles, comments or social features. Your
              notes and ratings stay private.
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-fg">Version</dt>
            <dd className="mt-1 leading-relaxed text-muted">Kaze 1.0</dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
