import Image from "next/image";

import { ExternalIcon, FilmIcon } from "@/components/icons";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { isHttpUrl } from "@/lib/utils";
import type { AnimeExternalLink } from "@/types/anime";

interface AnimeStreamingLinksProps {
  links?: AnimeExternalLink[];
}

const STREAMING_SITES = new Set([
  "Crunchyroll",
  "Netflix",
  "Hulu",
  "HIDIVE",
  "Bilibili",
  "Disney Plus",
  "Amazon Prime Video",
  "Funimation",
  "Tubi TV",
  "VRV",
  "YouTube",
]);

/**
 * Sits inside the synopsis on the left of the detail page, so it takes the
 * same liquid-glass treatment as the tracking workspace opposite it: dark
 * tinted panel, hairline edge, light text that stays readable in both themes.
 */
export function AnimeStreamingLinks({ links = [] }: AnimeStreamingLinksProps) {
  const streamingLinks = links.filter(
    (link) =>
      (link.type === "STREAMING" || STREAMING_SITES.has(link.site)) &&
      isHttpUrl(link.url),
  );

  if (streamingLinks.length === 0) {
    return null;
  }

  return (
    <OpticalGlass variant="card" className="space-y-2.5 p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
        <FilmIcon className="h-3.5 w-3.5 text-white/70" />
        <span>Where to Stream</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {streamingLinks.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-2 border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:border-white/40 hover:text-white active:translate-y-px"
          >
            {link.icon && isHttpUrl(link.icon) ? (
              <span className="relative h-4 w-4 shrink-0 overflow-hidden">
                <Image
                  src={link.icon}
                  alt=""
                  fill
                  unoptimized
                  sizes="16px"
                  className="object-contain"
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0"
                style={{ backgroundColor: link.color ?? "currentColor" }}
              />
            )}

            <span>{link.site}</span>
            <ExternalIcon className="h-3 w-3 text-white/40 transition-colors group-hover:text-white/80" />
          </a>
        ))}
      </div>
    </OpticalGlass>
  );
}
