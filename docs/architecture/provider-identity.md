# Provider identity and canonical media kind

- **Status:** Proposed for Phase 2B
- **Date:** 2026-11-04
- **Scope:** Canonical media identity only. This document does not define or
  approve database schema, migration code, TMDB integration or UI changes.

## Context

Kaze is moving from AniList-ID-keyed anime/manga records to canonical,
provider-neutral media records. A canonical Kaze UUID identifies the media;
provider IDs such as AniList and TMDB IDs are external references attached to
that record.

The canonical kind must be stable before mappings are created. If the same
title is classified differently by two providers, an automatic merge can
produce duplicate records or move an existing record between kinds after users
have attached progress to it.

## Decision

Canonical kind is determined by the following rules.

| Source record | Canonical kind |
| --- | --- |
| AniList manga, including `MANGA` and `ONE_SHOT` | `manga` |
| AniList anime with format `MOVIE` | `movie` |
| AniList anime series and TV anime, including `TV`, `TV_SHORT`, `OVA`, `ONA`, `SPECIAL` and `MUSIC` | `anime` |
| TMDB movie | `movie` |
| TMDB TV show | `tv` |

AniList's own anime/manga split remains the source classification for AniList
records. The adapter must honour an explicit AniList `mediaType` before using a
format fallback.

## Cross-provider mapping

1. **AniList anime movie → TMDB movie.** When both provider IDs are explicitly
   verified as the same film, they may attach to one canonical `movie` record.
   The canonical kind is `movie`, not `anime`.
2. **AniList anime series or TV anime → TMDB TV.** These remain distinct
   canonical records: the AniList record is `anime`; the TMDB record is `tv`.
   Shared title, season structure or episode count is not sufficient to merge
   them. A future cross-reference, if needed, is a separate relationship and
   must not rewrite either record's canonical kind.
3. **AniList manga → TMDB.** No merge. TMDB movies and TV shows are not manga
   identities.
4. **TMDB movie → TMDB TV.** No merge; these are distinct kinds.

## Mapping verification

- A mapping requires an explicit provider and external ID. Title similarity,
  normalized titles, release years or artwork must not create a mapping by
  themselves.
- A new mapping is written only after verification against both provider
  records.
- Ambiguous or conflicting mappings are quarantined for review. They must not
  be resolved by choosing the first row or by creating a duplicate canonical
  record automatically.
- If an existing canonical record has a kind that conflicts with this policy,
  do not change its kind automatically. Attach a new provider reference only
  after a reviewed correction plan exists.
- Mapping loaders must validate canonical IDs with the same UUID rules as the
  application and must fail loudly on malformed mapping rows.

## Conceptual mapping shape

The eventual mapping record should retain, at minimum:

- canonical media ID
- provider
- provider external ID
- verification timestamp
- verification source or reviewer
- optional migration note

The exact table and constraints are deferred to Phase 2B. Provider/external-ID
pairs must be unique. This document does not authorize creating those tables.

## Consequences

- AniList anime films and TMDB films can share one canonical `movie` identity.
- AniList anime series and general TMDB TV records stay separate by design.
- AniList TV anime does not become `tv` merely because TMDB classifies the
  title as television.
- Backfills must be able to run without provider availability; mappings that
  cannot be verified remain unmapped rather than guessed.
- A title with different provider IDs may intentionally produce two canonical
  records until an explicit, verified mapping exists.

## Out of scope

- Database migrations or schema changes
- TMDB API client or credentials
- Provider mapping execution
- UI changes
- Changing existing AniList or Kitsu runtime behavior
