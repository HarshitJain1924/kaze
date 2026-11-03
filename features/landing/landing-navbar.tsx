"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CloseIcon, ListIcon } from "@/components/icons";
import type { Viewer } from "@/types/viewer";

import { LandingAppearanceControl } from "./landing-appearance-control";

export function LandingNavbar({ viewer }: { viewer: Viewer | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    mobilePanelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--landing-rule)] bg-[var(--landing-paper)]">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          aria-label="Kaze home"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 bg-[var(--landing-accent)] transition-transform duration-300 group-hover:rotate-45"
          />
          <span className="landing-display text-[24px] font-semibold leading-none tracking-[-0.045em] text-[var(--landing-ink)]">
            Kaze
          </span>
          <span className="landing-mono hidden text-[9px] text-[var(--landing-faint)] sm:inline">
            Index
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          <a
            href="#season"
            className="text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            The season
          </a>
          <a
            href="#formats"
            className="text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Formats
          </a>
          <a
            href="#shelf"
            className="text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            The shelf
          </a>
          <Link
            href="/discover"
            className="text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Catalogue
          </Link>
          <Link
            href="/schedule"
            className="text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
          >
            Schedule
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <LandingAppearanceControl className="hidden md:inline-flex" />

          {viewer ? (
            <Link
              href="/dashboard"
              className="landing-accent-bg inline-flex h-9 items-center gap-2 px-3.5 text-[11px] font-semibold tracking-[0.02em] transition-opacity hover:opacity-85"
            >
              <span>Dashboard</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-[12px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)] sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="landing-accent-bg inline-flex h-9 items-center gap-2 px-3.5 text-[11px] font-semibold tracking-[0.02em] transition-opacity hover:opacity-85"
              >
                <span>
                  Start
                  <span className="hidden sm:inline"> your index</span>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            </>
          )}

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center border border-[color:var(--landing-rule)] text-[var(--landing-muted)] transition-colors hover:border-[var(--landing-accent)] hover:text-[var(--landing-ink)] lg:hidden"
          >
            {mobileMenuOpen ? (
              <CloseIcon className="h-4 w-4" />
            ) : (
              <ListIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          ref={mobilePanelRef}
          id="landing-mobile-menu"
          className="border-t border-[color:var(--landing-rule)] bg-[var(--landing-paper)] px-5 pb-6 pt-3 sm:px-8 lg:hidden"
        >
          <nav aria-label="Mobile" className="mx-auto grid max-w-[1440px]">
            {[
              { href: "#season", label: "The season" },
              { href: "#formats", label: "Formats" },
              { href: "#shelf", label: "The shelf" },
              { href: "/discover", label: "Catalogue" },
              { href: "/schedule", label: "Schedule" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="border-b border-[color:var(--landing-rule)] py-3.5 text-[15px] font-medium text-[var(--landing-ink)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mx-auto mt-4 flex max-w-[1440px] items-center justify-between border-t border-[color:var(--landing-rule)] pt-4">
            <span className="landing-mono text-[8px] text-[var(--landing-faint)]">
              Appearance
            </span>
            <LandingAppearanceControl />
          </div>

          <div className="mx-auto mt-4 flex max-w-[1440px] flex-col gap-2">
            {viewer ? (
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="landing-accent-bg flex h-10 items-center justify-center text-[12px] font-semibold"
              >
                Open your dashboard ↗
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="flex h-10 items-center justify-center border border-[color:var(--landing-rule)] text-[12px] font-medium text-[var(--landing-ink)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="landing-accent-bg flex h-10 items-center justify-center text-[12px] font-semibold"
                >
                  Start your index ↗
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
