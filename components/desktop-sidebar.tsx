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
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { Logo, LogoMark } from "@/components/logo";
import { useSidebar } from "@/components/providers/sidebar-provider";
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
  { href: "/", label: "Home", icon: HomeIcon, exact: true },
  { href: "/discover", label: "Discover", icon: CompassIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/library", label: "My Library", icon: LibraryIcon },
  { href: "/stats", label: "Statistics", icon: ChartIcon },
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

  const username = viewer?.email ? viewer.email.split("@")[0] : null;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-bg-soft/75 backdrop-blur-2xl backdrop-saturate-[180%] shadow-[inset_-1px_0_1px_rgba(255,255,255,0.06)] transition-[width,padding] duration-300 ease-out lg:flex",
        isCollapsed
          ? "w-[72px] items-center px-2 py-5"
          : "w-[238px] px-3.5 py-6",
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
            className="group relative flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-white/[0.08] hover:text-fg active:scale-95"
          >
            <PanelLeftCloseIcon className="h-4 w-4" />
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
              Collapse sidebar
            </div>
          </button>
        </div>
      )}

      {/* Main Navigation Items */}
      <nav aria-label="Primary" className="mt-8 w-full space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center rounded-xl transition-all",
                isCollapsed
                  ? "mx-auto h-11 w-11 justify-center"
                  : "gap-3 px-3.5 py-2.5 text-sm",
                active
                  ? "bg-accent-soft font-semibold text-fg ring-1 ring-accent/25 shadow-xs"
                  : "font-medium text-muted hover:bg-surface/60 hover:text-fg",
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

      {/* Bottom Area: Settings & Profile */}
      <div className="mt-auto w-full space-y-2.5 pt-4">
        {/* Settings Link */}
        <Link
          href="/settings"
          className={cn(
            "group relative flex items-center rounded-xl transition-all",
            isCollapsed
              ? "mx-auto h-11 w-11 justify-center"
              : "gap-3 px-3.5 py-2.5 text-sm",
            pathname === "/settings"
              ? "bg-accent-soft font-semibold text-fg ring-1 ring-accent/25 shadow-xs"
              : "font-medium text-muted hover:bg-surface/60 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-[18px] w-[18px] shrink-0 text-faint group-hover:text-muted transition-colors" />

          {!isCollapsed ? <span className="flex-1 truncate">Settings</span> : null}

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
              "group relative flex items-center rounded-2xl liquid-glass-interactive transition-colors",
              isCollapsed
                ? "mx-auto h-11 w-11 justify-center p-0"
                : "gap-2.5 p-2",
            )}
          >
            <div className="relative shrink-0">
              <UserAvatar email={viewer.email} />
            </div>

            {!isCollapsed ? (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-fg transition-colors group-hover:text-accent-strong">
                    {username ?? viewer.email}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {viewer.email}
                  </span>
                </span>
                <span className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-muted">
                  ›
                </span>
              </>
            ) : null}

            {/* Hover Tooltip with user info in collapsed mode */}
            {isCollapsed ? (
              <div className="pointer-events-none absolute left-full ml-3 z-50 hidden flex-col rounded-xl liquid-glass px-3 py-1.5 text-xs font-semibold text-fg shadow-2xl whitespace-nowrap group-hover:flex animate-fade">
                <span>{username ?? "Signed in"}</span>
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
              "group relative flex items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-hover shadow-xs",
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
