import Image from "next/image";

import { isHttpUrl } from "@/lib/utils";
import type { TmdbCastMember, TmdbCrewMember } from "@/types/tmdb";

const KEY_CREW_JOBS = new Set([
  "Director",
  "Creator",
  "Screenplay",
  "Writer",
  "Story",
  "Producer",
  "Executive Producer",
  "Director of Photography",
  "Original Music Composer",
  "Editor",
]);

export function TmdbCreditsSection({
  cast,
  crew,
}: {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}) {
  if (cast.length === 0 && crew.length === 0) return null;

  const visibleCast = cast.slice(0, 16);
  const visibleCrew = crew
    .filter((member) => member.job && KEY_CREW_JOBS.has(member.job))
    .slice(0, 12);

  return (
    <section aria-labelledby="credits-heading" className="space-y-5">
      <div className="flex items-center gap-2">
        <h2
          id="credits-heading"
          className="font-display text-lg font-semibold text-fg"
        >
          Cast &amp; Crew
        </h2>
        <span className="border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          {cast.length + crew.length}
        </span>
      </div>

      {visibleCast.length > 0 ? (
        <div>
          <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Cast
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleCast.map((member) => (
              <div
                key={`${member.id}:${member.character ?? "cast"}`}
                className="flex min-w-0 items-center gap-2.5 border border-white/10 bg-[rgba(14,17,24,0.35)] p-2.5 transition-colors hover:border-white/20"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/5">
                  {member.profileUrl && isHttpUrl(member.profileUrl) ? (
                    <Image
                      src={member.profileUrl}
                      alt={member.name}
                      fill
                      unoptimized
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/45">
                      {member.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white" title={member.name}>
                    {member.name}
                  </p>
                  {member.character ? (
                    <p className="mt-0.5 truncate text-[11px] text-white/45" title={member.character}>
                      {member.character}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {visibleCrew.length > 0 ? (
        <div>
          <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Crew
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleCrew.map((member) => (
              <div
                key={`${member.id}:${member.job}`}
                className="flex items-center justify-between gap-3 border border-white/10 bg-[rgba(14,17,24,0.35)] px-3 py-2"
              >
                <span className="truncate text-xs font-medium text-white/85">
                  {member.name}
                </span>
                <span className="shrink-0 text-[11px] text-white/45">
                  {member.job}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
