import Link from "next/link";

import {
  ChartIcon,
  CheckIcon,
  CompassIcon,
  SparklesIcon,
  UserIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import { PosterMarqueeWall } from "@/features/auth/poster-marquee-wall";

export function IntroShowcase() {
  return (
    <aside className="relative flex min-h-dvh flex-col justify-between overflow-hidden border-r border-border-subtle bg-bg-soft p-8 sm:p-10 lg:p-12 select-none">
      {/* Dynamic Infinite Auto-Scrolling Anime Poster Library (Random Left/Right) */}
      <PosterMarqueeWall />

      {/* Top Header: Brand Identity & Live Status Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <Logo />
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-semibold text-emerald-300 light:bg-emerald-500/10 light:text-emerald-700 shadow-md backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-emerald-400 radar-live-dot" />
          <span>Private Vault</span>
        </div>
      </div>

      {/* Centerpiece: Cinematic Copy & 4 Glass Feature Artifacts */}
      <div className="relative z-10 my-auto max-w-xl space-y-6 py-6">
        {/* Chip Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-300 light:text-purple-700 backdrop-blur-md">
          <SparklesIcon className="h-3.5 w-3.5" />
          <span>Personal Anime Sanctuary</span>
        </div>

        {/* Main Headline */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-extrabold leading-[1.15] tracking-tight text-fg sm:text-4xl lg:text-[42px] drop-shadow-lg">
            A quieter, cinematic way to track your anime journey.
          </h1>
          <p className="text-sm leading-relaxed text-muted/95 sm:text-base">
            One beautiful home for your watchlist, episode progress, personal ratings and private notes — designed around artwork and motion, never clutter.
          </p>
        </div>

        {/* The 4 Executive Glass Cards */}
        <div className="space-y-3 pt-1">
          {/* Card 1 */}
          <div className="group flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface/80 p-4 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-border hover:bg-surface hover:translate-x-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-300 light:text-purple-700 group-hover:scale-105 transition-transform">
              <CompassIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-fg">10,000+ Series & Films</h3>
              <p className="text-xs text-muted">Real-time metadata and broadcast countdowns from AniList.</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface/80 p-4 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-border hover:bg-surface hover:translate-x-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-300 light:text-purple-700 group-hover:scale-105 transition-transform">
              <CheckIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-fg">One-Tap Progress Stepper</h3>
              <p className="text-xs text-muted">Log episodes instantly from home, library, or schedule.</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface/80 p-4 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-border hover:bg-surface hover:translate-x-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-300 light:text-purple-700 group-hover:scale-105 transition-transform">
              <ChartIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-fg">Radar Telemetry & Analytics</h3>
              <p className="text-xs text-muted">Calculate total watch time and your multidimensional taste profile.</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="group flex items-center gap-4 rounded-2xl border border-border-subtle bg-surface/80 p-4 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-border hover:bg-surface hover:translate-x-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/15 text-purple-300 light:text-purple-700 group-hover:scale-105 transition-transform">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-fg">Private & Synced Everywhere</h3>
              <p className="text-xs text-muted">Row-level security protection with seamless cloud sync.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Trust Credentials & Guest Explore Link */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-xs text-faint">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
          <span>Metadata powered by AniList GraphQL</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/discover"
            className="font-semibold text-accent-strong hover:text-fg transition-colors"
          >
            Explore Catalog as Guest →
          </Link>
          <span className="text-faint/40">|</span>
          <span>Secured by Supabase RLS</span>
        </div>
      </div>
    </aside>
  );
}
