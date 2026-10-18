"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ToastTone = "default" | "success" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  default: "border-border text-fg",
  success: "border-success/30 text-fg",
  error: "border-danger/40 text-fg",
};

const TONE_ICON_STYLES: Record<ToastTone, string> = {
  default: "bg-accent-soft text-accent-strong",
  success: "bg-success/10 text-success",
  error: "bg-danger-soft text-danger",
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  const className = "h-4 w-4";
  if (tone === "success") return <CheckIcon className={className} />;
  if (tone === "error") return <AlertIcon className={className} />;
  return <InfoIcon className={className} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timerIds = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    const timer = timerIds.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerIds.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current;
      nextId.current += 1;
      const record: ToastRecord = {
        ...input,
        id,
        tone: input.tone ?? "default",
      };
      setToasts((current) => [...current.slice(-2), record]);
      const duration = input.durationMs ?? 4200;
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timerIds.current.set(id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timerIds.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end lg:px-0"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface/95 p-3 shadow-xl shadow-black/20 backdrop-blur animate-fade",
              TONE_STYLES[item.tone],
            )}
            role={item.tone === "error" ? "alert" : "status"}
          >
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                TONE_ICON_STYLES[item.tone],
              )}
            >
              <ToneIcon tone={item.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {item.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
