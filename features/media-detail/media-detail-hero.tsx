import Link from "next/link";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
} from "@/components/icons";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { AnimeTrailerModal } from "@/features/anime/anime-trailer-modal";
import { cn } from "@/lib/utils";
import type {
  MediaDetailBadgeTone,
  MediaDetailView,
} from "@/lib/media/detail-view";

const BADGE_TONES: Record<MediaDetailBadgeTone, string> = {
  neutral: "border-border bg-surface-2/80 text-muted",
  accent: "border-accent/40 bg-accent-soft text-accent-strong",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-rose-500/40 bg-rose-500/10 text-rose-400",
};

export function MediaDetailHero({ view }: { view: MediaDetailView }) {
  const links = view.heroLinks;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-2.5">
        {view.badges.map((badge) => (
          <span
            key={`${badge.label}:${badge.tone ?? "neutral"}`}
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              BADGE_TONES[badge.tone ?? "neutral"],
            )}
          >
            {badge.label}
          </span>
        ))}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {view.metaLine.map((item, index) => (
            <span key={`${item}:${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? <span className="text-faint">·</span> : null}
              <span>{item}</span>
            </span>
          ))}
        </div>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-[-0.035em] text-fg drop-shadow-sm sm:text-4xl lg:text-5xl">
        {view.title}
      </h1>
      {view.secondaryTitle ? (
        <p className="mt-1.5 text-sm font-normal tracking-wide text-muted sm:text-base">
          {view.secondaryTitle}
        </p>
      ) : null}
      {view.tagline ? (
        <p className="mt-2 text-sm italic text-muted">“{view.tagline}”</p>
      ) : null}

      <OpticalGlass
        variant="card"
        className="mt-5 flex flex-wrap items-center justify-between gap-4 px-3.5 py-3"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {view.metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                {metric.label}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white">
                {metric.star ? (
                  <StarIcon className="h-4 w-4 fill-amber-300 text-amber-300" />
                ) : null}
                <span>{metric.value}</span>
                {metric.subvalue ? (
                  <span className="text-xs font-normal text-white/50">
                    {metric.subvalue}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>

        {view.trailer ? (
          <div className="shrink-0">
            <AnimeTrailerModal
              trailer={{
                id: view.trailer.id,
                site: view.trailer.site,
                thumbnail: view.trailer.thumbnailUrl,
              }}
              title={view.title}
            />
          </div>
        ) : null}
      </OpticalGlass>

      {links ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {links.label}:
          </span>
          {links.previous ? (
            <Link
              href={links.previous.href}
              className="optical-glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white/85 transition-colors hover:text-white"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5 text-muted" />
              <span className="text-white/50">Prev:</span>
              <span className="max-w-[140px] truncate font-semibold text-white sm:max-w-[200px]">
                {links.previous.title}
              </span>
            </Link>
          ) : null}

          <span className="border border-white/25 px-2.5 py-1 text-xs font-semibold text-white">
            Current
          </span>

          {links.next ? (
            <Link
              href={links.next.href}
              className="optical-glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white/85 transition-colors hover:text-white"
            >
              <span className="text-white/50">Next:</span>
              <span className="max-w-[140px] truncate font-semibold text-white sm:max-w-[200px]">
                {links.next.title}
              </span>
              <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
