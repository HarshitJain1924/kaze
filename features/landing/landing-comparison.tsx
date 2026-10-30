import { CheckIcon, CloseIcon, SparklesIcon } from "@/components/icons";

interface CompareRow {
  feature: string;
  traditional: string;
  traditionalPass: boolean;
  kaze: string;
  kazePass: boolean;
}

const COMPARISON_ROWS: CompareRow[] = [
  {
    feature: "Advertising & Trackers",
    traditional: "Banner ads, popup redirects & 15+ third-party trackers",
    traditionalPass: false,
    kaze: "Zero ads forever. Zero commercial tracking pixels.",
    kazePass: true,
  },
  {
    feature: "Episode Progress Stepping",
    traditional: "5 clicks, modal popup, mandatory page refresh",
    traditionalPass: false,
    kaze: "1-tap optimistic stepper from home, schedule or library",
    kazePass: true,
  },
  {
    feature: "Tokyo Broadcast Airing Times",
    traditional: "Manual timezone mental math or buried forum threads",
    traditionalPass: false,
    kaze: "Live simulcast countdown radar auto-synced to local time",
    kazePass: true,
  },
  {
    feature: "Artwork & Visual Fidelity",
    traditional: "Tiny blurry thumbnails and cluttered tables",
    traditionalPass: false,
    kaze: "High-resolution 4K key visuals with dark obsidian theme",
    kazePass: true,
  },
  {
    feature: "Personal Data Ownership",
    traditional: "Locked into proprietary walled garden",
    traditionalPass: false,
    kaze: "Instant 1-click JSON & CSV exports anytime",
    kazePass: true,
  },
  {
    feature: "Database Security Architecture",
    traditional: "Publicly visible profiles without row-level access control",
    traditionalPass: false,
    kaze: "PostgreSQL Row-Level Security (RLS) private vault",
    kazePass: true,
  },
];

export function LandingComparison() {
  return (
    <section id="compare" className="relative py-20 sm:py-28 border-t border-white/[0.08] bg-[#05060b]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-300">
            <SparklesIcon className="h-3.5 w-3.5" />
            <span>The Purist Difference</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built for anime purists, not ad networks.
          </h2>
          <p className="text-sm sm:text-base text-muted">
            See how Kaze compares against legacy tracking databases.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-white/[0.1] bg-surface/70 shadow-2xl backdrop-blur-2xl">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.3fr] border-b border-white/[0.08] bg-[#0a0c14] p-4 text-xs font-bold uppercase tracking-wider text-muted">
            <div className="hidden md:block">Capability / Philosophy</div>
            <div className="text-rose-400">Traditional Trackers (MAL / Forums)</div>
            <div className="text-accent-strong">Kaze Anime Platform</div>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.3fr] gap-2 md:gap-4 p-4 text-sm transition-colors hover:bg-white/[0.02]"
              >
                <div className="font-semibold text-white md:py-1">
                  {row.feature}
                </div>

                <div className="flex items-start gap-2 text-xs sm:text-sm text-muted/80">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                    <CloseIcon className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                  <span>{row.traditional}</span>
                </div>

                <div className="flex items-start gap-2 text-xs sm:text-sm font-medium text-white">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-sm shadow-accent/40">
                    <CheckIcon className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                  <span>{row.kaze}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

