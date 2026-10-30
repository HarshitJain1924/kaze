"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  GridIcon,
  ListIcon,
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
import { TimezoneSelector } from "@/components/timezone-selector";
import { useLibrary } from "@/features/library/library-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatIsoDate, getDisplayTitle } from "@/lib/utils";
import type { Viewer } from "@/types/viewer";

const DESIGN_OPTIONS: Array<{
  value: DesignDirection;
  label: string;
  tagline: string;
  description: string;
  accentHex: string;
  accentBg: string;
}> = [
  {
    value: "broadcast",
    label: "Midnight Violet",
    tagline: "Kaze Signature",
    description: "Deep obsidian dark with electric violet & lavender glow",
    accentHex: "#8b5cf6",
    accentBg: "from-purple-600 to-indigo-500",
  },
  {
    value: "editorial",
    label: "Cyber Neon",
    tagline: "Tokyo Night",
    description: "Deep oceanic midnight with electric cyan & neon teal",
    accentHex: "#06b6d4",
    accentBg: "from-cyan-500 to-teal-400",
  },
  {
    value: "shelf",
    label: "Sakura Bloom",
    tagline: "Cherry Blossom",
    description: "Velvety dark with vibrant sakura rose & crimson",
    accentHex: "#f43f5e",
    accentBg: "from-rose-500 to-pink-500",
  },
];

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
  icon: typeof MoonIcon;
}> = [
  {
    value: "dark",
    label: "Dark Mode",
    description: "Obsidian black with luminous neon contrast",
    icon: MoonIcon,
  },
  {
    value: "light",
    label: "Light Mode",
    description: "High-key studio daylight with crisp paper cards",
    icon: SunIcon,
  },
  {
    value: "system",
    label: "System Sync",
    description: "Follows your operating system appearance",
    icon: MonitorIcon,
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

function SettingsSection({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/85 p-5 sm:p-7 backdrop-blur-xl shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
        <div>
          <h2 className="font-display text-lg font-bold text-fg sm:text-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-muted">
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <span className="rounded-full border border-white/10 bg-surface-2/80 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
            {badge}
          </span>
        )}
      </div>
      <div className="pt-5">{children}</div>
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

  const emailUsername = viewer.email ? viewer.email.split("@")[0] : null;
  const currentDisplayName =
    preferences.nickname?.trim() ||
    viewer.nickname?.trim() ||
    emailUsername ||
    "Anime Fan";

  const [nicknameInput, setNicknameInput] = useState(
    preferences.nickname ?? viewer.nickname ?? "",
  );
  const [savingNickname, setSavingNickname] = useState(false);

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nicknameInput.trim();
    setSavingNickname(true);
    setPreference("nickname", trimmed || undefined);
    markSaved();

    if (supabase) {
      try {
        await supabase.auth.updateUser({
          data: { nickname: trimmed, display_name: trimmed },
        });
      } catch {
        // Local preference is already saved and active
      }
    }
    setSavingNickname(false);
    toast({
      title: trimmed ? "Nickname updated" : "Nickname cleared",
      description: trimmed
        ? `Your display name across Kaze is now “${trimmed}”.`
        : "Reset to default email username.",
      tone: "success",
    });
  };

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
    <div className="mx-auto max-w-4xl space-y-7 pb-10">
      {/* Header with Studio Beacon & Auto-save Status */}
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/85 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-accent radar-live-dot" />
              <span>Studio Engine</span>
              <span className="text-white/30">/</span>
              <span className="text-muted">Control Center</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl lg:text-4xl">
              Settings & Preferences
            </h1>
            <p className="max-w-2xl text-[13px] sm:text-sm text-muted">
              Customize your aesthetic themes, dark mode appearance, display
              conventions, broadcast timezones, and personal anime vault.
            </p>
          </div>

          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-2/80 px-3 py-1.5 text-xs font-medium backdrop-blur-md"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                savedVisible
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  : "bg-muted/50",
              )}
            />
            <span className={savedVisible ? "text-emerald-300 font-semibold" : "text-muted"}>
              {savedVisible ? "Saved on this device" : "Changes persist instantly"}
            </span>
          </div>
        </div>
      </header>

      {/* 1. Theme & Appearance Suite (Top Priority) */}
      <SettingsSection
        title="Theme & Visual Appearance"
        subtitle="Select your preferred color-scheme and signature anime visual world. Updates take effect immediately."
        badge="Active Engine"
      >
        <div className="space-y-7">
          {/* A. Dark / Light / System Mode Controls */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm font-semibold text-fg">
                Color Mode
              </span>
              <span className="text-xs text-faint">
                Currently rendered in:{" "}
                <span className="font-semibold text-accent-strong capitalize">
                  {resolved} mode
                </span>
              </span>
            </div>

            <div
              role="group"
              aria-label="Color scheme preference"
              className="grid gap-3 sm:grid-cols-3"
            >
              {THEME_OPTIONS.map((option) => {
                const active = mode === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setMode(option.value);
                      markSaved();
                    }}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98]",
                      active
                        ? "border-accent/60 bg-accent-soft shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                        : "border-white/[0.08] bg-surface-2/60 hover:border-white/[0.18] hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-accent text-accent-contrast shadow-sm"
                            : "bg-surface-3 text-muted group-hover:text-fg",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      {active ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-contrast">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4">
                      <span className="font-display text-sm font-semibold text-fg">
                        {option.label}
                      </span>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Design Direction / Visual Theme Gallery */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-sm font-semibold text-fg">
                Design Palette Direction
              </span>
              <span className="text-xs text-faint">
                3 signature aesthetic worlds
              </span>
            </div>

            <div
              role="group"
              aria-label="Design direction palette"
              className="grid gap-3.5 sm:grid-cols-3"
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
                      "group relative flex flex-col rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.98]",
                      active
                        ? "border-accent/60 bg-accent-soft ring-1 ring-accent/40 shadow-[0_0_18px_rgba(139,92,246,0.25)]"
                        : "border-white/[0.08] bg-surface-2/60 hover:border-white/[0.18] hover:bg-surface-2",
                    )}
                  >
                    {/* Live Micro Interface Swatch carrying the exact theme tokens */}
                    <div
                      data-design={option.value}
                      className={cn(
                        "relative h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-bg p-3 shadow-inner",
                        resolved === "light" && "light",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xs font-bold uppercase tracking-wider text-accent-strong">
                          {option.tagline}
                        </span>
                        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_currentColor]" />
                      </div>

                      {/* Mock mini poster & pill elements */}
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="h-10 w-7 shrink-0 rounded-md bg-surface-3 border border-white/10" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-2 w-3/4 rounded-full bg-fg/80" />
                          <div className="flex gap-1">
                            <div className="h-2 w-8 rounded-full bg-accent" />
                            <div className="h-2 w-6 rounded-full bg-surface-3" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-semibold text-fg">
                          {option.label}
                        </span>
                        {active && (
                          <span className="h-2 w-2 rounded-full bg-accent-strong shadow-[0_0_6px_currentColor]" />
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-muted">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* 2. Display & Catalog Preferences */}
      <SettingsSection
        title="Display & Broadcast Conventions"
        subtitle="Manage how titles, default library layouts, and broadcast timezones are displayed."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Title Language Selection */}
          <div className="space-y-2">
            <label
              htmlFor="title-language"
              className="font-display text-sm font-semibold text-fg block"
            >
              Poster Title Language
            </label>
            <p className="text-xs text-muted">
              Choose whether to display official localized English titles or the
              original Romaji Japanese names.
            </p>
            <select
              id="title-language"
              value={preferences.titleLanguage}
              onChange={(e) => {
                setPreference(
                  "titleLanguage",
                  e.target.value as "english" | "romaji",
                );
                markSaved();
              }}
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 text-sm font-medium text-fg transition-all focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="english" className="bg-surface text-fg">
                English titles (e.g. Attack on Titan)
              </option>
              <option value="romaji" className="bg-surface text-fg">
                Romaji titles (e.g. Shingeki no Kyojin)
              </option>
            </select>
          </div>

          {/* Preferred Library View */}
          <div className="space-y-2">
            <label
              htmlFor="library-view"
              className="font-display text-sm font-semibold text-fg block"
            >
              Default Library Layout
            </label>
            <p className="text-xs text-muted">
              Preferred default layout when opening your personal library.
            </p>
            <div
              role="group"
              aria-label="Library layout default"
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                aria-pressed={preferences.libraryView === "grid"}
                onClick={() => {
                  setPreference("libraryView", "grid");
                  markSaved();
                }}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all active:scale-95",
                  preferences.libraryView === "grid"
                    ? "border-accent/60 bg-accent-soft text-accent-strong shadow-xs"
                    : "border-white/[0.08] bg-surface-2 text-muted hover:text-fg",
                )}
              >
                <GridIcon className="h-4 w-4" />
                <span>Poster Grid</span>
              </button>

              <button
                type="button"
                aria-pressed={preferences.libraryView === "list"}
                onClick={() => {
                  setPreference("libraryView", "list");
                  markSaved();
                }}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all active:scale-95",
                  preferences.libraryView === "list"
                    ? "border-accent/60 bg-accent-soft text-accent-strong shadow-xs"
                    : "border-white/[0.08] bg-surface-2 text-muted hover:text-fg",
                )}
              >
                <ListIcon className="h-4 w-4" />
                <span>Shelf List</span>
              </button>
            </div>
          </div>

          {/* Broadcast Timezone */}
          <div className="space-y-2 sm:col-span-2 border-t border-white/[0.06] pt-5">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-accent-strong" />
              <span className="font-display text-sm font-semibold text-fg">
                Broadcast & Release Timezone
              </span>
            </div>
            <p className="text-xs text-muted">
              All weekly schedule releases and airing countdowns are automatically
              calculated and converted into this timezone.
            </p>
            <div className="max-w-md pt-1">
              <TimezoneSelector variant="select" onSelect={() => markSaved()} />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* 3. Account & Security Card */}
      <SettingsSection
        title="Account & Authentication"
        subtitle="Your library and episode progress are private to this account, secured with Supabase Row Level Security."
      >
        <div className="space-y-6">
          {/* User Profile Overview */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-5">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-surface-2 text-muted shadow-sm">
                  <UserIcon className="h-6 w-6 text-accent-strong" />
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-bg shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              </div>

              <div>
                <p className="font-display text-base font-bold text-fg">
                  {currentDisplayName}
                </p>
                <p className="text-xs text-muted">
                  {viewer.email}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  {viewer.createdAt
                    ? `Member since ${formatIsoDate(viewer.createdAt)} · Verified session`
                    : "Authenticated account session"}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={handleSignOut}
              disabled={signingOut}
              className="h-10 rounded-xl border-white/10 bg-surface-2 px-4 text-xs font-semibold text-danger hover:border-danger/30 hover:bg-danger-soft transition-all"
            >
              <LogOutIcon className="h-4 w-4 mr-1.5" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>

          {/* Nickname / Display Name Customization Field */}
          <form onSubmit={handleSaveNickname} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <label
                htmlFor="user-nickname"
                className="font-display text-sm font-semibold text-fg"
              >
                Personal Nickname / Display Name
              </label>
              <span className="text-[11px] text-faint">
                Replaces your email on home greetings, sidebar, and profile
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="user-nickname"
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="e.g. Spike, Ichigo, Zero..."
                maxLength={30}
                className="h-11 flex-1 rounded-xl border border-white/[0.08] bg-surface-2 px-3.5 text-sm font-medium text-fg placeholder:text-faint/70 transition-all focus:border-accent focus:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={savingNickname}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/20 px-5 text-xs font-semibold text-accent-strong transition-all hover:border-accent hover:bg-accent hover:text-white active:scale-95 disabled:opacity-50 shadow-xs"
              >
                <CheckIcon className="h-4 w-4" />
                <span>{savingNickname ? "Saving…" : "Save Nickname"}</span>
              </button>
            </div>
          </form>
        </div>
      </SettingsSection>

      {/* 4. Data Vault (Export & Backup) */}
      <SettingsSection
        title="Personal Data Vault"
        subtitle="Download a complete snapshot of your library. Export formats are compatible with standard spreadsheet and database viewers."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-fg">
              {items.length} {items.length === 1 ? "series" : "series"} tracked in vault
            </p>
            <p className="mt-0.5 text-xs text-faint">
              {availableTitles} titles fully hydrated with AniList metadata
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={exportJson}
              disabled={items.length === 0}
              className="h-10 rounded-xl border-white/10 bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:border-white/20 hover:bg-surface-3 transition-all"
            >
              <DownloadIcon className="h-4 w-4 mr-1.5" />
              Export JSON
            </Button>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={items.length === 0}
              className="h-10 rounded-xl border-white/10 bg-surface-2 px-3.5 text-xs font-semibold text-fg hover:border-white/20 hover:bg-surface-3 transition-all"
            >
              <DownloadIcon className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* 5. System Architecture & Privacy */}
      <SettingsSection title="System Architecture & Privacy">
        <dl className="grid gap-4 text-xs sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-surface-2/40 p-3.5">
            <dt className="font-display text-sm font-semibold text-fg">
              Anime Metadata Pipeline
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">
              Sourced live from the public AniList GraphQL API with local
              circuit-breaker and edge-caching resilience.
            </dd>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-surface-2/40 p-3.5">
            <dt className="font-display text-sm font-semibold text-fg">
              Zero-Tracking Privacy
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">
              No tracking pixels, third-party analytics, or commercial cookies.
              Your watch progress, scores, and notes remain completely private.
            </dd>
          </div>
        </dl>
      </SettingsSection>
    </div>
  );
}
