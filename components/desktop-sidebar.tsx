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

  const username = viewer?.email ? viewer.email.split("@")[0] : null;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[238px] flex-col border-r border-border-subtle bg-bg-soft px-3.5 py-6 lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label="Primary" className="mt-8 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[#181826] font-semibold text-white shadow-sm ring-1 ring-white/5"
                  : "font-medium text-muted hover:bg-surface/60 hover:text-fg",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-white" : "text-faint group-hover:text-muted",
                )}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-[#181826] font-semibold text-white ring-1 ring-white/5"
              : "font-medium text-muted hover:bg-surface/60 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-[18px] w-[18px] text-faint" />
          Settings
        </Link>

        {viewer ? (
          <Link
            href="/settings"
            className="group flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface/50 p-2 transition-colors hover:border-border hover:bg-surface"
          >
            <div className="relative shrink-0">
              <UserAvatar email={viewer.email} />
            </div>
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
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
          >
            Sign in to track
          </Link>
        )}
      </div>
    </aside>
  );
}
