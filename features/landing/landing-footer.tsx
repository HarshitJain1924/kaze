import Link from "next/link";

import type { Viewer } from "@/types/viewer";

export function LandingFooter({ viewer }: { viewer: Viewer | null }) {
  return (
    <footer className="bg-[var(--landing-paper)]">
      <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
        <div className="grid gap-10 border-b border-[color:var(--landing-rule)] pb-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link
              href="/"
              aria-label="Kaze home"
              className="flex items-center gap-2.5"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 bg-[var(--landing-accent)]"
              />
              <span className="landing-display text-[24px] font-semibold leading-none tracking-[-0.045em] text-[var(--landing-ink)]">
                Kaze
              </span>
            </Link>
            <p className="mt-4 max-w-[22rem] text-[12px] leading-5 text-[var(--landing-muted)]">
              A private index for the stories you keep. Anime, manga and manhwa
              without ads, noise, or someone else&apos;s algorithm.
            </p>
          </div>

          <nav aria-label="Explore" className="md:col-span-2">
            <h2 className="landing-mono text-[8px] text-[var(--landing-faint)]">
              Explore
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] text-[var(--landing-muted)]">
              <li>
                <a
                  href="#season"
                  className="transition-colors hover:text-[var(--landing-ink)]"
                >
                  The season
                </a>
              </li>
              <li>
                <a
                  href="#formats"
                  className="transition-colors hover:text-[var(--landing-ink)]"
                >
                  Formats
                </a>
              </li>
              <li>
                <a
                  href="#shelf"
                  className="transition-colors hover:text-[var(--landing-ink)]"
                >
                  The shelf
                </a>
              </li>
              <li>
                <Link
                  href="/discover"
                  className="transition-colors hover:text-[var(--landing-ink)]"
                >
                  Catalogue
                </Link>
              </li>
              <li>
                <Link
                  href="/schedule"
                  className="transition-colors hover:text-[var(--landing-ink)]"
                >
                  Schedule
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Account" className="md:col-span-2">
            <h2 className="landing-mono text-[8px] text-[var(--landing-faint)]">
              Account
            </h2>
            <ul className="mt-3 space-y-2.5 text-[12px] text-[var(--landing-muted)]">
              {viewer ? (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="transition-colors hover:text-[var(--landing-ink)]"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/library"
                      className="transition-colors hover:text-[var(--landing-ink)]"
                    >
                      My library
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings"
                      className="transition-colors hover:text-[var(--landing-ink)]"
                    >
                      Settings
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/login"
                      className="transition-colors hover:text-[var(--landing-ink)]"
                    >
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="transition-colors hover:text-[var(--landing-ink)]"
                    >
                      Create an account
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>

          <div className="md:col-span-3">
            <h2 className="landing-mono text-[8px] text-[var(--landing-faint)]">
              Source
            </h2>
            <p className="mt-3 text-[12px] leading-5 text-[var(--landing-muted)]">
              Artwork and catalogue metadata are provided by the{" "}
              <a
                href="https://anilist.co"
                target="_blank"
                rel="noreferrer"
                className="border-b border-[color:var(--landing-rule)] text-[var(--landing-ink)] transition-colors hover:border-[var(--landing-accent)]"
              >
                AniList
              </a>{" "}
              public catalogue.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-[10px] text-[var(--landing-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Kaze. All rights reserved.
          </p>
          <p className="landing-mono text-[8px]">Made for keeping.</p>
        </div>
      </div>
    </footer>
  );
}
