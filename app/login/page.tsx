import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChevronRightIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { IntroShowcase } from "@/features/auth/intro-showcase";
import { LoginForm } from "@/features/auth/login-form";
import { MiniPosterMarquee } from "@/features/auth/poster-marquee-wall";
import { getViewer } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sanctuary · Kaze Anime Platform",
  description:
    "Enter your personal anime sanctuary with verified one-tap progress tracking.",
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
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1.15fr_1fr]">
      {/* Left Column: Interactive Cinematic Anime Showcase Deck */}
      <div className="hidden lg:block">
        <IntroShowcase />
      </div>

      {/* Right Column: Authentication Card & Fluid Form */}
      <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-bg px-5 py-6 sm:px-8 lg:px-12">
        {/* Mobile Header: Visible only on < lg screens */}
        <div className="relative z-10 flex flex-col gap-4 pb-4 pt-2 lg:hidden">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <Logo />
            <Link
              href="/discover"
              className="inline-flex items-center gap-1 border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-strong transition-colors hover:border-accent hover:text-fg"
            >
              <span>Explore Discover</span>
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {/* Mobile Art Accent Card with Auto-scrolling Posters */}
          <div className="relative overflow-hidden border border-border bg-surface/80 p-4 sm:p-5 backdrop-blur-xl">
            <MiniPosterMarquee />
            <div className="relative z-10 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-accent" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
                  Personal Archive
                </span>
              </div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-fg">
                Your anime journey, elevated to cinema.
              </h2>
              <p className="text-xs text-muted">
                One-tap episode progress, live simulcast countdowns, and private taste telemetry.
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
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          <span>Private vault protected by Row-Level Security (RLS)</span>
          <span>Zero tracking · Edge-cached AniList metadata</span>
        </div>
      </div>
    </div>
  );
}
