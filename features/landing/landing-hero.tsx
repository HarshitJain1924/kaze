"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import {
  CheckIcon,
  ClockIcon,
  FlameIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  ZapIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/types/viewer";

export function LandingHero({ viewer }: { viewer: Viewer | null }) {
  const [demoEp, setDemoEp] = useState(3);
  const totalDemoEps = 10;
  const demoPct = Math.round((demoEp / totalDemoEps) * 100);

  const handleStepDemo = () => {
    if (demoEp < totalDemoEps) {
      setDemoEp((prev) => prev + 1);
    }
  };

  const handleResetDemo = () => {
    setDemoEp(3);
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
      {/* Atmospheric Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-accent/15 blur-[160px]" />
      <div className="pointer-events-none absolute top-1/3 -left-32 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 -right-32 h-[450px] w-[450px] rounded-full bg-cyan-500/10 blur-[150px]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Top Eyebrow Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 shadow-lg backdrop-blur-xl ring-1 ring-purple-500/20 animate-fade">
            <SparklesIcon className="h-3.5 w-3.5 text-accent-strong" />
            <span>Personal Anime Sanctuary · Version 2.0</span>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline text-white/70">
              AniList Live Edge Pipeline
            </span>
          </div>
        </div>

        {/* Main Title & Value Proposition */}
        <div className="mx-auto mt-6 max-w-4xl text-center">
          <h1 className="font-display text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl drop-shadow-xl">
            Your anime journey,{" "}
            <span className="bg-gradient-to-r from-purple-200 via-white to-accent-strong bg-clip-text text-transparent">
              elevated to cinema.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg lg:text-xl">
            Stop logging episodes into clunky spreadsheets and ad-infested forums.
            Track your simulcasts in 1-tap, watch live broadcast countdowns from Tokyo,
            and keep your watch history in a private, account-scoped vault.
          </p>

          {/* CTA Button Cluster */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            {viewer ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-contrast shadow-xl shadow-accent/25 hover:bg-accent-hover hover:scale-[1.02] active:scale-95 transition-all"
              >
                <span>Launch Sanctuary Dashboard</span>
                <span className="text-base">→</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-contrast shadow-xl shadow-accent/25 hover:bg-accent-hover hover:scale-[1.02] active:scale-95 transition-all"
              >
                <SparklesIcon className="h-4 w-4" />
                <span>Start Tracking Free</span>
                <span className="text-base">→</span>
              </Link>
            )}

            <Link
              href="/discover"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface/80 px-6 py-4 text-sm font-bold text-fg backdrop-blur-xl hover:bg-surface-2 hover:border-white/20 transition-all active:scale-95"
            >
              <PlayIcon className="h-4 w-4 text-accent-strong" />
              <span>Explore Live Catalogue</span>
            </Link>
          </div>

          {/* Micro Trust Telemetry Strip */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-muted/80">
            <span className="flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
              Zero Ads Forever
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ZapIcon className="h-3.5 w-3.5 text-accent-strong" />
              1-Tap Episode Stepper
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-amber-400" />
              Live Tokyo Broadcast Radar
            </span>
            <span className="text-white/20 hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheckIcon className="h-3.5 w-3.5 text-purple-400" />
              Supabase RLS Protection
            </span>
          </div>
        </div>

        {/* 3. Living Interface Showcase Window (Interactive Perspective Mockup) */}
        <div className="relative mt-12 sm:mt-16">
          {/* Neon Ring Halo Behind Showcase */}
          <div className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-r from-accent/30 via-purple-600/20 to-cyan-500/20 blur-2xl opacity-75" />

          {/* Browser Chrome Window Container */}
          <div className="relative rounded-3xl border border-white/[0.15] bg-[#0c0e17]/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-3xl overflow-hidden ring-1 ring-white/10">
            {/* Top Chrome Window Toolbar */}
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#090b12] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="ml-3 hidden sm:inline-block text-xs font-mono text-faint">
                  kaze.app/sanctuary
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-muted">
                <span className="h-2 w-2 rounded-full bg-accent-strong animate-pulse" />
                <span>Interactive Live Demo · Try clicking below!</span>
              </div>
            </div>

            {/* Inner Dashboard Preview Grid */}
            <div className="p-4 sm:p-6 lg:p-8 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              {/* Left Live Card: Interactive Continue Watching Stepper */}
              <div className="relative rounded-2xl border border-white/[0.1] bg-surface/90 p-5 shadow-xl backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-strong uppercase tracking-wider">
                    <FlameIcon className="h-3.5 w-3.5 text-rose-400" />
                    <span>Continue Watching Centerpiece</span>
                  </div>
                  <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
                    ONA · Trigger
                  </span>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-md">
                    <Image
                      src="/posters/120377.jpg"
                      alt="Cyberpunk: Edgerunners"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 text-[10px] font-bold text-amber-400">
                      <StarIcon className="h-2.5 w-2.5 fill-amber-400" /> 8.8
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h3 className="truncate font-display text-base sm:text-lg font-bold text-white">
                        Cyberpunk: Edgerunners
                      </h3>
                      <p className="text-xs text-muted">
                        Up next: Episode {demoEp < totalDemoEps ? demoEp + 1 : demoEp} of {totalDemoEps}
                      </p>
                    </div>

                    {/* Dynamic Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-fg">
                          {demoEp} / {totalDemoEps} eps watched
                        </span>
                        <span className="font-mono font-bold text-accent-strong">
                          {demoPct}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 shadow-[0_0_12px_rgba(167,139,250,0.8)] transition-all duration-300 ease-out"
                          style={{ width: `${demoPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stepper Button */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleStepDemo}
                        disabled={demoEp >= totalDemoEps}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-accent-contrast shadow-md transition-all active:scale-95",
                          demoEp < totalDemoEps
                            ? "bg-accent hover:bg-accent-hover shadow-accent/30"
                            : "bg-surface-3 text-faint cursor-not-allowed",
                        )}
                      >
                        <PlusIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>
                          {demoEp < totalDemoEps
                            ? `Mark Episode ${demoEp + 1} Watched`
                            : "Completed Series!"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetDemo}
                        title="Reset demo progress"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-surface-2 text-faint hover:text-white transition-colors"
                      >
                        <RefreshIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Airing Radar & Telemetry Snapshot */}
              <div className="space-y-3">
                {/* Airing Today Radar Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-surface/75 p-3.5 shadow-md backdrop-blur-md">
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 radar-live-dot" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Tokyo Broadcast Radar
                      </span>
                    </div>
                    <span className="text-[11px] text-faint">Auto-synced</span>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between rounded-lg bg-surface-2/60 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-white truncate max-w-[170px]">
                        Chainsaw Man: Reze-hen
                      </span>
                      <span className="font-mono text-accent-strong font-bold text-[11px]">
                        In 2h 15m
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-surface-2/60 px-2.5 py-1.5 text-xs">
                      <span className="font-semibold text-white truncate max-w-[170px]">
                        Sousou no Frieren S2
                      </span>
                      <span className="font-mono text-emerald-400 font-bold text-[11px]">
                        In 5h 40m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vault Telemetry DNA Card */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-white/[0.08] bg-surface/75 p-3 text-center">
                    <p className="text-[10px] uppercase font-bold text-faint">
                      Vault Episodes
                    </p>
                    <p className="font-mono text-base font-extrabold text-white">
                      1,017
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-surface/75 p-3 text-center">
                    <p className="text-[10px] uppercase font-bold text-faint">
                      Total Time
                    </p>
                    <p className="font-mono text-base font-extrabold text-emerald-400">
                      384 Hours
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

