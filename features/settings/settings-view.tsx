"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  type ThemeMode,
} from "@/components/providers/theme-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useLibrary } from "@/features/library/library-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  formatIsoDate,
  getDisplayTitle,
} from "@/lib/utils";
import type { LibraryView } from "@/types/library";
import type { Viewer } from "@/types/viewer";

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
    <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs leading-relaxed text-faint">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsView({ viewer }: { viewer: Viewer }) {
  const router = useRouter();
  const { toast } = useToast();
  const { mode, setMode } = useTheme();
  const { preferences, setPreference } = usePreferences();
  const { items } = useLibrary();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [signingOut, setSigningOut] = useState(false);

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
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-strong">
          Settings
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          Account & preferences
        </h1>
        <p className="mt-2 text-sm text-muted">
          Manage your account, appearance and personal data.
        </p>
      </header>

      <Section
        title="Account"
        description="Your library is private to this account and protected by row level security."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent-strong">
              <UserIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {viewer.email ?? "Signed in"}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Theme"
          description="Choose how Kaze looks on this device."
        >
          <div
            role="group"
            aria-label="Theme preference"
            className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-surface-2/60 p-1"
          >
            {THEME_OPTIONS.map((option) => {
              const active = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(option.value)}
                  className={`flex h-10 items-center justify-center gap-2 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-surface-3 text-fg shadow-sm"
                      : "text-faint hover:text-muted"
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            System follows your operating system preference and updates
            automatically.
          </p>
        </Section>

        <Section
          title="Display"
          description="Defaults used across search results and your library."
        >
          <div className="space-y-3">
            <label className="block space-y-1.5" htmlFor="title-language">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                Poster title language
              </span>
              <Select
                id="title-language"
                value={preferences.titleLanguage}
                onChange={(event) =>
                  setPreference(
                    "titleLanguage",
                    event.target.value as "english" | "romaji",
                  )
                }
              >
                <option value="english">English title (when available)</option>
                <option value="romaji">Romaji title</option>
              </Select>
            </label>

            <label className="block space-y-1.5" htmlFor="library-view">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                Preferred library view
              </span>
              <Select
                id="library-view"
                value={preferences.libraryView}
                onChange={(event) =>
                  setPreference(
                    "libraryView",
                    event.target.value as LibraryView,
                  )
                }
              >
                <option value="grid">Poster grid</option>
                <option value="list">Compact list</option>
              </Select>
            </label>
          </div>
        </Section>
      </div>

      <Section
        title="Your data"
        description="Download a copy of your library. Exports include every entry, including titles whose AniList metadata is currently unavailable."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
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
            <dt className="font-medium uppercase tracking-[0.1em] text-faint">
              Anime metadata
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">
              Sourced from the public AniList GraphQL API. Community scores are
              provided by AniList, not calculated here.
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-[0.1em] text-faint">
              Personal library
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">
              Stored in Supabase with row level security, so only your account
              can read or change your entries.
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-[0.1em] text-faint">
              Privacy
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">
              There are no public profiles, comments or social features. Your
              notes and ratings stay private.
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-[0.1em] text-faint">
              Version
            </dt>
            <dd className="mt-1 leading-relaxed text-muted">Kaze 1.0</dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
