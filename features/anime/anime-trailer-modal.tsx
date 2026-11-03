"use client";

import { PlayIcon } from "@/components/icons";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import type { AnimeTrailer } from "@/types/anime";

interface AnimeTrailerModalProps {
  trailer: AnimeTrailer;
  title: string;
}

export function AnimeTrailerModal({ trailer, title }: AnimeTrailerModalProps) {
  const { playMedia } = useMediaPlayer();

  if (!trailer.id || trailer.site !== "youtube") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        playMedia({
          id: trailer.id!,
          site: "youtube",
          title,
        })
      }
      className="inline-flex items-center gap-2 rounded-xl liquid-glass-interactive px-3 py-1.5 text-xs font-semibold text-fg transition-all hover:text-accent-strong hover:scale-[1.02] active:scale-[0.98] shadow-sm"
      aria-haspopup="dialog"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-contrast">
        <PlayIcon className="h-2.5 w-2.5 fill-current" />
      </span>
      <span>Watch Trailer</span>
    </button>
  );
}
