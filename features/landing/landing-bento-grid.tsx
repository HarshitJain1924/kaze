"use client";

import { useState } from "react";

import {
  ChartIcon,
  ClockIcon,
  LockIcon,
  PlusIcon,
  ZapIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export function LandingBentoGrid() {
  const [bentoEp, setBentoEp] = useState(7);
  const totalEps = 12;
  const pct = Math.round((bentoEp / totalEps) * 100);

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent-strong backdrop-blur-md">
            <ZapIcon className="h-3.5 w-3.5" />
            <span>Architecture &amp; Features</span>
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight">
            Designed around artwork and motion,{" "}
            <span className="text-accent-strong">never clutter.</span>
          </h2>
          <p className="text-base sm:text-lg text-muted">
            Every screen, stepper, and countdown is engineered for speed, privacy, and aesthetic purity.
          </p>
        </div>

        {/* 4 Pillars Bento Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: 1-Tap Progress Engine (Spans 2 columns on large screens) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-white/[0.1] bg-surface/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/20">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-[100px]" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/40 bg-accent-soft text-accent-strong shadow-lg shadow-accent/20">
                  <ZapIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    The 1-Tap Progress Engine
                  </h3>
                  <p className="text-xs text-muted">
                    No multi-click modals. No page reloads. Instant optimistic updates.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Optimistic Cloud Sync
              </span>
            </div>

            {/* Interactive Demo Component */}
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0c0e17] p-5 shadow-inner">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span className="font-display text-base font-bold text-white">
                      Solo Leveling: Arise
                    </span>
                    <span className="text-xs text-faint">· Ep {bentoEp} of {totalEps}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-48 sm:w-64 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-purple-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-accent-strong">
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBentoEp((prev) => Math.min(prev + 1, totalEps))}
                    disabled={bentoEp >= totalEps}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-contrast shadow-md hover:bg-accent-hover transition-all active:scale-95 disabled:opacity-50"
                  >
                    <PlusIcon className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>
                      {bentoEp < totalEps
                        ? `Mark Ep ${bentoEp + 1} Watched`
                        : "Completed!"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBentoEp(7)}
                    className="rounded-xl border border-white/10 bg-surface-2 px-3 py-2 text-xs font-semibold text-muted hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted leading-relaxed">
              Updating your watchlist should never feel like doing data entry. Kaze uses optimistic UI state:
              tap once, your progress bar fills immediately, and changes sync securely to Supabase in the background.
            </p>
          </div>

          {/* Card 2: Tokyo Airing Radar */}
          <div id="radar" className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-surface/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/20">
            <div className="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-emerald-500/15 blur-[80px]" />

            <div className="flex items-center gap-3.5 pb-5 border-b border-white/[0.08]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ClockIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Tokyo Airing Radar
                </h3>
                <p className="text-xs text-muted">Real-time simulcast countdowns</p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {[
                { title: "Sousou no Frieren S2", ep: "Ep 18", time: "In 5h 40m", net: "NTV" },
                { title: "Chainsaw Man: Reze-hen", ep: "Ep 4", time: "In 2h 15m", net: "Tokyo MX" },
                { title: "The Apothecary Diaries S2", ep: "Ep 12", time: "In 9h 10m", net: "BS NTV" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0c0e17] p-2.5"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-bold text-white">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-faint">{item.ep} · {item.net}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-accent-strong rounded-lg bg-surface-2 px-2 py-1">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs text-muted leading-relaxed">
              Never miss an episode broadcast. Kaze auto-detects your browser&apos;s local timezone and calculates live countdowns to the exact minute.
            </p>
          </div>

          {/* Card 3: Taste DNA Telemetry */}
          <div id="dna" className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-surface/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/20">
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-cyan-500/15 blur-[80px]" />

            <div className="flex items-center gap-3.5 pb-5 border-b border-white/[0.08]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                <ChartIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white">
                  Taste DNA Telemetry
                </h3>
                <p className="text-xs text-muted">Deep viewing analytics</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { genre: "Action", pct: 83, bar: "bg-rose-500" },
                { genre: "Adventure", pct: 74, bar: "bg-amber-400" },
                { genre: "Fantasy", pct: 57, bar: "bg-purple-500" },
                { genre: "Sci-Fi", pct: 45, bar: "bg-cyan-400" },
              ].map((g) => (
                <div key={g.genre} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-white">{g.genre}</span>
                    <span className="text-muted font-mono">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", g.bar)}
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs text-muted leading-relaxed">
              Understand your anime palate with comprehensive radar metrics: total hours logged, genre affinity rankings, and completion velocity.
            </p>
          </div>

          {/* Card 4: Private Vault (Spans 2 columns on large screens) */}
          <div className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-white/[0.1] bg-surface/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/20">
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-purple-600/20 blur-[100px]" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-500/40 bg-purple-500/10 text-purple-300">
                  <LockIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Private &amp; Protected Vault
                  </h3>
                  <p className="text-xs text-muted">
                    Your personal library belongs to you. Zero tracking pixels.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
                Supabase Row-Level Security
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0c0e17] p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-faint">Data Privacy</p>
                <p className="mt-1 font-display text-sm font-bold text-white">Zero Tracking Pixels</p>
                <p className="mt-1 text-[11px] text-muted">No Google Analytics or Facebook SDKs</p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#0c0e17] p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-faint">Encryption</p>
                <p className="mt-1 font-display text-sm font-bold text-emerald-400">PostgreSQL RLS</p>
                <p className="mt-1 text-[11px] text-muted">Only your authenticated session can read</p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#0c0e17] p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-faint">Data Sovereignty</p>
                <p className="mt-1 font-display text-sm font-bold text-cyan-400">1-Click Export</p>
                <p className="mt-1 text-[11px] text-muted">Download complete JSON &amp; CSV snapshots</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted leading-relaxed">
              Unlike commercial tracking portals that monetize your viewing data to advertisers,
              Kaze operates under zero-tracking principles. You can download and backup your entire history anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

