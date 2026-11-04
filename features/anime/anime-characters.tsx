import Image from "next/image";
import { isHttpUrl } from "@/lib/utils";
import type { AnimeCharacter } from "@/types/anime";

interface AnimeCharactersProps {
  characters?: AnimeCharacter[];
}

export function AnimeCharacters({ characters = [] }: AnimeCharactersProps) {
  if (characters.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface/50 p-6 text-center text-sm text-muted">
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
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-semibold text-muted">
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
              className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-border-subtle bg-surface/90 p-3 transition-colors hover:border-border hover:bg-surface shadow-xs"
            >
              {/* Character Side (Primary Visual Anchor & Typography) */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative aspect-[3/4] w-12 sm:w-14 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-3 shadow-xs">
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
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-faint">
                      {char.name.full.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-medium tracking-wider uppercase text-faint">
                    {isMain ? "Main" : "Supporting"}
                  </span>
                  <p
                    className="truncate text-xs sm:text-[13px] font-semibold text-fg group-hover:text-accent-strong transition-colors"
                    title={char.name.full}
                  >
                    {char.name.full}
                  </p>
                  {char.name.native ? (
                    <p className="truncate text-[11px] text-faint leading-tight mt-0.5">
                      {char.name.native}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Voice Actor Side */}
              {va ? (
                <div className="flex items-center justify-end gap-2.5 min-w-0 pl-2 text-right border-l border-border-subtle/50 shrink-0 max-w-[42%]">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-xs font-medium text-fg"
                      title={va.name.full}
                    >
                      {va.name.full}
                    </p>
                    <p className="truncate text-[10px] text-faint mt-0.5">
                      {va.language ?? "Japanese"}
                    </p>
                  </div>

                  <div className="relative aspect-square w-8 shrink-0 overflow-hidden rounded-full border border-border-subtle bg-surface-3 shadow-xs">
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
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-faint">
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

