import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About & credits",
  description:
    "How Kaze uses AniList and TMDB metadata, including attribution requirements.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-strong">
          About Kaze
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          Sources &amp; credits
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Kaze keeps your watch history private. Public catalogue metadata is
          fetched from separate providers for each medium.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface/70 p-5">
        <h2 className="font-display text-base font-semibold text-fg">
          Anime &amp; manga
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Anime and manga metadata, artwork and airing schedules come from
          AniList, with Kitsu used as a secondary artwork and metadata fallback
          where available.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border-subtle bg-surface/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-fg">
            Movies &amp; TV
          </h2>
          <span className="rounded-md bg-[#01b4e4] px-2 py-1 text-[11px] font-black tracking-tight text-[#032541]">
            TMDB
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Film and television metadata, posters, backdrops, ratings and season
          information come from The Movie Database. Kaze uses TMDB ids as the
          external identity for these titles and never merges them with anime
          or manga records.
        </p>
        <p className="rounded-xl border border-border-subtle bg-surface-2/60 p-3 text-xs leading-relaxed text-muted">
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
        <div className="flex items-center gap-3">
          <Image
            src="/tmdb-logo.svg"
            alt="TMDB"
            width={120}
            height={18}
            unoptimized
          />
          <Link
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-accent-strong hover:underline"
          >
            themoviedb.org
          </Link>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl border border-border-subtle bg-surface/70 p-5">
        <h2 className="font-display text-base font-semibold text-fg">
          Your data
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Status, ratings, notes and watched-episode history are stored in your
          own Supabase account and protected by row level security. Progress is
          never sent to TMDB.
        </p>
      </section>

      <Link
        href="/library"
        className="inline-flex text-sm font-medium text-accent-strong hover:underline"
      >
        Back to your library
      </Link>
    </div>
  );
}
