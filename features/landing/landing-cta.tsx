import Image from "next/image";
import Link from "next/link";

import { CheckIcon, SparklesIcon } from "@/components/icons";
import type { Viewer } from "@/types/viewer";

export function LandingCta({ viewer }: { viewer: Viewer | null }) {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Glow Ring Behind Card */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[750px] rounded-full bg-accent/20 blur-[150px]" />

        <div className="relative overflow-hidden rounded-3xl border border-white/[0.15] bg-[#0c0e18]/95 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
          {/* Subtle Ambient Background Poster Art */}
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <Image
              src="/posters/120377.jpg"
              alt="Cyberpunk Backdrop"
              fill
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e18] via-[#0c0e18]/85 to-[#0c0e18]/60" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#0c0e18]" />
          </div>

          <div className="relative z-10 mx-auto max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 backdrop-blur-md">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>Begin Your Anime Sanctuary</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Ready to experience anime{" "}
              <span className="bg-gradient-to-r from-purple-200 via-white to-accent-strong bg-clip-text text-transparent">
                the way it was meant to be?
              </span>
            </h2>

            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Join anime purists tracking their watchlist in pure cinema.
              One tap per episode. Real-time broadcast countdowns from Tokyo.
              Zero ads, zero data tracking.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {viewer ? (
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-contrast shadow-xl shadow-accent/30 hover:bg-accent-hover hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <span>Open Your Sanctuary Dashboard</span>
                  <span>→</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-4 text-sm font-bold text-accent-contrast shadow-xl shadow-accent/30 hover:bg-accent-hover hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>Create Your Free Vault</span>
                  <span>→</span>
                </Link>
              )}

              <Link
                href="/discover"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface/80 px-6 py-4 text-sm font-bold text-fg backdrop-blur-xl hover:bg-surface-2 transition-all active:scale-95"
              >
                <span>Browse Without Account</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-muted/80 pt-2">
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                Completely Free
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                No Credit Card Required
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                Private PostgreSQL Vault
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

