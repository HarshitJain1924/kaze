"use client";

import Image from "next/image";
import Link from "next/link";

import { ChevronRightIcon } from "@/components/icons";
import { usePreferences } from "@/components/providers/preferences-provider";
import { useLibrary } from "@/features/library/library-provider";
import {
  formatMediaKind,
  getDisplayTitle,
  isHttpUrl,
  isManga,
} from "@/lib/utils";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function RecentlyUpdated() {
  const { items } = useLibrary();
  const { preferences } = usePreferences();

  const recent = [...items]
    .filter((item) => item.anime !== null)
    .sort(
      (a, b) =>
        new Date(b.entry.updatedAt).getTime() -
        new Date(a.entry.updatedAt).getTime(),
    )
    .slice(0, 5);

  return (
    <section aria-label="Recently updated" className="min-w-0">
      <header className="flex items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Personal activity
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-fg">
            Recently updated
          </h2>
        </div>
        <Link
          href="/library"
          className="group inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent-strong"
        >
          Library
          <ChevronRightIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      {recent.length === 0 ? (
        <p className="border-b border-border py-5 text-xs leading-relaxed text-muted">
          No progress changes yet.{" "}
          <Link
            href="/discover"
            className="font-medium text-accent-strong hover:underline"
          >
            Find something to start.
          </Link>
        </p>
      ) : (
        <ol className="mt-2">
          {recent.map((item) => {
            if (!item.anime) return null;
            const manga = isManga(item.anime);
            const total = manga ? item.anime.chapters : item.anime.episodes;
            const unit = manga ? "ch" : "ep";

            return (
              <li key={item.entry.id}>
                <Link
                  href={`/media/${item.anime.id}`}
                  className="group flex items-center gap-3 border-b border-border py-3 transition-colors hover:bg-surface/35"
                >
                  <span className="relative aspect-[2/3] w-9 shrink-0 overflow-hidden bg-surface-2">
                    {isHttpUrl(
                      item.anime.coverImage.large ??
                        item.anime.coverImage.extraLarge,
                    ) ? (
                      <Image
                        src={
                          item.anime.coverImage.large ??
                          item.anime.coverImage.extraLarge!
                        }
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[13px] font-medium text-fg transition-colors group-hover:text-accent-strong">
                      {getDisplayTitle(
                        item.anime.title,
                        preferences.titleLanguage === "english",
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted">
                      <span>{formatMediaKind(item.anime)}</span>
                      <span className="text-border">/</span>
                      <span>
                        {item.entry.progress}
                        {total ? ` of ${total}` : ""} {unit}
                      </span>
                      <span className="text-border">/</span>
                      <span className="capitalize">{item.entry.status}</span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-[9px] uppercase tracking-[0.08em] text-faint">
                      {formatUpdatedAt(item.entry.updatedAt)}
                    </span>
                    <ChevronRightIcon className="ml-auto mt-1 h-3 w-3 text-faint transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
