"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import type { LibraryView } from "@/types/library";

export type TitleLanguage = "english" | "romaji";

export interface DisplayPreferences {
  nickname?: string;
  titleLanguage: TitleLanguage;
  libraryView: LibraryView;
  timeZone: string; // "auto" or IANA timezone identifier e.g. "Asia/Kolkata", "Asia/Tokyo"
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  nickname: undefined,
  titleLanguage: "english",
  libraryView: "grid",
  timeZone: "auto",
};

export const PREFERENCES_STORAGE_KEY = "kaze-preferences";
const PREFERENCES_EVENT = "kaze-preferences-change";

interface PreferencesContextValue {
  preferences: DisplayPreferences;
  setPreference: <K extends keyof DisplayPreferences>(
    key: K,
    value: DisplayPreferences[K],
  ) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

let inMemoryRaw: string | null = null;

function parsePreferences(raw: string | null | undefined): DisplayPreferences {
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DisplayPreferences>;
    return {
      nickname:
        typeof parsed.nickname === "string" && parsed.nickname.trim()
          ? parsed.nickname.trim()
          : undefined,
      titleLanguage:
        parsed.titleLanguage === "romaji" ? "romaji" : "english",
      libraryView: parsed.libraryView === "list" ? "list" : "grid",
      timeZone:
        typeof parsed.timeZone === "string" && parsed.timeZone.trim()
          ? parsed.timeZone.trim()
          : "auto",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFERENCES_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFERENCES_EVENT, onStoreChange);
  };
}

function getSnapshot(): string {
  if (inMemoryRaw !== null) {
    return inMemoryRaw;
  }
  try {
    return window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const preferences = useMemo(() => parsePreferences(raw), [raw]);

  const setPreference = useCallback<PreferencesContextValue["setPreference"]>(
    (key, value) => {
      const next = { ...parsePreferences(getSnapshot()), [key]: value };
      const serialized = JSON.stringify(next);
      inMemoryRaw = serialized;
      try {
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, serialized);
      } catch {
        // Preferences remain in memory when storage is unavailable.
      }
      window.dispatchEvent(new Event(PREFERENCES_EVENT));
    },
    [],
  );

  const value = useMemo(
    () => ({ preferences, setPreference }),
    [preferences, setPreference],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}

export function useActiveTimeZone() {
  const { preferences, setPreference } = usePreferences();
  const [deviceTimeZone, setDeviceTimeZone] = useState<string>("UTC");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        setDeviceTimeZone(tz);
      }
    } catch {
      // Keep UTC fallback
    }
  }, []);

  const activeTimeZone = useMemo(() => {
    if (preferences.timeZone && preferences.timeZone !== "auto") {
      return preferences.timeZone;
    }
    return deviceTimeZone;
  }, [preferences.timeZone, deviceTimeZone]);

  const setTimeZone = useCallback(
    (tz: string) => {
      setPreference("timeZone", tz);
    },
    [setPreference],
  );

  return {
    activeTimeZone,
    preference: preferences.timeZone ?? "auto",
    isAuto: !preferences.timeZone || preferences.timeZone === "auto",
    deviceTimeZone,
    mounted,
    setTimeZone,
  };
}
