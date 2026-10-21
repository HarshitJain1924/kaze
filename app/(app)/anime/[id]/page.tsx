import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnimeDetailsHeader } from "@/components/anime-details-header";
import { AnimePosterCard } from "@/components/anime-poster-card";
import { ArrowLeftIcon, ExternalIcon } from "@/components/icons";
import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { AnimeEpisodeSection } from "@/features/anime/anime-episode-section";
import { AnimeLibraryPanel } from "@/features/anime/anime-library-panel";
import { seasonLabel } from "@/lib/season";
import {
  formatAnimeDate,
  formatRelationType,
  getDisplayTitle,
} from "@/lib/utils";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { Anime, RelatedAnime } from "@/types/anime";

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
    const anime = await getCatalogService().getAnimeById(numericId);
    if (!anime) {
      return { title: "Anime not found" };
    }
    const title = getDisplayTitle(anime.title, true);
    return {
      title,
      description: anime.synopsis
        ? anime.synopsis.slice(0, 180)
        : `Details, ratings and related anime for ${title}.`,
      openGraph: anime.bannerImage
        ? { images: [{ url: anime.bannerImage }] }
        : undefined,
    };
  } catch {
    return { title: "Anime details" };
  }
}

function groupRelations(relations: RelatedAnime[]) {
  const groups = new Map<string, RelatedAnime[]>();
  for (const relation of relations) {
    const label = formatRelationType(relation.relationType) ?? "Related";
    const existing = groups.get(label) ?? [];
    if (existing.length < 6) {
      existing.push(relation);
    }
    groups.set(label, existing);
  }
  return [...groups.entries()];
}

export default async function AnimeDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const numericId = parseId(id);
  if (!numericId) {
    notFound();
  }

  let anime: Anime | null = null;
  const catalogStatus = getCatalogService().getStatus();
  try {
    anime = await getCatalogService().getAnimeById(numericId);
  } catch (error) {
    console.error("[anime] could not load details", numericId, error);
    return (
      <div className="py-10">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to discover
        </Link>
        <ErrorState
          className="mt-6"
          title="Could not load this anime"
          message="Upstream catalogue did not respond. Your library and progress are safe."
          action={<RetryButton />}
        />
      </div>
    );
  }

  if (!anime) {
    notFound();
  }

  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const startDate = formatAnimeDate(anime.startDate);
  const endDate = formatAnimeDate(anime.endDate);
  const relationGroups = groupRelations(anime.relations);

  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 lg:-mx-10 lg:-mt-8">
      <div className="relative h-44 overflow-hidden bg-surface-2 sm:h-60 lg:h-72">
        {anime.bannerImage ? (
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : cover ? (
          <Image
            src={cover}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-110 object-cover opacity-40 blur-xl"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(80%_140%_at_20%_0%,var(--accent-soft),transparent_70%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-black/40" />

        <Link
          href="/discover"
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 sm:left-6"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Discover
        </Link>
      </div>

      <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-10">
        {catalogStatus.isSuspended ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-950/40 px-3.5 py-2 text-xs text-amber-200 backdrop-blur-sm">
            <span>
              Offline resilience mode: Serving cached anime details. AniList is temporarily unavailable upstream.
            </span>
            <span className="font-semibold text-amber-400">Library tracking operational</span>
          </div>
        ) : null}
        <div className="-mt-20 flex flex-col gap-5 sm:-mt-24 sm:flex-row sm:gap-7">
          <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-surface-2 poster-shadow sm:w-44 lg:w-48">
            {cover ? (
              <Image
                src={cover}
                alt={`${getDisplayTitle(anime.title, true)} cover art`}
                fill
                priority
                sizes="(max-width: 640px) 112px, 192px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_0%,var(--accent-soft),transparent_70%)]" />
            )}
          </div>

          <div className="min-w-0 flex-1 sm:pb-2 sm:pt-20 lg:pt-24">
            <AnimeDetailsHeader anime={anime} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="min-w-0 space-y-9">
            <section aria-labelledby="synopsis-heading">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="synopsis-heading"
                  className="font-display text-lg font-semibold text-fg"
                >
                  Synopsis
                </h2>
                <a
                  href={`https://anilist.co/anime/${anime.id}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-fg"
                >
                  AniList page
                  <ExternalIcon className="h-3 w-3" />
                </a>
              </div>
              <p className="mt-3 max-w-[68ch] whitespace-pre-line text-sm leading-[1.65] text-muted sm:text-[15px]">
                {anime.synopsis ??
                  "No synopsis has been provided for this title."}
              </p>

              {anime.genres.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {anime.genres.map((genre) => (
                    <Link
                      key={genre}
                      href={`/discover?genre=${encodeURIComponent(genre)}`}
                      className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent/40 hover:text-fg"
                    >
                      {genre}
                    </Link>
                  ))}
                </div>
              ) : null}

              {anime.tags.length > 0 ? (
                <div className="mt-5">
                  <h3 className="text-[13px] font-semibold text-fg">Tags</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {anime.tags.slice(0, 12).join(" · ")}
                  </p>
                </div>
              ) : null}
            </section>

            <AnimeEpisodeSection anime={anime} />

            <section aria-labelledby="details-heading">
              <h2
                id="details-heading"
                className="font-display text-lg font-semibold text-fg"
              >
                Details
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border-subtle bg-surface/60 p-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-faint">
                    Format
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {anime.format ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">
                    Episodes
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {anime.episodes ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">
                    Season
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {anime.season && anime.seasonYear
                      ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
                      : (anime.seasonYear?.toString() ?? "Unknown")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">
                    Aired
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {startDate
                      ? endDate && endDate !== startDate
                        ? `${startDate} – ${endDate}`
                        : startDate
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">
                    Release status
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {anime.status
                      ? anime.status.replaceAll("_", " ").toLowerCase()
                      : "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-faint">
                    Episode length
                  </dt>
                  <dd className="mt-1 text-sm text-fg">
                    {anime.duration ? `${anime.duration} min` : "Unknown"}
                  </dd>
                </div>
              </dl>
            </section>

            {relationGroups.length > 0 ? (
              <section aria-labelledby="related-heading">
                <h2
                  id="related-heading"
                  className="font-display text-lg font-semibold text-fg"
                >
                  Related anime
                </h2>
                <div className="mt-4 space-y-6">
                  {relationGroups.map(([label, items]) => (
                    <div key={label}>
                      <h3 className="mb-2.5 text-[13px] font-medium text-muted">
                        {label}
                      </h3>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {items.map((relation) => (
                          <AnimePosterCard
                            key={relation.id}
                            anime={relation}
                            showQuickAdd={false}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <AnimeLibraryPanel anime={anime} />
            <p className="mt-3 px-1 text-xs leading-relaxed text-faint">
              Anime metadata and community scores come from AniList. Personal
              ratings are on a 1–10 scale and remain private to your account.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
