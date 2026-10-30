"use client";

import Link from "next/link";
import { useState } from "react";

import { CloseIcon, ListIcon, SparklesIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import type { Viewer } from "@/types/viewer";

export function LandingNavbar({ viewer }: { viewer: Viewer | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="relative flex items-center justify-between gap-3 rounded-full border border-white/[0.12] bg-[#07080e]/80 px-4 py-2.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5 transition-all">
        {/* Brand Logo (Logo already renders its own home link) */}
        <Logo className="select-none" />

        {/* Center Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs font-semibold text-muted">
          <a
            href="#features"
            className="rounded-full px-3 py-1 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Features
          </a>
          <a
            href="#radar"
            className="rounded-full px-3 py-1 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Airing Radar
          </a>
          <a
            href="#dna"
            className="rounded-full px-3 py-1 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Taste DNA
          </a>
          <a
            href="#compare"
            className="rounded-full px-3 py-1 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Why Kaze
          </a>
          <Link
            href="/discover"
            className="rounded-full px-3 py-1 text-accent-strong hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Catalogue
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Live AniList Pipeline Indicator */}
          <div className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
            <span>AniList GraphQL Live</span>
          </div>

          {viewer ? (
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-contrast shadow-lg shadow-accent/25 hover:bg-accent-hover transition-all active:scale-95 sm:px-4"
            >
              <span>Dashboard</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/login"
                className="hidden lg:inline-flex whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-contrast shadow-lg shadow-accent/25 hover:bg-accent-hover transition-all active:scale-95 sm:px-4"
              >
                <SparklesIcon className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="sm:hidden">Start</span>
                  <span className="hidden sm:inline">Enter Sanctuary</span>
                </span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-muted hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <CloseIcon className="h-4 w-4" />
            ) : (
              <ListIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#07080e]/95 p-4 shadow-2xl backdrop-blur-2xl lg:hidden animate-fade">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-white"
          >
            Features
          </a>
          <a
            href="#radar"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-white"
          >
            Airing Radar
          </a>
          <a
            href="#dna"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-white"
          >
            Taste DNA Telemetry
          </a>
          <a
            href="#compare"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-white"
          >
            Why Kaze
          </a>
          <Link
            href="/discover"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-accent-strong hover:bg-white/[0.05] hover:text-white"
          >
            Explore Discover Catalogue →
          </Link>

          <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
            {viewer ? (
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-xl bg-accent py-2 text-xs font-bold text-accent-contrast shadow-md"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-surface-2 py-2 text-xs font-semibold text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-xl bg-accent py-2 text-xs font-bold text-accent-contrast shadow-md"
                >
                  Create Vault Free →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

