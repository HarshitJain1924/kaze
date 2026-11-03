import Image from "next/image";
import { ExternalIcon, FilmIcon } from "@/components/icons";
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

export function AnimeStreamingLinks({ links = [] }: AnimeStreamingLinksProps) {
  const streamingLinks = links.filter(
    (l) =>
      (l.type === "STREAMING" || STREAMING_SITES.has(l.site)) &&
      isHttpUrl(l.url),
  );

  if (streamingLinks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
        <FilmIcon className="h-3.5 w-3.5 text-accent" />
        <span>Where to Stream</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {streamingLinks.map((link) => {
          const hasColor = Boolean(link.color);
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-surface-2/80 px-3 py-1.5 text-xs font-semibold text-fg transition-all hover:border-accent/40 hover:bg-surface-3 hover:scale-[1.02] active:scale-[0.98] shadow-xs backdrop-blur-md"
              style={
                hasColor
                  ? ({
                      "--stream-color": link.color,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {link.icon && isHttpUrl(link.icon) ? (
                <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded">
                  <Image
                    src={link.icon}
                    alt={link.site}
                    fill
                    unoptimized
                    sizes="16px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: link.color ?? "var(--accent)" }}
                />
              )}

              <span>{link.site}</span>
              <ExternalIcon className="h-3 w-3 text-faint group-hover:text-fg transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

