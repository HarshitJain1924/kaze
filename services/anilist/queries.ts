/**
 * AniList GraphQL documents. Every query requests only the fields rendered
 * by the interface; the summary fragment is shared by search, discovery,
 * library hydration and related-anime lists.
 */

const ANIME_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment AnimeSummary on Media {
    id
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
    averageScore
    seasonYear
    status
    genres
  }
`;

export const SEARCH_ANIME_QUERY = /* GraphQL */ `
  query SearchAnime(
    $page: Int
    $perPage: Int
    $search: String
    $genre: String
    $format: MediaFormat
    $status: MediaStatus
    $season: MediaSeason
    $seasonYear: Int
    $source: MediaSource
    $countryOfOrigin: CountryCode
    $sort: [MediaSort]
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
      }
      media(
        type: ANIME
        isAdult: false
        search: $search
        genre: $genre
        format: $format
        status: $status
        season: $season
        seasonYear: $seasonYear
        source: $source
        countryOfOrigin: $countryOfOrigin
        sort: $sort
      ) {
        ...AnimeSummary
      }
    }
  }
  ${ANIME_SUMMARY_FRAGMENT}
`;

export const ANIME_DETAILS_QUERY = /* GraphQL */ `
  query AnimeDetails($id: Int) {
    Media(id: $id, type: ANIME) {
      ...AnimeSummary
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
            format
            episodes
            averageScore
            seasonYear
            status
            genres
          }
        }
      }
    }
  }
  ${ANIME_SUMMARY_FRAGMENT}
`;

export const ANIME_BY_IDS_QUERY = /* GraphQL */ `
  query AnimeByIds($ids: [Int], $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
      }
      media(type: ANIME, id_in: $ids, sort: ID) {
        ...AnimeSummary
      }
    }
  }
  ${ANIME_SUMMARY_FRAGMENT}
`;

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
          ...AnimeSummary
        }
      }
    }
  }
  ${ANIME_SUMMARY_FRAGMENT}
`;
