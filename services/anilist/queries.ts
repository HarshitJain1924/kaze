/**
 * AniList GraphQL documents.
 *
 * Every query requests only the fields rendered by the interface. The media
 * fragment is shared by anime, manga, search, library hydration and relations.
 * AniList uses one `Media` entity for both, with `type: ANIME | MANGA`.
 */

const MEDIA_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment MediaSummary on Media {
    id
    type
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
      color
    }
    bannerImage
    format
    episodes
    chapters
    volumes
    countryOfOrigin
    isAdult
    averageScore
    seasonYear
    status
    genres
  }
`;

/**
 * AniList treats an explicit `isAdult: null` as "match nothing", and GraphQL
 * cannot omit a single argument through a variable, so adult-inclusive
 * searches use a separate document without the `isAdult` argument.
 *
 * `format_in` carries the comic format whitelist for manga (MANGA / ONE_SHOT)
 * while remaining a normal, optional format filter for anime.
 */
function buildSearchMediaQuery(filterAdult: boolean): string {
  const adultVariable = filterAdult ? "\n    $isAdult: Boolean" : "";
  const adultArgument = filterAdult ? "\n        isAdult: $isAdult" : "";

  return `
  query SearchMedia(
    $page: Int
    $perPage: Int
    $search: String
    $type: MediaType
    $formats: [MediaFormat]
    $genre: String
    $status: MediaStatus
    $season: MediaSeason
    $seasonYear: Int
    $source: MediaSource
    $countryOfOrigin: CountryCode
    $sort: [MediaSort]${adultVariable}
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
      }
      media(
        type: $type
        format_in: $formats
        search: $search
        genre: $genre
        status: $status
        season: $season
        seasonYear: $seasonYear
        source: $source
        countryOfOrigin: $countryOfOrigin
        sort: $sort${adultArgument}
      ) {
        ...MediaSummary
      }
    }
  }
  ${MEDIA_SUMMARY_FRAGMENT}
`;
}

/** Default search document: adult titles are excluded. */
export const SEARCH_MEDIA_QUERY = buildSearchMediaQuery(true);

/** Adult titles are allowed; the document has no `isAdult` argument. */
export const SEARCH_MEDIA_INCLUDING_ADULT_QUERY = buildSearchMediaQuery(false);

/** Legacy aliases kept for callers that only search anime. */
export const SEARCH_ANIME_QUERY = SEARCH_MEDIA_QUERY;
export const SEARCH_ANIME_INCLUDING_ADULT_QUERY =
  SEARCH_MEDIA_INCLUDING_ADULT_QUERY;

export const MEDIA_DETAILS_QUERY = /* GraphQL */ `
  query MediaDetails($id: Int) {
    Media(id: $id) {
      ...MediaSummary
      bannerImage
      description
      season
      duration
      popularity
      tags {
        name
        isMediaSpoiler
      }
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      relations {
        edges {
          relationType
          node {
            ...MediaSummary
          }
        }
      }
      studios(isMain: true) {
        nodes {
          id
          name
        }
      }
      trailer {
        id
        site
        thumbnail
      }
      externalLinks {
        id
        url
        site
        type
        icon
        color
      }
      characters(sort: [ROLE, RELEVANCE, ID], perPage: 12) {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              medium
              large
            }
          }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
            id
            name {
              full
              native
            }
            image {
              medium
              large
            }
            languageV2
          }
        }
      }
      recommendations(sort: [RATING_DESC, ID], perPage: 8) {
        nodes {
          rating
          mediaRecommendation {
            ...MediaSummary
          }
        }
      }
    }
  }
  ${MEDIA_SUMMARY_FRAGMENT}
`;

/** Legacy alias: the details document resolves any AniList media type. */
export const ANIME_DETAILS_QUERY = MEDIA_DETAILS_QUERY;

export const MEDIA_BY_IDS_QUERY = /* GraphQL */ `
  query MediaByIds($ids: [Int], $type: MediaType, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
      }
      media(type: $type, id_in: $ids, sort: ID) {
        ...MediaSummary
      }
    }
  }
  ${MEDIA_SUMMARY_FRAGMENT}
`;

/** Legacy alias kept for anime-only library hydration. */
export const ANIME_BY_IDS_QUERY = MEDIA_BY_IDS_QUERY;

export const AIRING_SCHEDULE_QUERY = /* GraphQL */ `
  query AiringSchedule(
    $airingAtGreater: Int
    $airingAtLesser: Int
    $mediaIdIn: [Int]
    $page: Int
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
      }
      airingSchedules(
        airingAt_greater: $airingAtGreater
        airingAt_lesser: $airingAtLesser
        mediaId_in: $mediaIdIn
        sort: [TIME]
      ) {
        id
        airingAt
        timeUntilAiring
        episode
        mediaId
        media {
          ...MediaSummary
        }
      }
    }
  }
  ${MEDIA_SUMMARY_FRAGMENT}
`;
