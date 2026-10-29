"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import {
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  HomeIcon,
  LibraryIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "@/components/icons";
import { Logo, LogoMark } from "@/components/logo";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useSidebar } from "@/components/providers/sidebar-provider";
import {
  useTheme,
  type DesignDirection,
  type ThemeMode,
} from "@/components/providers/theme-provider";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/types/viewer";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: CompassIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/library", label: "My Library", icon: LibraryIcon },
  { href: "/stats", label: "Statistics", icon: ChartIcon },
];

const ACCENT_PALETTES: Array<{
  value: DesignDirection;
  label: string;
  dotColor: string;
  glow: string;
}> = [
  {
    value: "broadcast",
    label: "Midnight Violet",
    dotColor: "bg-purple-500",
    glow: "shadow-[0_0_8px_rgba(168,85,247,0.9)]",
  },
  {
    value: "editorial",
    label: "Cyber Neon",
    dotColor: "bg-cyan-400",
    glow: "shadow-[0_0_8px_rgba(34,211,238,0.9)]",
  },
  {
    value: "shelf",
    label: "Sakura Bloom",
    dotColor: "bg-rose-500",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.9)]",
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DesktopSidebar({ viewer }: { viewer: Viewer | null }) {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { mode, resolved, setMode, design, setDesign } = useTheme();

  const { preferences } = usePreferences();
  const username = viewer?.email ? viewer.email.split("@")[0] : null;
  const displayName =
    preferences.nickname?.trim() ||
    viewer?.nickname?.trim() ||
    username ||
    "Anime Fan";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.08] bg-bg/80 backdrop-blur-2xl backdrop-saturate-[180%] shadow-[inset_-1px_0_1px_rgba(255,255,255,0.05)] transition-[width,padding] duration-300 ease-out lg:flex",
        isCollapsed
          ? "w-[72px] items-center px-2.5 py-5"
          : "w-[242px] px-3.5 py-6",
      )}
    >
      {/* Top Header: Logo & Collapse / Expand Toggle */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-3">
          <Link href="/" aria-label="Kaze home" className="group relative">
            <LogoMark />
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              Kaze Home
            </div>
          </Link>

          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="group relative flex h-8 w-8 items-center justify-center rounded-xl liquid-glass-interactive text-muted hover:text-fg active:scale-95"
          >
            <PanelLeftOpenIcon className="h-4 w-4" />
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              Expand sidebar
            </div>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between px-2">
          <Logo />
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar to icons"
            className="group relative flex h-8 w-8 items-center justify-center rounded-xl text-faint transition-colors hover:bg-white/[0.08] hover:text-fg active:scale-95"
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              Collapse sidebar
            </div>
          </button>
        </div>
      )}

      {/* Main Navigation Items */}
      <nav aria-label="Primary" className="mt-7 w-full space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center rounded-2xl transition-all duration-150 ease-out select-none",
                isCollapsed
                  ? "mx-auto h-11 w-11 justify-center"
                  : "gap-3 px-3.5 py-2.5 text-sm",
                active
                  ? "border border-accent/40 bg-accent-soft font-semibold text-fg shadow-[0_0_15px_rgba(139,92,246,0.18)]"
                  : "border border-transparent font-medium text-muted hover:border-white/[0.06] hover:bg-surface/70 hover:text-fg",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active
                    ? "text-accent-strong"
                    : "text-faint group-hover:text-muted",
                )}
              />

              {!isCollapsed ? (
                <span className="flex-1 truncate">{item.label}</span>
              ) : null}

              {/* Active beacon indicator on expanded mode */}
              {!isCollapsed && active ? (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong shadow-[0_0_6px_currentColor]" />
              ) : null}

              {/* Hover Tooltip in collapsed icon-only mode */}
              {isCollapsed ? (
                <div className="pointer-events-none absolute left-full ml-3 z-50 hidden items-center rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
                  <span>{item.label}</span>
                </div>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Area: Quick Theme/Dark-Mode Dock, Settings & Profile */}
      <div className="mt-auto w-full space-y-2.5 pt-4">
        {/* Quick Theme & Dark Mode Controls */}
        {isCollapsed ? (
          /* Collapsed Mode: Single Quick Dark/Light Toggle Button */
          <div className="group relative flex justify-center">
            <button
              type="button"
              onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
              title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle dark/light mode"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface/70 text-muted transition-all duration-150 hover:border-accent/40 hover:bg-surface-2 hover:text-fg active:scale-95 shadow-xs"
            >
              {resolved === "dark" ? (
                <MoonIcon className="h-4 w-4 text-purple-300" />
              ) : (
                <SunIcon className="h-4 w-4 text-amber-400" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden items-center rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              <span>{resolved === "dark" ? "Dark Mode" : "Light Mode"} (click to toggle)</span>
            </div>
          </div>
        ) : (
          /* Expanded Mode: Modern Studio Quick Theme & Appearance Dock */
          <div className="rounded-2xl border border-white/[0.08] bg-surface/75 p-2.5 backdrop-blur-md shadow-xs space-y-2">
            {/* Top row: Dark / Light / System Mode Segmented Pill */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                Appearance
              </span>
              <div
                role="group"
                aria-label="Theme mode"
                className="flex items-center gap-0.5 rounded-xl border border-white/[0.08] bg-bg/70 p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={mode === "dark"}
                  onClick={() => setMode("dark")}
                  title="Dark mode"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-all",
                    mode === "dark"
                      ? "border border-purple-500/40 bg-purple-500/20 text-purple-300 shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <MoonIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "light"}
                  onClick={() => setMode("light")}
                  title="Light mode"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-all",
                    mode === "light"
                      ? "border border-amber-400/40 bg-amber-400/20 text-amber-300 shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <SunIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "system"}
                  onClick={() => setMode("system")}
                  title="Sync with system OS"
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-lg transition-all",
                    mode === "system"
                      ? "border border-white/20 bg-surface-3 text-fg shadow-xs"
                      : "text-faint hover:text-muted",
                  )}
                >
                  <MonitorIcon className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Bottom row: 3 Accent Theme Color Swatches */}
            <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.06]">
              <span className="text-[10px] text-faint">Theme Accent</span>
              <div
                role="group"
                aria-label="Accent theme"
                className="flex items-center gap-1.5"
              >
                {ACCENT_PALETTES.map((pal) => {
                  const active = design === pal.value;
                  return (
                    <button
                      key={pal.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDesign(pal.value)}
                      title={pal.label}
                      className={cn(
                        "relative flex h-5 w-5 items-center justify-center rounded-full transition-transform active:scale-90",
                        active
                          ? "ring-2 ring-accent ring-offset-2 ring-offset-surface scale-110"
                          : "opacity-60 hover:opacity-100",
                      )}
                    >
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full",
                          pal.dotColor,
                          active && pal.glow,
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Settings Link */}
        <Link
          href="/settings"
          className={cn(
            "group relative flex items-center rounded-2xl transition-all duration-150 select-none",
            isCollapsed
              ? "mx-auto h-11 w-11 justify-center"
              : "gap-3 px-3.5 py-2.5 text-sm",
            pathname === "/settings"
              ? "border border-accent/40 bg-accent-soft font-semibold text-fg shadow-[0_0_15px_rgba(139,92,246,0.18)]"
              : "border border-transparent font-medium text-muted hover:border-white/[0.06] hover:bg-surface/70 hover:text-fg",
          )}
        >
          <SettingsIcon
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              pathname === "/settings"
                ? "text-accent-strong"
                : "text-faint group-hover:text-muted",
            )}
          />

          {!isCollapsed ? (
            <span className="flex-1 truncate">Settings</span>
          ) : null}

          {/* Hover Tooltip in collapsed mode */}
          {isCollapsed ? (
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden items-center rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              <span>Settings</span>
            </div>
          ) : null}
        </Link>

        {/* User Account / Sign In */}
        {viewer ? (
          <Link
            href="/settings"
            className={cn(
              "group relative flex items-center rounded-2xl border border-white/[0.08] bg-surface/75 backdrop-blur-md transition-all duration-150 hover:border-white/[0.18] hover:bg-surface-2/90 shadow-xs",
              isCollapsed
                ? "mx-auto h-11 w-11 justify-center p-0"
                : "gap-2.5 p-2",
            )}
          >
            <div className="relative shrink-0">
              <UserAvatar email={viewer.email} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-bg shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
            </div>

            {!isCollapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-fg transition-colors group-hover:text-accent-strong">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {viewer.email}
                  </span>
                </span>
                <span className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted text-sm font-semibold">
                  ›
                </span>
              </>
            ) : null}

            {/* Hover Tooltip with user info in collapsed mode */}
            {isCollapsed ? (
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden flex-col rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
                <span>{displayName}</span>
                <span className="text-[10px] font-normal text-faint">
                  {viewer.email}
                </span>
              </div>
            ) : null}
          </Link>
        ) : (
          <Link
            href="/login"
            className={cn(
              "group relative flex items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-accent-contrast transition-all hover:bg-accent-hover active:scale-95 shadow-md shadow-accent/20",
              isCollapsed
                ? "mx-auto h-11 w-11 p-0"
                : "gap-2 px-3 py-2.5",
            )}
          >
            {isCollapsed ? (
              <>
                <UserIcon className="h-4 w-4" />
                <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
                  Sign in to track
                </div>
              </>
            ) : (
              <span>Sign in to track</span>
            )}
          </Link>
        )}
      </div>
    </aside>
  );
}
