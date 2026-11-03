"use client";

import { useTheme, type ThemeMode } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.4 8.4 0 1 0 11.2 11.2Z" />
    </svg>
  );
}

function SystemIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

const OPTIONS: Array<{
  mode: ThemeMode;
  label: string;
  Icon: typeof SunIcon;
}> = [
  { mode: "light", label: "Light", Icon: SunIcon },
  { mode: "dark", label: "Dark", Icon: MoonIcon },
  { mode: "system", label: "System", Icon: SystemIcon },
];

export function LandingAppearanceControl({
  className,
}: {
  className?: string;
}) {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center border border-[color:var(--landing-rule)]",
        className,
      )}
    >
      {OPTIONS.map(({ mode: optionMode, label, Icon }) => {
        const active = mode === optionMode;

        return (
          <button
            key={optionMode}
            type="button"
            onClick={() => setMode(optionMode)}
            aria-label={`Use ${label.toLowerCase()} appearance`}
            aria-pressed={active}
            title={`${label} appearance`}
            className={cn(
              "flex h-7 w-7 items-center justify-center border-r border-[color:var(--landing-rule)] transition-colors last:border-r-0",
              active
                ? "bg-[var(--landing-accent)] text-[var(--landing-accent-ink)]"
                : "text-[var(--landing-faint)] hover:bg-[var(--landing-paper-2)] hover:text-[var(--landing-ink)]",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
