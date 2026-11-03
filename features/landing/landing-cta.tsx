import Link from "next/link";

import { CompassIcon } from "@/components/icons";
import type { Viewer } from "@/types/viewer";

export function LandingCta({ viewer }: { viewer: Viewer | null }) {
  return (
    <section
      id="begin"
      className="scroll-mt-24 border-b border-[color:var(--landing-rule)]"
    >
      <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="landing-mono text-[9px] text-[var(--landing-accent)]">
              05 / Begin
            </p>
            <h2 className="landing-serif mt-4 max-w-[11ch] text-[clamp(3.2rem,7vw,7rem)] leading-[0.86] text-[var(--landing-ink)]">
              Make room for the next one.
            </h2>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <p className="max-w-[26rem] text-[15px] leading-7 text-[var(--landing-muted)]">
              Start with a single title. Kaze will keep the thread as the list
              grows.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {viewer ? (
                <Link
                  href="/dashboard"
                  className="landing-accent-bg inline-flex h-11 items-center justify-center gap-3 px-5 text-[12px] font-semibold transition-opacity hover:opacity-85"
                >
                  Open your dashboard
                  <span aria-hidden="true">↗</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="landing-accent-bg inline-flex h-11 items-center justify-center gap-3 px-5 text-[12px] font-semibold transition-opacity hover:opacity-85"
                >
                  Create your index
                  <span aria-hidden="true">↗</span>
                </Link>
              )}

              <Link
                href="/discover"
                className="inline-flex h-11 items-center justify-center gap-2.5 border border-[color:var(--landing-rule)] px-5 text-[12px] font-medium text-[var(--landing-ink)] transition-colors hover:border-[var(--landing-accent)]"
              >
                <CompassIcon className="h-3.5 w-3.5 text-[var(--landing-accent)]" />
                Browse without an account
              </Link>
            </div>

            <p className="landing-mono mt-5 text-[8px] leading-4 text-[var(--landing-faint)]">
              Free to start · No ads · Private by default
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
