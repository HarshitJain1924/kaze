"use client";

import type { ReactNode } from "react";

import { CommandPalette } from "@/components/command-palette";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import {
  MobileBottomNavigation,
  MobileHeader,
} from "@/components/mobile-navigation";
import { OpticalGlassFilter } from "@/components/ui/optical-glass";
import { useSidebar } from "@/components/providers/sidebar-provider";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/types/viewer";

export function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: ReactNode;
}) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-dvh">
      <DesktopSidebar viewer={viewer} />
      <OpticalGlassFilter />
      <div
        className={cn(
          "transition-[padding] duration-300 ease-out",
          isCollapsed ? "lg:pl-[72px]" : "lg:pl-[238px]",
        )}
      >
        <MobileHeader viewer={viewer} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-6">
          {children}
        </main>
      </div>
      <MobileBottomNavigation />
      <CommandPalette />
    </div>
  );
}
