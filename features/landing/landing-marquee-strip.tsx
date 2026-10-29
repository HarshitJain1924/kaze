import Image from "next/image";

interface PosterItem {
  id: number;
  title: string;
  src: string;
}

const TRACK_1: PosterItem[] = [
  { id: 120377, title: "Cyberpunk: Edgerunners", src: "/posters/120377.jpg" },
  { id: 16498, title: "Attack on Titan", src: "/posters/16498.jpg" },
  { id: 113415, title: "JUJUTSU KAISEN", src: "/posters/113415.jpg" },
  { id: 154587, title: "Frieren: Beyond Journey's End", src: "/posters/154587.jpg" },
  { id: 1535, title: "Death Note", src: "/posters/1535.jpg" },
  { id: 21, title: "ONE PIECE", src: "/posters/21.jpg" },
  { id: 101348, title: "Vinland Saga", src: "/posters/101348.jpg" },
  { id: 130003, title: "BOCCHI THE ROCK!", src: "/posters/130003.jpg" },
];

const TRACK_2: PosterItem[] = [
  { id: 101922, title: "Demon Slayer", src: "/posters/101922.jpg" },
  { id: 5114, title: "Fullmetal Alchemist", src: "/posters/5114.jpg" },
  { id: 151807, title: "Solo Leveling", src: "/posters/151807.jpg" },
  { id: 9253, title: "Steins;Gate", src: "/posters/9253.jpg" },
  { id: 1, title: "Cowboy Bebop", src: "/posters/1.jpg" },
  { id: 150672, title: "OSHI NO KO", src: "/posters/150672.jpg" },
  { id: 30, title: "Neon Genesis Evangelion", src: "/posters/30.jpg" },
  { id: 140960, title: "SPY x FAMILY", src: "/posters/140960.jpg" },
];

function StripRow({
  posters,
  direction,
  duration,
}: {
  posters: PosterItem[];
  direction: "left" | "right";
  duration: string;
}) {
  const loop = [...posters, ...posters];
  return (
    <div
      className={
        direction === "left" ? "animate-marquee-left" : "animate-marquee-right"
      }
      style={
        {
          "--marquee-duration": duration,
          animationDuration: duration,
          animationIterationCount: "infinite",
        } as React.CSSProperties
      }
    >
      <div className="flex gap-4 pr-4">
        {loop.map((p, idx) => (
          <div
            key={`${p.id}-${idx}`}
            className="group relative h-48 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-surface-2 shadow-2xl transition-all duration-300 hover:scale-105 hover:border-white/30 sm:h-56 sm:w-36"
          >
            <Image
              src={p.src}
              alt={p.title}
              fill
              sizes="(max-width: 640px) 128px, 144px"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />
            <div className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white drop-shadow truncate opacity-0 group-hover:opacity-100 transition-opacity">
              {p.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingMarqueeStrip() {
  return (
    <section className="relative overflow-hidden py-12 border-y border-white/[0.08] bg-[#05060a]">
      {/* Background Japanese Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[320px] font-black leading-none text-white/[0.02] select-none"
        style={{ fontFamily: "serif" }}
      >
        風
      </div>

      {/* Header Banner Label */}
      <div className="relative z-10 mb-8 flex flex-col items-center justify-center text-center px-4">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-accent-strong font-bold">
          LIVE DIRECT FROM TOKYO BROADCASTS
        </span>
        <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-white">
          Over 10,000+ Series, Films &amp; OVAs Indexed
        </h2>
      </div>

      {/* Dual Track Marquee */}
      <div className="relative space-y-4">
        <StripRow posters={TRACK_1} direction="left" duration="28s" />
        <StripRow posters={TRACK_2} direction="right" duration="34s" />

        {/* Left & Right Fade Masks for Seamless Visual Horizon */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 sm:w-48 bg-gradient-to-r from-[#05060a] via-[#05060a]/80 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 sm:w-48 bg-gradient-to-l from-[#05060a] via-[#05060a]/80 to-transparent z-10" />
      </div>
    </section>
  );
}

