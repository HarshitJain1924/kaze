import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { IntroShowcase } from "@/features/auth/intro-showcase";
import { LoginForm } from "@/features/auth/login-form";
import { MiniPosterMarquee } from "@/features/auth/poster-marquee-wall";
import { getViewer } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sanctuary · Kaze Anime Platform",
  description: "Enter your personal anime sanctuary with one-tap progress tracking.",
};

export const dynamic = "force-dynamic";

function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  return "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  const nextPath = safeNext(params.next);

  if (viewer) {
    redirect(nextPath);
  }

  const errorParam = Array.isArray(params.error)
    ? params.error[0]
    : params.error;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr] bg-bg">
      {/* Left Column: Interactive Cinematic Anime Showcase Deck */}
      <div className="hidden lg:block">
        <IntroShowcase />
      </div>

      {/* Right Column: Authentication Card & Fluid Form */}
      <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-5 py-6 sm:px-8 lg:px-12 bg-bg">
        {/* Atmospheric Ambient Glows */}
        <div className="pointer-events-none absolute -top-32 right-0 h-96 w-96 rounded-full bg-accent/15 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-purple-500/10 blur-[120px]" />

        {/* Mobile Header: Visible only on < lg screens */}
        <div className="relative z-10 lg:hidden flex flex-col gap-4 pt-2 pb-4">
          <div className="flex items-center justify-between">
            <Logo />
            <Link
              href="/discover"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong hover:text-white transition-colors"
            >
              <span>Explore Discover</span>
              <span>→</span>
            </Link>
          </div>

          {/* Mobile Art Accent Card with Auto-scrolling Posters */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-surface/80 p-5 shadow-lg backdrop-blur-xl">
            <MiniPosterMarquee />
            <div className="relative z-10 space-y-1.5">
              <h2 className="font-display text-lg font-bold text-white">
                Your anime journey, elevated to cinema.
              </h2>
              <p className="text-xs text-muted">
                1-tap episode progress, live simulcast countdowns, and private taste telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="relative z-10 my-auto flex w-full items-center justify-center py-4">
          <LoginForm
            configured={getSupabaseConfig() !== null}
            nextPath={nextPath}
            linkError={errorParam}
          />
        </div>

        {/* Footer Security Footnote */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-faint">
          <span>Private vault protected by Row-Level Security (RLS)</span>
          <span>Zero tracking · Edge-cached AniList metadata</span>
        </div>
      </div>
    </div>
  );
}