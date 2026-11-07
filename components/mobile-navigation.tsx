"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import {
  BookmarkIcon,
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  HomeIcon,
  LibraryIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/providers/theme-provider";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/types/viewer";

interface MobileNavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

const ITEMS: MobileNavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/discover", label: "Discover", icon: CompassIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/lists", label: "Lists", icon: BookmarkIcon },
  { href: "/stats", label: "Stats", icon: ChartIcon },
];

function isActive(pathname: string, item: MobileNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileHeader({ viewer }: { viewer: Viewer | null }) {
  const { resolved, setMode } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 optical-glass-nav lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo compact />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMode(resolved === "dark" ? "light" : "dark")}
            aria-label="Toggle dark/light theme"
            title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
            className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-fg"
          >
            {resolved === "dark" ? (
              <MoonIcon className="h-4 w-4 text-accent-strong" />
            ) : (
              <SunIcon className="h-4 w-4 text-warning" />
            )}
          </button>

          <Link
            href="/discover"
            aria-label="Search titles"
            className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-fg"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href={viewer ? "/settings" : "/login"}
            aria-label={viewer ? "Account settings" : "Sign in"}
            className="flex h-10 min-w-10 items-center justify-center px-1 text-xs font-semibold text-accent-strong"
          >
            {viewer ? (
              <UserAvatar email={viewer.email} size="sm" />
            ) : (
              <span>Sign in</span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 optical-glass-nav lg:hidden"
    >
      <div className="grid grid-cols-7">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-0.5 py-1 text-[10px] font-medium transition-colors",
                active ? "text-accent-strong" : "text-faint",
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-[2px] bg-accent"
                />
              ) : null}
              <Icon className="h-4.5 w-4.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
