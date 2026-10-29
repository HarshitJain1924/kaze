import Image from "next/image";

interface Poster {
  id: number;
  title: string;
  src: string;
}

const ROW_1: Poster[] = [
  { id: 120377, title: "Cyberpunk: Edgerunners", src: "/posters/120377.jpg" },
  { id: 16498, title: "Attack on Titan", src: "/posters/16498.jpg" },
  { id: 113415, title: "JUJUTSU KAISEN", src: "/posters/113415.jpg" },
  { id: 154587, title: "Frieren: Beyond Journey's End", src: "/posters/154587.jpg" },
  { id: 1535, title: "Death Note", src: "/posters/1535.jpg" },
  { id: 21, title: "ONE PIECE", src: "/posters/21.jpg" },
  { id: 101348, title: "Vinland Saga", src: "/posters/101348.jpg" },
  { id: 130003, title: "BOCCHI THE ROCK!", src: "/posters/130003.jpg" },
  { id: 9253, title: "Steins;Gate", src: "/posters/9253.jpg" },
];

const ROW_2: Poster[] = [
  { id: 101922, title: "Demon Slayer: Kimetsu no Yaiba", src: "/posters/101922.jpg" },
  { id: 5114, title: "Fullmetal Alchemist: Brotherhood", src: "/posters/5114.jpg" },
  { id: 151807, title: "Solo Leveling", src: "/posters/151807.jpg" },
  { id: 1, title: "Cowboy Bebop", src: "/posters/1.jpg" },
  { id: 150672, title: "OSHI NO KO", src: "/posters/150672.jpg" },
  { id: 30, title: "Neon Genesis Evangelion", src: "/posters/30.jpg" },
  { id: 140960, title: "SPY x FAMILY", src: "/posters/140960.jpg" },
  { id: 11061, title: "Hunter x Hunter (2011)", src: "/posters/11061.jpg" },
  { id: 114745, title: "Made in Abyss", src: "/posters/114745.jpg" },
];

const ROW_3: Poster[] = [
  { id: 199, title: "Spirited Away", src: "/posters/199.jpg" },
  { id: 21459, title: "My Hero Academia", src: "/posters/21459.jpg" },
  { id: 114446, title: "Higurashi: When They Cry - GOU", src: "/posters/114446.jpg" },
  { id: 120377, title: "Cyberpunk: Edgerunners", src: "/posters/120377.jpg" },
  { id: 113415, title: "JUJUTSU KAISEN", src: "/posters/113415.jpg" },
  { id: 154587, title: "Frieren: Beyond Journey's End", src: "/posters/154587.jpg" },
  { id: 151807, title: "Solo Leveling", src: "/posters/151807.jpg" },
  { id: 1535, title: "Death Note", src: "/posters/1535.jpg" },
  { id: 21, title: "ONE PIECE", src: "/posters/21.jpg" },
];

const ROW_4: Poster[] = [
  { id: 9253, title: "Steins;Gate", src: "/posters/9253.jpg" },
  { id: 16498, title: "Attack on Titan", src: "/posters/16498.jpg" },
  { id: 101922, title: "Demon Slayer: Kimetsu no Yaiba", src: "/posters/101922.jpg" },
  { id: 130003, title: "BOCCHI THE ROCK!", src: "/posters/130003.jpg" },
  { id: 101348, title: "Vinland Saga", src: "/posters/101348.jpg" },
  { id: 5114, title: "Fullmetal Alchemist: Brotherhood", src: "/posters/5114.jpg" },
  { id: 1, title: "Cowboy Bebop", src: "/posters/1.jpg" },
  { id: 140960, title: "SPY x FAMILY", src: "/posters/140960.jpg" },
  { id: 11061, title: "Hunter x Hunter (2011)", src: "/posters/11061.jpg" },
];

function PosterTrack({
  posters,
  direction,
  duration,
}: {
  posters: Poster[];
  direction: "left" | "right";
  duration: string;
}) {
  // Duplicating the array guarantees seamless infinite 0% -> -50% looping
  const loopPosters = [...posters, ...posters];

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
        {loopPosters.map((poster, index) => (
          <div
            key={`${poster.id}-${index}`}
            className="group relative h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-2 shadow-xl transition-transform duration-300 sm:h-48 sm:w-32"
          >
            <Image
              src={poster.src}
              alt={poster.title}
              fill
              sizes="(max-width: 640px) 112px, 128px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={index < 4}
            />
            {/* Subtle gloss overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PosterMarqueeWall() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none bg-[#07080e]"
    >
      {/* Dynamic angled multi-row poster canvas */}
      <div className="absolute -inset-x-28 -inset-y-24 flex flex-col justify-center gap-4 -rotate-3 scale-110 opacity-35 sm:opacity-40">
        <PosterTrack posters={ROW_1} direction="left" duration="28s" />
        <PosterTrack posters={ROW_2} direction="right" duration="36s" />
        <PosterTrack posters={ROW_3} direction="left" duration="24s" />
        <PosterTrack posters={ROW_4} direction="right" duration="32s" />
      </div>

      {/* Atmospheric Japanese Kanji Watermark: 風 (Kaze - Wind) */}
      <div
        className="pointer-events-none absolute -right-6 top-1/4 text-[280px] font-black leading-none text-white/[0.035] select-none blur-[1px]"
        style={{ fontFamily: "serif" }}
      >
        風
      </div>

      {/* Cinematic Multi-Stop Scrims: Guarantees maximum foreground legibility and contrast */}
      {/* 1. Deep background base scrim */}
      <div className="absolute inset-0 bg-[#07080e]/45" />

      {/* 2. Left-to-right gradient: dense on the left for text, opening slightly on the right to show moving artwork */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#07080e] via-[#07080e]/90 to-[#07080e]/50" />

      {/* 3. Top and bottom vertical fades */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#07080e] via-transparent to-[#07080e]/80" />

      {/* 4. Radial center vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,#07080e_85%)]" />

      {/* 5. Electric ambient color glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-accent/20 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-80 w-80 rounded-full bg-purple-600/15 blur-[120px]" />
    </div>
  );
}

export function MiniPosterMarquee() {
  const loopPosters = [...ROW_1, ...ROW_1];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none opacity-35"
    >
      <div
        className="animate-marquee-left"
        style={
          {
            "--marquee-duration": "24s",
            animationDuration: "24s",
            animationIterationCount: "infinite",
          } as React.CSSProperties
        }
      >
        <div className="flex gap-2 pr-2">
          {loopPosters.map((poster, index) => (
            <div
              key={`mini-${poster.id}-${index}`}
              className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10"
            >
              <Image
                src={poster.src}
                alt={poster.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-bg-soft via-bg-soft/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-soft via-transparent to-transparent" />
    </div>
  );
}

