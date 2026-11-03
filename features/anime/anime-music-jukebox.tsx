"use client";

import { useMemo } from "react";
import { PlayIcon, SparklesIcon } from "@/components/icons";
import { useMediaPlayer } from "@/components/providers/media-player-provider";
import type { AnimeTheme } from "@/types/theme";

interface AnimeMusicJukeboxProps {
  themes: AnimeTheme[];
  animeTitle: string;
}

export function AnimeMusicJukebox({
  themes = [],
  animeTitle,
}: AnimeMusicJukeboxProps) {
  const { playMedia, activeMedia } = useMediaPlayer();

  const openings = useMemo(
    () => themes.filter((t) => t.type === "OP"),
    [themes],
  );
  const endings = useMemo(
    () => themes.filter((t) => t.type === "ED"),
    [themes],
  );

  if (themes.length === 0) {
    return (
      <div className="rounded-3xl border border-border-subtle bg-surface/50 p-8 text-center text-xs text-muted">
        No promotional opening or ending themes are currently catalogued for this title.
      </div>
    );
  }

  const renderTrackCard = (theme: AnimeTheme) => {
    const isPlaying =
      activeMedia?.id === theme.id ||
      (activeMedia?.videoUrl && activeMedia.videoUrl === theme.videoUrl);

    return (
      <div
        key={theme.id}
        className={`group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border p-3.5 backdrop-blur-md transition-all ${
          isPlaying
            ? "border-accent bg-accent/15 shadow-[0_0_20px_rgba(139,92,246,0.25)]"
            : "border-white/10 bg-surface-2/70 hover:border-accent/40 hover:bg-surface-3/80 shadow-xs"
        }`}
      >
        {/* Left: Vinyl Disc + Info */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* Vinyl Disc Icon */}
          <div
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-slate-900 shadow-md ${
              isPlaying ? "animate-[spin_4s_linear_infinite]" : "group-hover:scale-105"
            } transition-transform`}
          >
            {/* Center Label */}
            <div
              className={`h-4 w-4 rounded-full border border-white/40 ${
                theme.type === "OP" ? "bg-accent" : "bg-cyan-500"
              }`}
            />
            {/* Vinyl Grooves */}
            <div className="absolute inset-1 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-2.5 rounded-full border border-white/5 pointer-events-none" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                  theme.type === "OP"
                    ? "border border-accent/40 bg-accent/20 text-accent-strong"
                    : "border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 light:text-cyan-700"
                }`}
              >
                {theme.slug}
              </span>

              {theme.episodes ? (
                <span className="text-[10px] text-faint">
                  {theme.episodes}
                </span>
              ) : null}
            </div>

            <p
              className={`mt-0.5 truncate text-xs font-bold transition-colors ${
                isPlaying ? "text-accent-strong" : "text-fg group-hover:text-accent-strong"
              }`}
              title={theme.title}
            >
              {theme.title}
            </p>

            <p className="truncate text-[11px] text-muted" title={theme.artist}>
              {theme.artist}
            </p>
          </div>
        </div>

        {/* Right: Play Action Button */}
        {theme.videoUrl ? (
          <button
            type="button"
            onClick={() =>
              playMedia({
                id: theme.id,
                site: "animethemes",
                title: `${animeTitle} — ${theme.slug}: ${theme.title}`,
                subtitle: theme.artist,
                videoUrl: theme.videoUrl,
              })
            }
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs shrink-0 ${
              isPlaying
                ? "bg-accent text-accent-contrast shadow-md scale-105"
                : "bg-surface-3 text-fg hover:bg-accent hover:text-accent-contrast active:scale-95"
            }`}
          >
            {isPlaying ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
                <span>Playing</span>
              </>
            ) : (
              <>
                <PlayIcon className="h-3 w-3 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-[10px] text-faint shrink-0">Audio only</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-accent" />
          <h2 className="font-display text-lg font-bold text-fg">
            Theme Songs & Music Jukebox
          </h2>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">
            {themes.length}
          </span>
        </div>
        <span className="text-[11px] text-faint hidden sm:inline">
          Official Creditless Audio & Visuals via AnimeThemes
        </span>
      </div>

      {openings.length > 0 ? (
        <section aria-labelledby="op-heading" className="space-y-3">
          <h3
            id="op-heading"
            className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Opening Themes ({openings.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {openings.map(renderTrackCard)}
          </div>
        </section>
      ) : null}

      {endings.length > 0 ? (
        <section aria-labelledby="ed-heading" className="space-y-3 pt-2">
          <h3
            id="ed-heading"
            className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Ending Themes ({endings.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {endings.map(renderTrackCard)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

