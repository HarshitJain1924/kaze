import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeftIcon } from "@/components/icons";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { isHttpUrl } from "@/lib/utils";
import type {
  MediaDetailSection,
  MediaDetailView,
} from "@/lib/media/detail-view";
import { MediaDetailBackdrop } from "@/features/media-detail/media-detail-backdrop";
import { MediaDetailHero } from "@/features/media-detail/media-detail-hero";
import { MediaDetailTabs } from "@/features/media-detail/media-detail-tabs";

interface MediaDetailShellProps {
  view: MediaDetailView;
  sections: MediaDetailSection[];
  detailsContent: ReactNode;
  sidebar: ReactNode;
  recommendations?: ReactNode;
  notice?: ReactNode;
  footer?: ReactNode;
}

/**
 * The single shared detail layout. Provider-specific data arrives through the
 * view model and section slots; this component never branches on media kind.
 */
export function MediaDetailShell({
  view,
  sections,
  detailsContent,
  sidebar,
  recommendations,
  notice,
  footer,
}: MediaDetailShellProps) {
  const poster = view.posterUrl && isHttpUrl(view.posterUrl) ? view.posterUrl : null;

  return (
    <div className="relative -mx-4 -mt-5 sm:-mx-6 lg:-mx-10 lg:-mt-8">
      <MediaDetailBackdrop view={view} />

      <div className="relative z-10 mx-auto max-w-[1560px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-6">
        <OpticalGlass
          as="nav"
          variant="interactive"
          aria-label="Breadcrumbs"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-fg"
        >
          <Link
            href={view.backHref}
            className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-accent-strong"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span>{view.backLabel}</span>
          </Link>
          <span className="text-faint">/</span>
          <span className="max-w-[160px] truncate text-muted sm:max-w-[280px]">
            {view.breadcrumbLabel}
          </span>
          <span className="text-faint">/</span>
          <span className="rounded border border-border/80 bg-surface-2/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {view.mediaLabel}
          </span>
        </OpticalGlass>

        {notice ? <div className="mt-3">{notice}</div> : null}

        <div className="mt-6 flex flex-col gap-6 sm:mt-8 sm:flex-row sm:gap-8 lg:gap-12">
          <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-surface-2 shadow-[0_24px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 sm:w-52 lg:w-60">
            {poster ? (
              <Image
                src={poster}
                alt={`${view.title} cover art`}
                fill
                priority
                unoptimized
                sizes="(max-width: 640px) 160px, (max-width: 1024px) 208px, 240px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-surface-3" />
            )}
          </div>

          <div className="min-w-0 flex-1 sm:pt-1">
            <MediaDetailHero view={view} />
          </div>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <div className="min-w-0 pb-20 sm:pb-28">
            <MediaDetailTabs sections={sections} detailsContent={detailsContent} />

            {recommendations ? (
              <div className="mt-10 border-t border-border-subtle pt-8">
                {recommendations}
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            {sidebar}
            {footer ?? (
              <p className="mt-3 px-1 text-xs leading-relaxed text-faint">
                {view.attribution}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
