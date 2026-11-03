import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface KazeEmblemProps {
  className?: string;
  /** Optional custom accent color override. If omitted, seamlessly adapts to the active theme accent. */
  accentColor?: string;
  accentStrongColor?: string;
}

/**
 * Authentic Japanese KAZE (風) Master Emblem.
 * Fully adaptive vector recreation preserving 100% of the reference design:
 * - The Celestial Moon (Tsuki)
 * - The Torii Gate silhouette (鳥居)
 * - The Katana "K" lettermark with 3D bevel fold
 * - The sweeping Wind Slash (風の刃)
 * - The Autumn Maple Leaf (Momiji / 紅葉)
 * - The squircle container with dynamic rim glow
 *
 * Dynamically blends to ANY color theme (Midnight Violet, Cyber Neon Cyan, Sakura Bloom, etc.)
 * and smoothly adapts between Light and Dark modes via CSS design tokens.
 */
export function KazeEmblem({
  className,
  accentColor,
  accentStrongColor,
}: KazeEmblemProps) {
  const reactId = useId();
  const id = `kaze-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const accent = accentColor || "var(--accent, #7c3aed)";
  const accentStrong = accentStrongColor || "var(--accent-strong, #a78bfa)";

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full select-none", className)}
      aria-hidden="true"
    >
      <defs>
        {/* Dynamic Celestial Moon Radial Glow */}
        <radialGradient id={`${id}-moon`} cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor={accentStrong}
            stopOpacity="0.85"
            className="light:stop-opacity-40"
          />
          <stop
            offset="45%"
            stopColor={accent}
            stopOpacity="0.55"
            className="light:stop-opacity-25"
          />
          <stop
            offset="90%"
            stopColor={accent}
            stopOpacity="0.2"
            className="light:stop-opacity-10"
          />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>

        {/* Dynamic Wind Slash Linear Gradient */}
        <linearGradient
          id={`${id}-wind`}
          x1="110"
          y1="350"
          x2="380"
          y2="300"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
          <stop offset="35%" stopColor={accent} />
          <stop offset="75%" stopColor={accentStrong} />
          <stop offset="100%" stopColor={accent} stopOpacity="0.8" />
        </linearGradient>

        {/* Dynamic Squircle Rim Highlight */}
        <linearGradient
          id={`${id}-rim`}
          x1="50"
          y1="30"
          x2="460"
          y2="480"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0%"
            stopColor="var(--fg, #ffffff)"
            stopOpacity="0.25"
            className="light:stop-opacity-15"
          />
          <stop
            offset="40%"
            stopColor={accent}
            stopOpacity="0.35"
            className="light:stop-opacity-20"
          />
          <stop
            offset="100%"
            stopColor={accent}
            stopOpacity="0.85"
            className="light:stop-opacity-50"
          />
        </linearGradient>

        {/* Soft Atmosphere Drop-Shadow */}
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="10"
            floodColor={accent}
            floodOpacity="0.45"
            className="light:flood-opacity-25"
          />
        </filter>
      </defs>

      {/* 1. Squircle Base: Obsidian in Dark mode, Frosted Titanium in Light mode */}
      <rect
        x="24"
        y="24"
        width="464"
        height="464"
        rx="108"
        fill="var(--surface-2, #181c2b)"
        className="light:fill-surface-2 transition-colors duration-300"
      />
      <rect
        x="26"
        y="26"
        width="460"
        height="460"
        rx="106"
        fill="none"
        stroke={`url(#${id}-rim)`}
        strokeWidth="4"
        className="transition-colors duration-300"
      />

      {/* 2. Celestial Moon (Tsuki): Dynamically takes the active theme accent */}
      <circle
        cx="256"
        cy="216"
        r="118"
        fill={`url(#${id}-moon)`}
        className="transition-colors duration-300"
      />
      <circle
        cx="256"
        cy="216"
        r="114"
        fill={accent}
        fillOpacity="0.16"
        className="light:fill-opacity-10 transition-colors duration-300"
      />

      {/* 3. The Torii Gate (鳥居) Silhouette */}
      <g
        fill="var(--surface-3, #080911)"
        fillOpacity="0.8"
        className="light:fill-fg/25 transition-colors duration-300"
      >
        <path d="M174 172C205 167 307 167 338 172C344 173 344 179 337 180.5C313 183 199 183 175 180.5C168 179 168 173 174 172Z" />
        <rect x="187" y="190" width="138" height="13" rx="2.5" />
        <rect x="248" y="177" width="16" height="15" />
        <path d="M202 201L195 298H208L213 201H202Z" />
        <path d="M310 201L317 298H304L299 201H310Z" />
      </g>

      {/* 4. Wind Slash - Back Arc Swoosh */}
      <path
        d="M288 276C350 276 390 302 370 328C350 348 288 348 242 333C222 325 212 318 227 315C252 312 324 317 344 307C360 297 334 284 288 284Z"
        fill={`url(#${id}-wind)`}
        filter={`url(#${id}-glow)`}
        className="transition-colors duration-300"
      />

      {/* 5. The Katana "K" Lettermark */}
      <g filter={`url(#${id}-glow)`}>
        {/* Left Katana Stem: Luminous Front Face */}
        <path
          d="M168 238C158 230 152 218 162 218H188V388H162C152 388 155 375 168 368V238Z"
          fill="var(--fg, #ffffff)"
          className="light:fill-fg transition-colors duration-300"
        />
        {/* Left Katana Stem: Beveled Steel Edge */}
        <path
          d="M188 218H206V388H188V218Z"
          fill="var(--fg, #f1f5f9)"
          fillOpacity="0.88"
          className="light:fill-fg light:fill-opacity-80 transition-colors duration-300"
        />

        {/* Upper Diagonal Arm with razor-flared serif */}
        <path
          d="M196 312L295 226C303 218 318 218 328 218V238L232 325L196 312Z"
          fill="var(--fg, #ffffff)"
          className="light:fill-fg transition-colors duration-300"
        />

        {/* Lower Diagonal Leg with dimensional fold */}
        <path
          d="M216 302L315 388H346V371L254 290L216 302Z"
          fill="var(--fg, #f1f5f9)"
          fillOpacity="0.94"
          className="light:fill-fg light:fill-opacity-90 transition-colors duration-300"
        />
      </g>

      {/* 6. Wind Slash - Front Foreground Blade */}
      <path
        d="M108 354C158 344 209 324 260 304C235 314 184 334 133 346C113 351 103 354 108 354Z"
        fill={accentStrong}
        filter={`url(#${id}-glow)`}
        className="transition-colors duration-300"
      />

      {/* 7. The Autumn Maple Leaf (Momiji / 紅葉) */}
      <g
        transform="translate(348, 230) rotate(22) scale(1.6)"
        filter={`url(#${id}-glow)`}
        className="transition-colors duration-300"
      >
        <path
          d="M10 0L12 7L18 4L14 10L20 12L13 14L15 20L10 15L5 20L7 14L0 12L6 10L2 4L8 7L10 0Z"
          fill={accentStrong}
        />
        <path
          d="M10 15L8 23"
          stroke={accent}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export interface LogoMarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  accentColor?: string;
  accentStrongColor?: string;
}

const SIZE_VARIANTS = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
  xl: "h-16 w-16",
};

export function LogoMark({
  size = "md",
  className,
  accentColor,
  accentStrongColor,
}: LogoMarkProps) {
  const container = SIZE_VARIANTS[size] || SIZE_VARIANTS.md;

  return (
    <span
      className={cn(
        "group/mark relative flex shrink-0 items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 select-none drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)]",
        container,
        className,
      )}
      aria-hidden="true"
    >
      <KazeEmblem
        accentColor={accentColor}
        accentStrongColor={accentStrongColor}
      />
    </span>
  );
}

export interface LogoProps {
  compact?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  href?: string;
  showKanji?: boolean;
  accentColor?: string;
}

export function Logo({
  compact = false,
  size = "md",
  className,
  href = "/",
  showKanji = true,
  accentColor,
}: LogoProps) {
  const content = (
    <span
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-xl transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
      aria-label="Kaze home"
    >
      <LogoMark size={size} accentColor={accentColor} />
      <span className="flex flex-col leading-none">
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[17px] font-black tracking-[0.24em] text-fg transition-colors group-hover:text-accent-strong">
            KAZE
          </span>
          {showKanji && (
            <span
              className="text-[11px] font-bold tracking-tight text-accent select-none transition-colors duration-300 drop-shadow-[0_0_8px_rgba(var(--accent-rgb,124,58,237),0.4)]"
              title="Kaze (Wind)"
            >
              風
            </span>
          )}
        </span>
        {compact ? null : (
          <span className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-faint">
            Anime tracker
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
