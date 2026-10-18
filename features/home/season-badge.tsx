import { seasonLabel } from "@/lib/season";
import type { AnimeSeason } from "@/types/anime";

export function WeatherBadge({
  season,
  year,
}: {
  season: AnimeSeason;
  year: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-strong">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-accent-strong"
      />
      {seasonLabel(season)} {year} season
    </span>
  );
}
