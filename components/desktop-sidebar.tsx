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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r border-border-subtle bg-bg-soft/95 px-4 py-6 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.18)] lg:flex">
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
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-accent/20 via-accent/10 to-transparent text-fg shadow-sm border border-accent/25"
                  : "text-muted hover:bg-surface/80 hover:text-fg hover:border hover:border-white/5",
              )}
            >
              {active ? (
                <span className="absolute left-0 top-2.5 h-[calc(100%-20px)] w-1 rounded-full bg-gradient-to-b from-accent to-accent-strong shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              ) : null}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110",
                  active ? "text-accent-strong drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]" : "text-faint group-hover:text-muted",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {active ? (
                <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings"
              ? "bg-accent-soft text-fg border border-accent/25"
              : "text-muted hover:bg-surface/70 hover:text-fg",
          )}
        >
          <SettingsIcon className="h-[18px] w-[18px] text-faint transition-transform duration-200 hover:rotate-45" />
          Settings
        </Link>

        {viewer ? (
          <Link
            href="/settings"
            className="group flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface/80 p-3 backdrop-blur-sm transition-all duration-200 hover:border-accent/40 hover:bg-surface hover:shadow-lg hover:shadow-black/25"
          >
            <div className="relative shrink-0">
              <UserAvatar email={viewer.email} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
              </span>
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-fg group-hover:text-accent-strong transition-colors">
                {viewer.email ?? "Signed in"}
              </span>
              <span className="mt-0.5 block text-[11px] text-faint">
                Account & synced data
              </span>
            </span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-violet-600/40"
          >
            Sign in to track
          </Link>
        )}

        <p className="px-2 text-[10px] leading-relaxed text-faint">
          Metadata from AniList. Library stays private to your account.
        </p>
      </div>
    </aside>
  );
}
