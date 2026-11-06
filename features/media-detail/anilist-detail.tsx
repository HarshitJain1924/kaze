import { AnimePosterCard } from "@/components/anime-poster-card";
import { AnimeCharacters } from "@/features/anime/anime-characters";
import { AnimeEpisodeSection } from "@/features/anime/anime-episode-section";
import { AnimeFranchiseSection } from "@/features/anime/anime-franchise-section";
import { AnimeLibraryPanel } from "@/features/anime/anime-library-panel";
import { AnimeMusicJukebox } from "@/features/anime/anime-music-jukebox";
import { AnimeRecommendations } from "@/features/anime/anime-recommendations";
import { AnimeStreamingLinks } from "@/components/anime-streaming-links";
import { formatRelationType } from "@/lib/utils";
import { adaptAniListDetailView } from "@/lib/media/detail-view";
import type { MediaDetailSection } from "@/lib/media/detail-view";
import type { CatalogResult } from "@/services/catalog/catalog-service";
import type { Anime, RelatedAnime } from "@/types/anime";
import type { AnimeTheme } from "@/types/theme";
import { MediaDetailFacts } from "@/features/media-detail/media-detail-facts";
import { MediaDetailShell } from "@/features/media-detail/media-detail-shell";
import { MediaDetailSynopsis } from "@/features/media-detail/media-detail-synopsis";

function groupRelations(relations: RelatedAnime[]) {
  const groups = new Map<string, RelatedAnime[]>();
  for (const relation of relations) {
    const label = formatRelationType(relation.relationType) ?? "Related";
    const existing = groups.get(label) ?? [];
    if (existing.length < 6) existing.push(relation);
    groups.set(label, existing);
  }
  return [...groups.entries()];
}

/**
 * AniList/Kitsu composition. The catalog service already merges both
 * providers into Anime, so this adapter covers anime and manga without
 * duplicating provider conditions in the shared shell.
 */
export function AniListMediaDetail({
  anime,
  themes,
  catalogMeta,
}: {
  anime: Anime;
  themes: AnimeTheme[];
  catalogMeta: CatalogResult<Anime | null>["meta"];
}) {
  const view = adaptAniListDetailView(anime);
  const manga = view.kind === "manga";
  const relationGroups = groupRelations(anime.relations);
  const hasCharacters = Boolean(anime.characters && anime.characters.length > 0);

  const sections: MediaDetailSection[] = [
    {
      id: "synopsis",
      label: "Synopsis",
      tab: false,
      overview: true,
      content: (
        <MediaDetailSynopsis
          synopsis={view.synopsis}
          genres={view.genres}
          tags={view.tags}
          sourceUrl={view.sourceUrl}
          sourceLabel={view.sourceLabel}
        >
          {anime.externalLinks && anime.externalLinks.length > 0 ? (
            <AnimeStreamingLinks links={anime.externalLinks} />
          ) : null}
        </MediaDetailSynopsis>
      ),
    },
  ];

  if (hasCharacters && anime.characters) {
    sections.push({
      id: "characters",
      label: "Characters",
      count: anime.characters.length,
      overview: true,
      content: <AnimeCharacters characters={anime.characters} />,
    });
  }

  if (themes.length > 0) {
    sections.push({
      id: "themes",
      label: "Themes",
      count: themes.length,
      overview: true,
      content: (
        <AnimeMusicJukebox themes={themes} animeTitle={view.title} />
      ),
    });
  }

  if (anime.relations.length > 0) {
    sections.push({
      id: "franchise",
      label: "Franchise",
      count: anime.relations.length + 1,
      overview: true,
      content: <AnimeFranchiseSection currentAnime={anime} />,
    });
  }

  if (!manga) {
    sections.push({
      id: "episodes",
      label: "Episodes",
      count: anime.episodes,
      overview: true,
      content: <AnimeEpisodeSection anime={anime} />,
    });
  }

  const detailsContent = (
    <div className="space-y-6">
      <MediaDetailFacts facts={view.facts} />
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
  );

  return (
    <MediaDetailShell
      view={view}
      sections={sections}
      detailsContent={detailsContent}
      sidebar={<AnimeLibraryPanel anime={anime} />}
      recommendations={
        anime.recommendations && anime.recommendations.length > 0 ? (
          <AnimeRecommendations
            recommendations={anime.recommendations}
            title={`More Like ${view.title}`}
          />
        ) : undefined
      }
      notice={
        catalogMeta.degraded ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-950/40 px-3.5 py-2 text-xs text-amber-200 light:bg-amber-500/10 light:text-amber-800">
            <span>
              {catalogMeta.health.isSuspended
                ? "Offline resilience mode: AniList is temporarily suspended upstream. Showing the metadata that is still available."
                : "Offline resilience mode: AniList is unavailable right now. Showing the metadata that is still available."}
            </span>
            <span className="font-semibold text-amber-400 light:text-amber-700">
              Library tracking operational
            </span>
          </div>
        ) : undefined
      }
    />
  );
}
