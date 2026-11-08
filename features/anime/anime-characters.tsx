import Image from "next/image";
import { isHttpUrl } from "@/lib/utils";
import type { AnimeCharacter } from "@/types/anime";

interface AnimeCharactersProps {
  characters?: AnimeCharacter[];
}

export function AnimeCharacters({ characters = [] }: AnimeCharactersProps) {
  if (characters.length === 0) {
    return (
      <div className="optical-glass p-6 text-center text-sm text-white/70">
        No character or cast information is currently available for this title.
      </div>
    );
  }

  const mainCharacters = characters.filter((c) => c.role === "MAIN");
  const supportingCharacters = characters.filter((c) => c.role !== "MAIN");
  const sorted = [...mainCharacters, ...supportingCharacters];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-fg">
            Characters & Cast
          </h2>
          <span className="border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {characters.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((char) => {
          const charImage = char.image && isHttpUrl(char.image) ? char.image : null;
          const va = char.voiceActor;
          const vaImage = va?.image && isHttpUrl(va.image) ? va.image : null;
          const isMain = char.role === "MAIN";

          return (
            <div
              key={char.id}
              className="group relative flex items-center justify-between gap-3 overflow-hidden border border-white/10 bg-[rgba(14,17,24,0.35)] p-3 transition-colors hover:border-white/20 hover:bg-[rgba(14,17,24,0.5)]"
            >
              {/* Character Side (Primary Visual Anchor & Typography) */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden border border-white/15 bg-white/5 sm:w-14">
                  {charImage ? (
                    <Image
                      src={charImage}
                      alt={char.name.full}
                      fill
                      unoptimized
                      sizes="56px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/45">
                      {char.name.full.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    {isMain ? "Main" : "Supporting"}
                  </span>
                  <p
                    className="truncate text-xs font-semibold text-white transition-colors group-hover:text-white/80 sm:text-[13px]"
                    title={char.name.full}
                  >
                    {char.name.full}
                  </p>
                  {char.name.native ? (
                    <p className="mt-0.5 truncate text-[11px] leading-tight text-white/40">
                      {char.name.native}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Voice Actor Side */}
              {va ? (
                <div className="flex min-w-0 max-w-[42%] shrink-0 items-center justify-end gap-2.5 border-l border-white/10 pl-2 text-right">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-white/85"
                      title={va.name.full}
                    >
                      {va.name.full}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-white/45">
                      {va.language ?? "Japanese"}
                    </p>
                  </div>

                  <div className="relative aspect-square w-8 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/5">
                    {vaImage ? (
                      <Image
                        src={vaImage}
                        alt={va.name.full}
                        fill
                        unoptimized
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/45">
                        {va.name.full.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

