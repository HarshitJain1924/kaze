import Link from "next/link";

import {
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  CompassIcon,
  UserIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { PosterMarqueeWall } from "@/features/auth/poster-marquee-wall";

export function IntroShowcase() {
  return (
    <aside className="relative flex min-h-dvh flex-col justify-between overflow-hidden border-r border-border bg-bg p-8 sm:p-10 lg:p-12 select-none">
      {/* Infinite Auto-Scrolling Anime Poster Library */}
      <PosterMarqueeWall />

      {/* Top Header: Brand Identity & Verified Ledger Tag */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pb-4">
        <Logo />
        <div className="inline-flex items-center gap-2 border border-border bg-surface/90 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-strong backdrop-blur-md">
          <span className="h-1.5 w-1.5 bg-accent" />
          <span>Vault Isolated // RLS</span>
        </div>
      </div>

      {/* Centerpiece: Cinematic Copy & 4 Ruled Feature Pods */}
      <div className="relative z-10 my-auto max-w-xl space-y-6 py-6">
        {/* Eyebrow Chip */}
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
            Personal Archive · High-Fidelity Ledger
          </span>
        </div>

        {/* Main Headline */}
        <div className="space-y-3">
          <h1 className="font-display text-[clamp(2rem,3.8vw,3.25rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-fg">
            A quieter, cinematic architecture for your anime catalog.
          </h1>
          <p className="text-xs leading-relaxed text-muted sm:text-sm">
            One distraction-free home for your watchlist, episode progress,
            personal ratings, and broadcast countdowns — built for collectors,
            not engagement feeds.
          </p>
        </div>

        {/* 4 Ruled Feature Pods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px border border-border bg-border">
          {/* Pod 1 */}
          <div className="flex flex-col justify-between bg-surface/75 p-4 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold tracking-wider text-accent-strong">
                01 // CATALOG
              </span>
              <CompassIcon className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-3">
              <h3 className="font-display text-sm font-semibold text-fg">
                10,000+ Verified Titles
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Live broadcast telemetry and metadata synchronized with AniList GraphQL.
              </p>
            </div>
          </div>

          {/* Pod 2 */}
          <div className="flex flex-col justify-between bg-surface/75 p-4 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold tracking-wider text-accent-strong">
                02 // STEPPER
              </span>
              <CheckIcon className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-3">
              <h3 className="font-display text-sm font-semibold text-fg">
                One-Tap Episode Stepper
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Log episodes instantly with zero latency from home, library, or schedule.
              </p>
            </div>
          </div>

          {/* Pod 3 */}
          <div className="flex flex-col justify-between bg-surface/75 p-4 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold tracking-wider text-accent-strong">
                03 // TELEMETRY
              </span>
              <ChartIcon className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-3">
              <h3 className="font-display text-sm font-semibold text-fg">
                Radar Telemetry &amp; Matrix
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Verified runtime calculations, rating curves, and multidimensional taste profiles.
              </p>
            </div>
          </div>

          {/* Pod 4 */}
          <div className="flex flex-col justify-between bg-surface/75 p-4 transition-colors hover:bg-surface">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] font-bold tracking-wider text-accent-strong">
                04 // PRIVACY
              </span>
              <UserIcon className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-3">
              <h3 className="font-display text-sm font-semibold text-fg">
                Private Vault Isolation
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Row-Level Security (RLS) ensures your watch history remains strictly private.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Trust Credentials & Guest Explore Link */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[11px] text-faint">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent" />
          <span>Metadata powered by AniList GraphQL</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 font-semibold text-accent-strong transition-colors hover:text-fg"
          >
            <span>Explore Catalog as Guest</span>
            <ChevronRightIcon className="h-3 w-3" />
          </Link>
          <span className="text-faint/40">|</span>
          <span className="font-mono">Secured by Supabase RLS</span>
        </div>
      </div>
    </aside>
  );
}
