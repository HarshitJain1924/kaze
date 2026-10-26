"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";
export type DesignDirection = "broadcast" | "editorial" | "shelf";

export const THEME_STORAGE_KEY = "kaze-theme";
export const DESIGN_STORAGE_KEY = "kaze-design";
export const DEFAULT_DESIGN: DesignDirection = "broadcast";

const THEME_EVENT = "kaze-theme-change";
const DESIGN_EVENT = "kaze-design-change";
const SYSTEM_QUERY = "(prefers-color-scheme: light)";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  design: DesignDirection;
  setDesign: (design: DesignDirection) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

let inMemoryMode: ThemeMode | null = null;
let inMemoryDesign: DesignDirection | null = null;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function isDesignDirection(value: string | null): value is DesignDirection {
  return value === "broadcast" || value === "editorial" || value === "shelf";
}

function subscribe(onStoreChange: () => void) {
  const query = window.matchMedia(SYSTEM_QUERY);
  query.addEventListener("change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);
  window.addEventListener(DESIGN_EVENT, onStoreChange);
  return () => {
    query.removeEventListener("change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
    window.removeEventListener(DESIGN_EVENT, onStoreChange);
  };
}

function getSnapshot(): string {
  let storedTheme: string | null = null;
  let storedDesign: string | null = null;
  try {
    storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    storedDesign = window.localStorage.getItem(DESIGN_STORAGE_KEY);
  } catch {
    storedTheme = null;
    storedDesign = null;
  }
  const mode = inMemoryMode ?? (isThemeMode(storedTheme) ? storedTheme : "dark");
  const design =
    inMemoryDesign ??
    (isDesignDirection(storedDesign) ? storedDesign : DEFAULT_DESIGN);
  const system = window.matchMedia(SYSTEM_QUERY).matches ? "light" : "dark";
  return `${mode}:${system}:${design}`;
}

function getServerSnapshot(): string {
  return `dark:dark:${DEFAULT_DESIGN}`;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function applyDesign(design: DesignDirection) {
  document.documentElement.dataset.design = design;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [mode, systemTheme, design] = snapshot.split(":") as [
    ThemeMode,
    ResolvedTheme,
    DesignDirection,
  ];
  const resolved: ResolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    applyDesign(design ?? DEFAULT_DESIGN);
  }, [design]);

  const setMode = useCallback((next: ThemeMode) => {
    inMemoryMode = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing can reject storage writes; the in-memory value still
      // applies for this session.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const setDesign = useCallback((next: DesignDirection) => {
    inMemoryDesign = next;
    try {
      window.localStorage.setItem(DESIGN_STORAGE_KEY, next);
    } catch {
      // Same as above: the in-memory direction still applies.
    }
    window.dispatchEvent(new Event(DESIGN_EVENT));
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, design, setDesign }),
    [mode, resolved, setMode, design, setDesign],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
