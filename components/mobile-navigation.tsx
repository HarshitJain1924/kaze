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
  SearchIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
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
  { href: "/", label: "Home", icon: HomeIcon, exact: true },
  { href: "/discover", label: "Discover", icon: CompassIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/stats", label: "Stats", icon: ChartIcon },
];

function isActive(pathname: string, item: MobileNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg/85 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo compact />
        <div className="flex items-center gap-1">
          <Link
            href="/discover"
            aria-label="Search anime"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href={viewer ? "/settings" : "/login"}
            aria-label={viewer ? "Account settings" : "Sign in"}
            className="flex h-9 items-center justify-center rounded-lg px-1.5 transition-colors hover:bg-surface-2"
          >
            {viewer ? (
              <UserAvatar email={viewer.email} size="sm" />
            ) : (
              <span className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-contrast">
                Sign in
              </span>
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
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-bg/85 backdrop-blur-xl shadow-[0_-8px_24px_rgba(0,0,0,0.35)] lg:hidden"
    >
      <div className="grid grid-cols-5 py-0.5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-1 text-[10px] font-medium transition-colors",
                active ? "text-accent-strong font-semibold" : "text-faint hover:text-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  active ? "scale-110 text-accent-strong drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]" : "text-faint",
                )}
              />
              <span>{item.label}</span>
              {active ? (
                <span className="absolute bottom-1 h-1 w-3.5 rounded-full bg-accent shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
