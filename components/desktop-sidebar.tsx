"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import {
  BookmarkIcon,
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
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
  { href: "/lists", label: "Custom Lists", icon: BookmarkIcon },
  { href: "/stats", label: "Statistics", icon: ChartIcon },
];

const ACCENT_PALETTES: Array<{
  value: DesignDirection;
  label: string;
  dotColor: string;
}> = [
  {
    value: "broadcast",
    label: "Kaze Signature",
    dotColor: "bg-[var(--palette-broadcast)]",
  },
  {
    value: "editorial",
    label: "Tokyo Night",
    dotColor: "bg-[var(--palette-editorial)]",
  },
  {
    value: "shelf",
    label: "Sakura Bloom",
    dotColor: "bg-[var(--palette-shelf)]",
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap border border-border bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-fg shadow-md group-hover:block">
      {children}
    </span>
  );
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
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-bg/95 backdrop-blur-xl transition-[width,padding] duration-300 ease-out lg:flex",
        isCollapsed ? "w-[72px] items-center px-2 py-4" : "w-[238px] px-3.5 py-4",
      )}
    >
      {/* Top Header / Brand & Toggle */}
      <div
        className={cn(
          "flex w-full items-center border-b border-border pb-3.5",
          isCollapsed ? "justify-center" : "justify-between px-1",
        )}
      >
        {isCollapsed ? (
          <Link href="/" aria-label="Kaze home" className="group relative">
            <LogoMark size="sm" />
            <Tooltip>Kaze Home</Tooltip>
          </Link>
        ) : (
          <Logo size="sm" />
        )}

        {!isCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar to icons"
            className="flex h-7 w-7 items-center justify-center border border-border/60 bg-surface/40 text-faint transition-colors hover:border-accent hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PanelLeftCloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isCollapsed ? (
        <button
          type="button"
          onClick={toggleSidebar}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="group relative mt-3 flex h-8 w-8 items-center justify-center border border-border/60 bg-surface/40 text-faint transition-colors hover:border-accent hover:bg-surface hover:text-fg"
        >
          <PanelLeftOpenIcon className="h-3.5 w-3.5" />
          <Tooltip>Expand sidebar</Tooltip>
        </button>
      ) : null}

      {/* Primary Navigation */}
      <nav aria-label="Primary" className="mt-5 w-full">
        {!isCollapsed ? (
          <div className="mb-2 flex items-center gap-1.5 px-2">
            <span className="h-1 w-1 bg-accent" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
              Archive Index
            </span>
          </div>
        ) : null}

        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isCollapsed
                    ? "mx-auto h-9 w-9 justify-center border"
                    : "h-9 gap-2.5 px-2.5 text-[12.5px] border",
                  active
                    ? isCollapsed
                      ? "border-accent bg-accent/15 text-accent-strong"
                      : "border-border bg-surface text-fg font-medium"
                    : "border-transparent text-muted hover:border-border/60 hover:bg-surface/50 hover:text-fg",
                )}
              >
                {active && !isCollapsed ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1.5 left-0 w-[2px] bg-accent"
                  />
                ) : null}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active
                      ? "text-accent-strong"
                      : "text-muted group-hover:text-fg",
                  )}
                />
                {!isCollapsed ? (
                  <span className="truncate">{item.label}</span>
                ) : null}
                {isCollapsed ? <Tooltip>{item.label}</Tooltip> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer / Customization & Account */}
      <div className="mt-auto w-full border-t border-border pt-3.5 space-y-2.5">
        {/* Appearance Control */}
        {isCollapsed ? (
          <div className="group relative flex justify-center">
            <button
              type="button"
              onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
              title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle dark/light mode"
              className="flex h-8 w-8 items-center justify-center border border-border/60 bg-surface/40 text-muted transition-colors hover:border-accent hover:text-fg"
            >
              {resolved === "dark" ? (
                <MoonIcon className="h-3.5 w-3.5 text-accent-strong" />
              ) : (
                <SunIcon className="h-3.5 w-3.5 text-warning" />
              )}
            </button>
            <Tooltip>
              {resolved === "dark" ? "Light mode" : "Dark mode"}
            </Tooltip>
          </div>
        ) : (
          <div className="border border-border bg-surface/30 p-2.5 space-y-2">
            {/* Theme Mode: 3-Way Segmented Control */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
                Theme
              </span>
              <div
                role="group"
                aria-label="Theme mode"
                className="flex items-center gap-px border border-border bg-border"
              >
                {(
                  [
                    ["dark", MoonIcon, "Dark"],
                    ["light", SunIcon, "Light"],
                    ["system", MonitorIcon, "System"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    title={`${label} mode`}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center transition-colors",
                      mode === value
                        ? "bg-accent text-accent-contrast"
                        : "bg-surface text-faint hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Palette Swatches */}
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
                Accent
              </span>
              <div
                role="group"
                aria-label="Accent theme"
                className="flex items-center gap-1.5"
              >
                {ACCENT_PALETTES.map((pal) => (
                  <button
                    key={pal.value}
                    type="button"
                    aria-pressed={design === pal.value}
                    onClick={() => setDesign(pal.value)}
                    title={pal.label}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center border transition-all",
                      design === pal.value
                        ? "border-accent bg-accent/20 scale-105"
                        : "border-border/80 hover:border-accent/60",
                    )}
                  >
                    <span
                      className={cn("h-2.5 w-2.5", pal.dotColor)}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Link */}
        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "group relative flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isCollapsed
              ? "mx-auto h-9 w-9 justify-center border"
              : "h-9 gap-2.5 px-2.5 text-[12.5px] border",
            pathname === "/settings"
              ? isCollapsed
                ? "border-accent bg-accent/15 text-accent-strong"
                : "border-border bg-surface text-fg font-medium"
              : "border-transparent text-muted hover:border-border/60 hover:bg-surface/50 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-4 w-4 text-muted group-hover:text-fg transition-colors" />
          {!isCollapsed ? <span>Settings</span> : null}
          {isCollapsed ? <Tooltip>Settings</Tooltip> : null}
        </Link>

        {/* User Account Vault / Sign In Block */}
        {viewer ? (
          <Link
            href="/settings"
            className={cn(
              "group relative flex items-center border border-border bg-surface/40 transition-colors hover:border-accent hover:bg-surface",
              isCollapsed
                ? "mx-auto h-9 w-9 justify-center p-0"
                : "gap-2.5 p-2",
            )}
          >
            <UserAvatar email={viewer.email} size="sm" />
            {!isCollapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-fg transition-colors group-hover:text-accent-strong">
                    {displayName}
                  </span>
                  <span className="block truncate font-mono text-[9.5px] text-faint">
                    {viewer.email}
                  </span>
                </span>
                <ChevronRightIcon className="h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </>
            ) : null}
            {isCollapsed ? <Tooltip>{displayName}</Tooltip> : null}
          </Link>
        ) : (
          <Link
            href="/login"
            className={cn(
              "flex items-center justify-center border border-accent bg-accent text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-contrast transition-colors hover:bg-accent-hover",
              isCollapsed ? "mx-auto h-9 w-9 p-0" : "h-9 gap-2 px-3",
            )}
          >
            <UserIcon className="h-3.5 w-3.5" />
            {!isCollapsed ? <span>Sign In</span> : null}
          </Link>
        )}
      </div>
    </aside>
  );
}
