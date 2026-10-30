"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
});

const STORAGE_KEY = "kaze-sidebar-collapsed";
const SIDEBAR_EVENT = "kaze-sidebar-change";

/** Fallback for browsers where storage reads throw (private mode). */
let memoryCollapsed: boolean | null = null;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_EVENT, onStoreChange);
  };
}

function getSnapshot(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
  } catch {
    // Fall through to the in-memory value.
  }
  return memoryCollapsed ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

function persist(collapsed: boolean) {
  memoryCollapsed = collapsed;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // The in-memory value still applies for this session.
  }
  window.dispatchEvent(new Event(SIDEBAR_EVENT));
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isCollapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleSidebar = useCallback(() => {
    persist(!getSnapshot());
  }, []);

  const setCollapsed = useCallback((collapsed: boolean) => {
    persist(collapsed);
  }, []);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, toggleSidebar, setCollapsed }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
