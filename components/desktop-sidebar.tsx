"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import {
  BookmarkIcon,
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  FilmIcon,
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
  { href: "/screen", label: "Films & TV", icon: FilmIcon },
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
    <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap border border-border bg-bg px-2.5 py-1.5 text-[11px] font-medium text-fg shadow-sm group-hover:block">
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
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-bg transition-[width,padding] duration-300 ease-out lg:flex",
        isCollapsed ? "w-16 items-center px-2 py-5" : "w-[228px] px-4 py-5",
      )}
    >
      <div
        className={cn(
          "flex w-full items-center border-b border-border pb-5",
          isCollapsed ? "justify-center" : "justify-between",
        )}
      >
        {isCollapsed ? (
          <Link href="/" aria-label="Kaze home" className="group relative">
            <LogoMark />
            <Tooltip>Kaze Home</Tooltip>
          </Link>
        ) : (
          <Logo />
        )}

        {!isCollapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar to icons"
            className="group relative flex h-8 w-8 items-center justify-center text-faint transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isCollapsed ? (
        <button
          type="button"
          onClick={toggleSidebar}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="group relative mt-4 flex h-9 w-9 items-center justify-center text-faint transition-colors hover:text-fg"
        >
          <PanelLeftOpenIcon className="h-4 w-4" />
          <Tooltip>Expand sidebar</Tooltip>
        </button>
      ) : null}

      <nav aria-label="Primary" className="mt-7 w-full">
        {!isCollapsed ? (
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-faint">
            Library
          </p>
        ) : null}
        <div className="space-y-0.5">
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
                    ? "mx-auto h-10 w-10 justify-center"
                    : "h-9 gap-3 px-3 text-[13px]",
                  active
                    ? "bg-surface-2 text-fg"
                    : "text-muted hover:bg-surface/60 hover:text-fg",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-1 left-0 w-[2px] bg-accent"
                  />
                ) : null}
                <Icon
                  className={cn(
                    "h-[17px] w-[17px] shrink-0",
                    active
                      ? "text-accent-strong"
                      : "text-faint group-hover:text-muted",
                  )}
                />
                {!isCollapsed ? (
                  <span className={cn("truncate", active && "font-medium")}>
                    {item.label}
                  </span>
                ) : null}
                {isCollapsed ? <Tooltip>{item.label}</Tooltip> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto w-full border-t border-border pt-4">
        {isCollapsed ? (
          <div className="group relative flex justify-center">
            <button
              type="button"
              onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
              title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
              aria-label="Toggle dark/light mode"
              className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-fg"
            >
              {resolved === "dark" ? (
                <MoonIcon className="h-4 w-4 text-accent-strong" />
              ) : (
                <SunIcon className="h-4 w-4 text-warning" />
              )}
            </button>
            <Tooltip>
              {resolved === "dark" ? "Light mode" : "Dark mode"}
            </Tooltip>
          </div>
        ) : (
          <div className="space-y-3 px-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-faint">
                Appearance
              </span>
              <div
                role="group"
                aria-label="Theme mode"
                className="flex items-center gap-1"
              >
                {(
                  [
                    ["dark", MoonIcon],
                    ["light", SunIcon],
                    ["system", MonitorIcon],
                  ] as const
                ).map(([value, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    title={`${value} appearance`}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center border transition-colors",
                      mode === value
                        ? "border-accent/50 bg-accent-soft text-accent-strong"
                        : "border-transparent text-faint hover:border-border hover:text-fg",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-faint">Accent</span>
              <div
                role="group"
                aria-label="Accent theme"
                className="flex items-center gap-2"
              >
                {ACCENT_PALETTES.map((pal) => (
                  <button
                    key={pal.value}
                    type="button"
                    aria-pressed={design === pal.value}
                    onClick={() => setDesign(pal.value)}
                    title={pal.label}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center border transition-colors",
                      design === pal.value
                        ? "border-accent/60"
                        : "border-transparent hover:border-border",
                    )}
                  >
                    <span
                      className={cn("h-3 w-3 rounded-full", pal.dotColor)}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn(
            "group relative mt-3 flex items-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isCollapsed
              ? "mx-auto h-10 w-10 justify-center"
              : "h-9 gap-3 px-3 text-[13px]",
            pathname === "/settings"
              ? "bg-surface-2 text-fg"
              : "text-muted hover:bg-surface/60 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-[17px] w-[17px] text-faint" />
          {!isCollapsed ? <span>Settings</span> : null}
          {isCollapsed ? <Tooltip>Settings</Tooltip> : null}
        </Link>

        {viewer ? (
          <Link
            href="/settings"
            className={cn(
              "group relative mt-3 flex items-center border-t border-border transition-colors hover:bg-surface/60",
              isCollapsed
                ? "mx-auto h-10 w-10 justify-center"
                : "gap-2.5 pt-3",
            )}
          >
            <UserAvatar email={viewer.email} />
            {!isCollapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-fg">
                    {displayName}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {viewer.email}
                  </span>
                </span>
                <span className="text-faint">›</span>
              </>
            ) : null}
            {isCollapsed ? <Tooltip>{displayName}</Tooltip> : null}
          </Link>
        ) : (
          <Link
            href="/login"
            className={cn(
              "mt-3 flex items-center justify-center bg-accent text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover",
              isCollapsed ? "mx-auto h-10 w-10" : "h-9 gap-2 px-3",
            )}
          >
            <UserIcon className="h-4 w-4" />
            {!isCollapsed ? <span>Sign in</span> : null}
          </Link>
        )}
      </div>
    </aside>
  );
}
