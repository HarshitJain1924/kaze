import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/features/auth/login-form";
import { getViewer } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your personal Kaze anime library.",
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
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border-subtle bg-bg-soft p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-[100px]"
        />

        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Personal anime tracker
          </p>
          <h2 className="mt-4 font-display text-[38px] font-bold leading-[1.1] tracking-tight text-fg">
            A quieter way to keep up with anime.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            One place for your watchlist, episode progress, ratings and private
            notes — designed around the artwork, not the clutter.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Search thousands of titles from AniList",
              "Update episode progress in one tap",
              "Rate, take notes and see your own statistics",
              "Private by default, synced across your devices",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-muted"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[10px] leading-relaxed text-faint">
          Anime metadata provided by AniList. Personal library data stored
          securely in Supabase.
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col bg-bg px-5 py-10 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <LoginForm
            configured={getSupabaseConfig() !== null}
            nextPath={nextPath}
            linkError={errorParam}
          />
        </div>
        <p className="text-center text-[10px] text-faint lg:hidden">
          Anime metadata by AniList · Library secured by Supabase
        </p>
      </div>
    </div>
  );
}
