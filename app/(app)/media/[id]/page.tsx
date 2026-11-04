import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnimeDetailsHeader } from "@/components/anime-details-header";
import { AnimePosterCard } from "@/components/anime-poster-card";
import { ArrowLeftIcon, ExternalIcon } from "@/components/icons";
import { ErrorState } from "@/components/error-state";
import { RetryButton } from "@/components/retry-button";
import { OpticalGlass } from "@/components/ui/optical-glass";
import { AnimeStreamingLinks } from "@/components/anime-streaming-links";
import { AnimeDetailsTabs } from "@/features/anime/anime-details-tabs";
import { AnimeCharacters } from "@/features/anime/anime-characters";
import { AnimeMusicJukebox } from "@/features/anime/anime-music-jukebox";
import { AnimeRecommendations } from "@/features/anime/anime-recommendations";
import { AnimeEpisodeSection } from "@/features/anime/anime-episode-section";
import { AnimeFranchiseSection } from "@/features/anime/anime-franchise-section";
import { AnimeLibraryPanel } from "@/features/anime/anime-library-panel";
import { getViewer } from "@/lib/auth";
import { seasonLabel } from "@/lib/season";
import {
  formatAnimeDate,
  formatFormat,
  formatMediaKind,
  formatRelationType,
  getDisplayTitle,
  isHttpUrl,
} from "@/lib/utils";
import {
  getCatalogService,
  type CatalogResult,
} from "@/services/catalog/catalog-service";
import { fetchAnimeThemes } from "@/services/catalog/themes-client";
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
          title="Could not load this title"
          message="The catalogue did not respond. Your library and progress are safe. Try again in a moment."
          action={<RetryButton />}
        />
      </div>
    );
  }

  if (!result.data) {
    notFound();
  }

  const anime = result.data;
  const manga = anime.mediaType === "manga";
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
              href={viewer ? "/settings" : `/login?next=${encodeURIComponent(`/media/${anime.id}`)}`}
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

  // Banner metadata is scoped to this request's result, never shared state.
  const catalogMeta = result.meta;
  const cover = anime.coverImage.extraLarge ?? anime.coverImage.large;
  const startDate = formatAnimeDate(anime.startDate);
  const endDate = formatAnimeDate(anime.endDate);
  const relationGroups = groupRelations(anime.relations);
  const displayTitle = getDisplayTitle(anime.title, true);
  const hasBanner = Boolean(anime.bannerImage && isHttpUrl(anime.bannerImage));
  const hasCover = Boolean(cover && isHttpUrl(cover));
  const accentColor = anime.coverImage.color ?? null;

  let themes: import("@/types/theme").AnimeTheme[] = [];
  if (!manga) {
    try {
      themes = await fetchAnimeThemes(
        anime.id,
        anime.title.romaji ?? anime.title.english ?? undefined,
      );
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="relative -mx-4 -mt-5 sm:-mx-6 lg:-mx-10 lg:-mt-8">
      {/* Full-Viewport Fixed Artwork Backdrop */}
      {hasBanner && anime.bannerImage ? (
        /* Scenario A: Full-Viewport Fixed Wallpaper for landscape banners */
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none"
        >
          {/* Subtle diffused atmospheric aura backlight */}
          <div className="absolute inset-0 scale-110 blur-[80px] saturate-[1.4] opacity-15 dark:opacity-20 dark:brightness-95 pointer-events-none">
            <Image
              src={anime.bannerImage}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>

          {/* Full-viewport landscape artwork (fixed, stays visible, saturated, and recognizable) */}
          <div className="relative h-full w-full">
            <Image
              src={anime.bannerImage}
              alt=""
              fill
              priority
              unoptimized
              sizes="100vw"
              className="object-cover object-top opacity-100 dark:opacity-65 dark:brightness-95 dark:contrast-105 transition-opacity"
            />
          </div>

          {/* Dynamic dominant color tint from anime metadata (active only in dark mode to prevent light-mode whiteout) */}
          {accentColor ? (
            <div
              className="absolute inset-0 hidden dark:block dark:opacity-15 dark:mix-blend-screen pointer-events-none"
              style={{
                background: `radial-gradient(circle at 75% 25%, ${accentColor} 0%, transparent 65%)`,
              }}
            />
          ) : null}

          {/* Top scrim: delicate neutral vignette in light mode, deeper contrast in dark mode */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/15 via-black/5 to-transparent dark:from-black/60 dark:via-black/20 pointer-events-none" />

          {/* Progressive atmospheric wash:
              - Hero region (0-30%): clear, artwork remains vivid and recognizable behind glass
              - Content transition (30-60%): gently softens contrast and saturation with theme wash
              - Lower sections (60-100%): grounds the canvas with smooth backdrop, keeping art perceptible
          */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-30% via-bg/25 via-60% to-bg/75 dark:via-bg/40 dark:to-bg pointer-events-none" />

          {/* Left horizontal wash for readable editorial typography while keeping the right artwork column clear */}
          <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 via-35% to-transparent dark:from-bg dark:via-bg/75 dark:via-45% pointer-events-none" />
        </div>
      ) : hasCover && cover ? (
        /* Scenario B: Fixed Atmospheric Backdrop when no landscape banner exists (using portrait poster) */
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none"
        >
          {/* Atmospheric blurred aura from cover art */}
          <div className="absolute inset-0 scale-125 blur-[90px] saturate-[1.4] opacity-20 dark:opacity-25 pointer-events-none">
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>

          {/* Right-aligned cinematic portrait stage (prevents stretching portrait art across landscape viewport) */}
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[500px] lg:w-[680px] overflow-hidden opacity-90 dark:opacity-40 pointer-events-none">
            <Image
              src={cover}
              alt=""
              fill
              priority
              unoptimized
              sizes="(max-width: 640px) 100vw, 680px"
              className="object-cover object-top"
            />
            {/* Blending scrims so portrait art melts into the page canvas */}
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 via-30% to-transparent dark:via-bg/50" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg/80 to-transparent dark:from-bg" />
          </div>

          {/* Dynamic dominant color tint (active in dark mode) */}
          {accentColor ? (
            <div
              className="absolute inset-0 hidden dark:block dark:opacity-15 dark:mix-blend-screen pointer-events-none"
              style={{
                background: `radial-gradient(circle at 75% 25%, ${accentColor} 0%, transparent 65%)`,
              }}
            />
          ) : null}

          {/* Top and left scrims for text legibility */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/15 via-black/5 to-transparent dark:from-black/60 dark:via-black/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/95 via-bg/70 via-35% to-transparent dark:from-bg dark:via-bg/75 dark:via-45% pointer-events-none" />
        </div>
      ) : (
        /* Scenario C: Restrained theme-based atmospheric background when neither banner nor cover is available */
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden select-none"
        >
          <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_70%_20%,var(--accent-soft),transparent_70%)] opacity-40" />
        </div>
      )}

      {/* Hero Foreground Content */}
      <div className="relative z-10 mx-auto max-w-[1560px] px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-6">
        {/* Editorial Optical Glass Breadcrumb Navigation */}
        <OpticalGlass
          as="nav"
          variant="interactive"
          aria-label="Breadcrumbs"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium text-fg"
        >
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-accent-strong"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span>Discover</span>
          </Link>
          <span className="text-faint">/</span>
          <span className="max-w-[160px] truncate text-muted sm:max-w-[280px]">
            {displayTitle}
          </span>
          {anime.format ? (
            <>
              <span className="text-faint">/</span>
              <span className="rounded border border-border/80 bg-surface-2/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {manga ? formatMediaKind(anime) : formatFormat(anime.format)}
              </span>
            </>
          ) : null}
        </OpticalGlass>

        {catalogMeta.degraded ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/40 px-3.5 py-2 text-xs text-amber-200 light:bg-amber-500/10 light:text-amber-800">
            <span>
              {catalogMeta.health.isSuspended
                ? "Offline resilience mode: AniList is temporarily suspended upstream. Showing the metadata that is still available."
                : "Offline resilience mode: AniList is unavailable right now. Showing the metadata that is still available."}
            </span>
            <span className="font-semibold text-amber-400 light:text-amber-700">
              Library tracking operational
            </span>
          </div>
        ) : null}

        {/* Cinematic Editorial Hero */}
        <div className="mt-6 flex flex-col gap-6 sm:mt-8 sm:flex-row sm:gap-8 lg:gap-12">
          {/* Left: Prominent Vertical Poster */}
          <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-surface-2 shadow-[0_24px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10 sm:w-52 lg:w-60">
            {cover ? (
              <Image
                src={cover}
                alt={`${getDisplayTitle(anime.title, true)} cover art`}
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

          {/* Right: Editorial Information & Actions (Breathes directly on canvas) */}
          <div className="min-w-0 flex-1 sm:pt-1">
            <AnimeDetailsHeader anime={anime} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 items-start">
          <div className="min-w-0 pb-20 sm:pb-28">
            <AnimeDetailsTabs
              synopsisContent={
                <section aria-labelledby="synopsis-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      id="synopsis-heading"
                      className="font-display text-lg font-semibold text-fg"
                    >
                      Synopsis
                    </h2>
                    <a
                      href={`https://anilist.co/${manga ? "manga" : "anime"}/${anime.id}`}
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
                    <div className="mt-5 flex flex-wrap gap-2">
                      {anime.genres.map((genre) => (
                        <Link
                          key={genre}
                          href={`/discover?type=${manga ? "manga" : "anime"}&genre=${encodeURIComponent(genre)}`}
                          className="rounded border border-border-subtle bg-surface-2/80 px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-border hover:bg-surface-3 hover:text-fg shadow-xs"
                        >
                          {genre}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {anime.tags.length > 0 ? (
                    <div className="mt-5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">Tags</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        {anime.tags.slice(0, 12).join(" · ")}
                      </p>
                    </div>
                  ) : null}

                  {anime.externalLinks && anime.externalLinks.length > 0 ? (
                    <div className="mt-6 border-t border-border pt-5">
                      <AnimeStreamingLinks links={anime.externalLinks} />
                    </div>
                  ) : null}
                </section>
              }
              franchiseContent={
                <AnimeFranchiseSection currentAnime={anime} />
              }
              themesContent={
                themes.length > 0 ? (
                  <AnimeMusicJukebox themes={themes} animeTitle={displayTitle} />
                ) : null
              }
              hasThemes={themes.length > 0}
              themesCount={themes.length}
              charactersContent={
                anime.characters && anime.characters.length > 0 ? (
                  <AnimeCharacters characters={anime.characters} />
                ) : null
              }
              hasCharacters={Boolean(anime.characters && anime.characters.length > 0)}
              charactersCount={anime.characters?.length ?? 0}
              episodesContent={<AnimeEpisodeSection anime={anime} />}
              detailsContent={
                <div className="space-y-6">
                  <section aria-labelledby="details-heading">
                    <h2
                      id="details-heading"
                      className="font-display text-lg font-semibold text-fg"
                    >
                      Technical Details
                    </h2>
                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border-subtle bg-surface/90 p-5 shadow-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-faint">
                          {manga ? "Medium" : "Format"}
                        </dt>
                        <dd className="mt-1 text-sm text-fg">
                          {manga
                            ? formatMediaKind(anime)
                            : (formatFormat(anime.format) ?? "Unknown")}
                        </dd>
                      </div>
                      {manga ? (
                        <>
                          <div>
                            <dt className="text-xs text-faint">Chapters</dt>
                            <dd className="mt-1 text-sm text-fg">
                              {anime.chapters ?? "Unknown"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-faint">Volumes</dt>
                            <dd className="mt-1 text-sm text-fg">
                              {anime.volumes ?? "Unknown"}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <dt className="text-xs text-faint">Episodes</dt>
                            <dd className="mt-1 text-sm text-fg">
                              {anime.episodes ?? "Unknown"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-faint">Season</dt>
                            <dd className="mt-1 text-sm text-fg">
                              {anime.season && anime.seasonYear
                                ? `${seasonLabel(anime.season)} ${anime.seasonYear}`
                                : (anime.seasonYear?.toString() ?? "Unknown")}
                            </dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt className="text-xs text-faint">
                          {manga ? "Published" : "Aired"}
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
                        <dt className="text-xs text-faint">Release status</dt>
                        <dd className="mt-1 text-sm text-fg">
                          {anime.status
                            ? anime.status.replaceAll("_", " ").toLowerCase()
                            : "Unknown"}
                        </dd>
                      </div>
                      {!manga ? (
                        <div>
                          <dt className="text-xs text-faint">Episode length</dt>
                          <dd className="mt-1 text-sm text-fg">
                            {anime.duration ? `${anime.duration} min` : "Unknown"}
                          </dd>
                        </div>
                      ) : null}
                      {anime.studios && anime.studios.length > 0 ? (
                        <div>
                          <dt className="text-xs text-faint">Studio</dt>
                          <dd className="mt-1 text-sm text-fg">
                            {anime.studios.map((s) => s.name).join(", ")}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  {relationGroups.length > 0 ? (
                    <section aria-labelledby="related-heading">
                      <h2
                        id="related-heading"
                        className="font-display text-lg font-semibold text-fg"
                      >
                        All Connected Releases
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
              }
              hasFranchise={anime.relations.length > 0}
              franchiseCount={anime.relations.length + 1}
              episodesCount={manga ? (anime.chapters ?? null) : anime.episodes}
              showEpisodes={!manga}
              episodeLabel={manga ? "Chapters" : "Episodes"}
            />

            {anime.recommendations && anime.recommendations.length > 0 ? (
              <div className="mt-10 border-t border-border-subtle pt-8">
                <AnimeRecommendations
                  recommendations={anime.recommendations}
                  title={`More Like ${displayTitle}`}
                />
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <AnimeLibraryPanel anime={anime} />
            <p className="mt-3 px-1 text-xs leading-relaxed text-faint">
              Metadata and community scores come from AniList. Personal ratings
              are on a 1–10 scale and remain private to your account.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
