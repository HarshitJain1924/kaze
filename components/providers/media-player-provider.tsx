"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CloseIcon, PlayIcon } from "@/components/icons";

export interface ActiveMedia {
  id: string;
  site: "youtube" | "animethemes";
  title: string;
  subtitle?: string; // Artist or theme type (e.g. "LiSA — OP 1")
  videoUrl?: string | null;
  audioUrl?: string | null;
  coverImage?: string | null;
}

type PlayerMode = "hidden" | "modal" | "mini";

interface MediaPlayerContextValue {
  activeMedia: ActiveMedia | null;
  mode: PlayerMode;
  playMedia: (media: ActiveMedia) => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

export function useMediaPlayer(): MediaPlayerContextValue {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx) {
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  }
  return ctx;
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const [mode, setMode] = useState<PlayerMode>("hidden");

  const playMedia = useCallback((media: ActiveMedia) => {
    setActiveMedia(media);
    setMode("modal");
  }, []);

  const minimize = useCallback(() => {
    setMode("mini");
  }, []);

  const maximize = useCallback(() => {
    setMode("modal");
  }, []);

  const close = useCallback(() => {
    setMode("hidden");
    setActiveMedia(null);
  }, []);

  // Keyboard shortcut: ESC minimizes to floating corner instead of hard closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode === "modal") {
        setMode("mini");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  return (
    <MediaPlayerContext.Provider
      value={{
        activeMedia,
        mode,
        playMedia,
        minimize,
        maximize,
        close,
      }}
    >
      {children}

      {/* Floating Mini Player (Bottom-Right corner) */}
      {activeMedia && mode === "mini" ? (
        <aside
          aria-label="Floating media player"
          className="fixed bottom-6 right-6 z-50 w-72 sm:w-88 overflow-hidden rounded-2xl border border-white/20 bg-slate-950/95 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl ring-1 ring-white/10 animate-in slide-in-from-bottom-5 duration-300"
        >
          {/* Mini Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2 bg-white/5">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">
                  {activeMedia.title}
                </p>
                {activeMedia.subtitle ? (
                  <p className="truncate text-[10px] text-white/50">
                    {activeMedia.subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Maximize to full lightbox */}
              <button
                type="button"
                onClick={maximize}
                title="Expand to Fullscreen"
                aria-label="Expand player"
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-3 w-3"
                >
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={close}
                title="Close Player"
                aria-label="Close player"
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white/70 hover:bg-rose-500/80 hover:text-white transition-colors"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Mini Stream Video / Audio Container */}
          <div className="relative aspect-video w-full bg-black">
            {activeMedia.site === "animethemes" && activeMedia.videoUrl ? (
              <video
                key={activeMedia.videoUrl}
                src={activeMedia.videoUrl}
                autoPlay
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            ) : (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeMedia.id}?autoplay=1&rel=0&modestbranding=1`}
                title={activeMedia.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            )}
          </div>
        </aside>
      ) : null}

      {/* Full Lightbox Modal */}
      {activeMedia && mode === "modal" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeMedia.title} Media Player`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8"
        >
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-xl transition-opacity animate-in fade-in duration-200"
            onClick={minimize}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-slate-950/95 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-contrast">
                  <PlayIcon className="h-3.5 w-3.5 fill-current" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-bold text-white">
                    {activeMedia.title}
                  </h3>
                  {activeMedia.subtitle ? (
                    <p className="truncate text-xs text-white/60">
                      {activeMedia.subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Minimize to Floating Bar */}
                <button
                  type="button"
                  onClick={minimize}
                  title="Minimize to Floating Jukebox"
                  aria-label="Minimize to corner"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-3.5 w-3.5"
                  >
                    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                  </svg>
                  <span className="hidden sm:inline">Floating Bar</span>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={close}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Close player"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Player Container (16:9 Aspect Ratio) */}
            <div className="relative aspect-video w-full bg-black">
              {activeMedia.site === "animethemes" && activeMedia.videoUrl ? (
                <video
                  key={activeMedia.videoUrl}
                  src={activeMedia.videoUrl}
                  autoPlay
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeMedia.id}?autoplay=1&rel=0&modestbranding=1`}
                  title={`${activeMedia.title} Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </MediaPlayerContext.Provider>
  );
}
