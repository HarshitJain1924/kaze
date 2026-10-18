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
  SettingsIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
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

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border-subtle bg-bg-soft px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label="Primary" className="mt-9 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-fg"
                  : "text-muted hover:bg-surface/70 hover:text-fg",
              )}
            >
              {active ? (
                <span className="absolute left-0 top-2.5 h-[calc(100%-20px)] w-0.5 rounded-full bg-accent-strong" />
              ) : null}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-accent-strong" : "text-faint group-hover:text-muted",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-accent-soft text-fg"
              : "text-muted hover:bg-surface/70 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-[18px] w-[18px] text-faint" />
          Settings
        </Link>

        {viewer ? (
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3 transition-colors hover:border-border"
          >
            <UserAvatar email={viewer.email} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-fg">
                {viewer.email ?? "Signed in"}
              </span>
              <span className="mt-0.5 block text-[11px] text-faint">
                View account
              </span>
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
          >
            Sign in to track
          </Link>
        )}

        <p className="px-2 text-[10px] leading-relaxed text-faint">
          Anime data from AniList. Your library stays private to your account.
        </p>
      </div>
    </aside>
  );
}
