import type { ReactNode } from "react";

import { DesktopSidebar } from "@/components/desktop-sidebar";
import {
  MobileBottomNavigation,
  MobileHeader,
} from "@/components/mobile-navigation";
import type { Viewer } from "@/types/viewer";

export function AppShell({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <DesktopSidebar viewer={viewer} />
      <div className="lg:pl-[252px]">
        <MobileHeader viewer={viewer} />
        <main className="mx-auto w-full max-w-[1560px] px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>
      <MobileBottomNavigation />
    </div>
  );
}
