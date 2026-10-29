import Link from "next/link";

import { Logo } from "@/components/logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#040508] py-14 sm:py-20 text-muted">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/[0.06]">
          {/* Brand Column */}
          <div className="md:col-span-1 space-y-4">
            <Logo />
            <p className="text-xs leading-relaxed text-muted/80">
              A quieter, cinematic anime sanctuary designed around artwork, 1-tap progress, and zero tracking.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 radar-live-dot" />
              <span>AniList GraphQL Live</span>
            </div>
          </div>

          {/* Navigation Column 1 */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-white font-bold">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  1-Tap Progress Stepper
                </a>
              </li>
              <li>
                <a href="#radar" className="hover:text-white transition-colors">
                  Tokyo Simulcast Radar
                </a>
              </li>
              <li>
                <a href="#dna" className="hover:text-white transition-colors">
                  Taste DNA Telemetry
                </a>
              </li>
              <li>
                <a href="#compare" className="hover:text-white transition-colors">
                  Why Kaze
                </a>
              </li>
            </ul>
          </div>

          {/* Navigation Column 2 */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-white font-bold">
              Catalogue
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  Trending Releases
                </Link>
              </li>
              <li>
                <Link href="/schedule" className="hover:text-white transition-colors">
                  Airing Schedule Calendar
                </Link>
              </li>
              <li>
                <Link href="/discover?sort=POPULARITY_DESC" className="hover:text-white transition-colors">
                  All-Time Top Anime
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Sign In to Sanctuary
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture Column */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-white font-bold">
              Architecture &amp; Trust
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
                <span>Next.js 16 (Turbopack)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>PostgreSQL Row-Level Security</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span>Zero Commercial Ad Tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span>1-Click JSON/CSV Data Portability</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Credits & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-faint">
          <p>© {new Date().getFullYear()} Kaze Anime Sanctuary. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Anime metadata powered by AniList GraphQL</span>
            <span>·</span>
            <span>Secured with Supabase</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

