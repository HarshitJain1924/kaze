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
    $season: MediaSeason
    $seasonYear: Int
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
        season: $season
        seasonYear: $seasonYear
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
