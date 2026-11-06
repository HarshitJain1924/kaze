import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RetryButton } from "@/components/retry-button";
import { AniListMediaDetail } from "@/features/media-detail/anilist-detail";
import { MediaDetailError } from "@/features/media-detail/media-detail-error";
import { getViewer } from "@/lib/auth";
import { getDisplayTitle } from "@/lib/utils";
import {
  getCatalogService,
  type CatalogResult,
} from "@/services/catalog/catalog-service";
import { fetchAnimeThemes } from "@/services/catalog/themes-client";
import type { Anime } from "@/types/anime";

interface PageProps {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseId(id);
  if (!numericId) {
    return { title: "Anime not found" };
  }

  try {
    const { data: anime } = await getCatalogService().getMediaById(numericId);
    if (!anime) {
      return { title: "Title not found" };
    }
    const title = getDisplayTitle(anime.title, true);
    if (anime.isAdult) {
      return {
        title: `${title} (18+)`,
        robots: { index: false, follow: false },
      };
    }
    return {
      title,
      description: anime.synopsis
        ? anime.synopsis.slice(0, 180)
        : `Details, ratings and related titles for ${title}.`,
      openGraph: anime.bannerImage
        ? { images: [{ url: anime.bannerImage }] }
        : undefined,
    };
  } catch {
    return { title: "Media details" };
  }
}

export default async function AnimeDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseId(id);
  if (!numericId) {
    notFound();
  }

  const catalog = getCatalogService();
  let result: CatalogResult<Anime | null>;
  try {
    result = await catalog.getMediaById(numericId);
  } catch (error) {
    console.error(
      "[anime] could not load details",
      numericId,
      error instanceof Error ? error.message : "unknown error",
    );
    return (
      <MediaDetailError
        backHref="/discover"
        backLabel="Back to discover"
        title="Could not load this title"
        message="The catalogue did not respond. Your library and progress are safe. Try again in a moment."
        action={<RetryButton />}
      />
    );
  }

  if (!result.data) {
    notFound();
  }

  const anime = result.data;
  const viewer = await getViewer();

  if (anime.isAdult && viewer?.showAdult !== true) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <div className="rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/10 font-display text-sm font-bold text-rose-500 light:text-rose-700">
            18+
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-fg">
            Adult title
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This title is marked 18+ by AniList. Enable adult titles in Settings
            to view its artwork, synopsis and details.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href={
                viewer
                  ? "/settings"
                  : `/login?next=${encodeURIComponent(`/media/${anime.id}`)}`
              }
              className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-contrast"
            >
              {viewer ? "Open Settings" : "Sign in"}
            </Link>
            <Link
              href="/discover"
              className="inline-flex h-10 items-center rounded-xl border border-border bg-surface-2 px-4 text-sm font-medium text-fg"
            >
              Back to discover
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const catalogMeta = result.meta;
  let themes: import("@/types/theme").AnimeTheme[] = [];
  if (anime.mediaType !== "manga") {
    try {
      themes = await fetchAnimeThemes(
        anime.id,
        anime.title.romaji ?? anime.title.english ?? undefined,
      );
    } catch {
      // Non-fatal: the detail remains useful without themes.
    }
  }

  return (
    <AniListMediaDetail
      key={`${anime.mediaType}:${anime.id}`}
      anime={anime}
      themes={themes}
      catalogMeta={catalogMeta}
    />
  );
}
