# Kaze — Anime Tracker

A personal anime tracker built for desktop and mobile. Search real anime from
[AniList](https://anilist.co), keep a watchlist with all five statuses, log
episode progress, rate titles on a 1–10 scale, write private notes, and view
statistics generated from your own recorded data.

Kaze is deliberately **not** a social network or a streaming service. There are
no public profiles, comments, messaging or feeds.

## Stack

- **Next.js 16** (App Router, React 19, Server Components, Proxy)
- **TypeScript** with `strict` and `noUncheckedIndexedAccess`
- **Tailwind CSS 4** with a CSS-variable design system
- **AniList GraphQL API** for anime metadata (no API key required)
- **Supabase** Postgres + Auth for accounts and personal library data
- **Zod** for runtime validation
- **Vitest** for unit and integration-style tests
- **next/font** (Inter + Sora), `next/image`
- PWA manifest, generated PNG icons and a static-only service worker

## Getting started

```bash
npm install
cp .env.example .env.local
# fill in the Supabase values described below
npm run dev
```

Open <http://localhost:3000>.

Discovery, search and anime details work **without** Supabase credentials, using
the public AniList API. Sign-in, saving to a library, statistics and settings
require Supabase. The login screen shows a setup notice when it is missing.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for accounts | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for accounts | Publishable/anon key. Never use a secret or service-role key in a `NEXT_PUBLIC_` variable. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public origin used for metadata and auth email links, e.g. `https://kaze.example.com`. |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Server-only secret key used to persist public catalogue metadata in `catalog_cache`. Never expose it with a `NEXT_PUBLIC_` name. Without it the catalogue cache is in-memory only. |

`.env.example` contains placeholders only. Real credentials are never committed.

## Supabase setup

1. Create a project at <https://supabase.com>.
2. Copy the Project URL and the **publishable (anon)** key from
   **Project Settings → API** into `.env.local`.
3. Apply the migrations in `supabase/migrations/` (library tables and the
   shared `catalog_cache` table). Either:
   - paste the files into the Supabase SQL editor and run them in order, or
   - use the Supabase CLI: `supabase link --project-ref <ref>` then
     `supabase db push`.
4. In **Authentication → Providers → Email**, keep email/password enabled.
   Decide whether email confirmation is required. Kaze handles both cases:
   - confirmation enabled → the user sees a “confirm your email” notice;
   - confirmation disabled → the user is signed in immediately.
5. In **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` for local development, or your
     production origin.
   - **Redirect URLs**: add
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/callback?next=/auth/reset`
     - `https://<your-domain>/auth/callback`
     - `https://<your-domain>/auth/callback?next=/auth/reset`

   The callback route supports both the PKCE `code` flow and the
   `token_hash` email-template flow. Password recovery emails redirect to
   `/auth/callback?next=/auth/reset`, which exchanges the link and then asks for
   a new password.
6. Optional: customize confirmation and recovery email templates in Supabase.
   If you use `{{ .TokenHash }}` links, point them at
   `/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset`.

### Database model and security

`public.user_anime` stores one row per `(user_id, anilist_id)`:

- UUID primary key, `user_id` references `auth.users(id)` with cascade delete.
- Constrained status: `watching`, `completed`, `planning`, `on_hold`, `dropped`.
- Nonnegative progress; score between 1 and 10; notes up to 5000 characters.
- Unique `(user_id, anilist_id)` prevents duplicates even under concurrent adds.
- Row Level Security is **enabled and forced**. Select, insert, update and delete
  policies all require `auth.uid() = user_id`. Anonymous access is revoked.
- Indexes on `(user_id, status)` and `(user_id, updated_at desc)`.
- `updated_at` is maintained by a trigger.

All application writes go through the repository layer in
`repositories/library.ts`, which also handles optimistic duplication races by
returning the row that won the unique constraint. The browser only ever holds
the publishable key; RLS is the authorization boundary.

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (Next core-web-vitals + TypeScript)
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit/integration tests
npm run icons      # regenerate PWA/app icons from scripts/generate-icons.mjs

# Responsive + signed-out flow QA against a running production server:
#   npm run build && PORT=3100 npm run start
#   QA_BASE_URL=http://localhost:3100 npm run qa:responsive
```

## Architecture

```text
app/
  (app)/                 authenticated/public app shell (sidebar, mobile nav)
    page.tsx             home dashboard
    discover/            search + filters (server-rendered first page)
    library/             personal library (protected)
    anime/[id]/          anime details (public)
    stats/               statistics (protected)
    settings/            account, theme, display, export (protected)
  api/anime/search/      validated server proxy for AniList search
  api/library/           add, update and remove library entries
  auth/callback/         Supabase email link exchange
  auth/reset/            new-password screen
  login/                 sign in / sign up / forgot password
components/              shared UI (shell, poster card, controls, dialogs)
features/anime/          discover browser, details actions
features/library/        provider, hydration, cards, list, dialogs
features/stats/          pure statistics calculation and view
features/settings/       settings screen and exports
services/anilist/        GraphQL documents, schemas, mapping, client, circuit breaker
services/catalog/        catalogue fallback, metadata cache, Kitsu client
repositories/            library store + repository rules
lib/supabase/            browser/server clients and config
lib/validation/          Zod schemas shared by UI and API routes
types/                   internal domain models
supabase/migrations/     SQL schema, constraints, RLS policies
tests/                   Vitest suites
```

### AniList service layer

`services/anilist/client.ts`:

- requests only the fields the UI uses;
- validates every response with Zod and maps it into the internal domain model;
- bounds and caches requests in-memory (search 60s, lists 5min, details 10min,
  LRU capped at 250 entries);
- deduplicates concurrent identical queries;
- retries only transient failures (network errors, timeouts, HTTP 429 and
  5xx) within a bounded policy: two retries, exponential backoff, and an
  overall 8s sleeping budget;
- honours `Retry-After` exactly (both delay-seconds and HTTP-date forms). If
  the requested delay exceeds the request's budget it returns the rate-limit
  error immediately so a later request retries instead of holding the
  connection open;
- never retries a confirmed suspension or HTTP 403, and never retries
  non-retryable 4xx client errors;
- records one failure per request (not per retry) and keeps the circuit
  breaker's half-open state to a single probe request;
- handles GraphQL errors, invalid JSON, missing media and malformed entries;
- skips individual unreadable entries a page while failing loudly if an entire
  page is unusable;
- defaults missing/unknown episode counts to `null` — progress is never bounded
  by fabricated totals.

The client only talks to AniList. Provider fallback lives in
`services/catalog/catalog-service.ts`, so a Kitsu or cached response is never
reported as if it came from AniList.

### Catalogue outage resilience

`services/catalog/` coordinates every catalogue read:

- **AniList** is the primary provider while its circuit is closed.
- **Fresh cache** is served without a provider request when it is still valid.
- **Stale cache** is served only during an outage and is always flagged as a
  fallback (`CatalogResult.meta.stale` / `.degraded`), never presented as live
  data.
- Every read returns a `CatalogResult` whose `meta.provider` records the
  source that actually answered that operation (AniList, Kitsu, cache or
  unavailable). Provider attribution is request-scoped, so concurrent requests
  cannot relabel each other's responses; upstream health is reported separately
  through `CatalogService.getHealth()`.
- **Kitsu** is used only when a verified `anilist/anime` mapping exists. A
  missing or ambiguous mapping never produces a guessed AniList ID, and Kitsu
  IDs are never stored in library records.
- **Unavailable** is a first-class state: the API returns 503 with a clear
  message instead of a fake empty result set.

`services/catalog/metadata-cache.ts` models three states explicitly:

| Kind | Fresh | Stale fallback kept |
| --- | --- | --- |
| summaries | 12h | +30 days |
| details | 6h | +30 days |
| popular / trending | 30m | +7 days |
| seasonal | 6h | +30 days |

After the stale window the entry is deleted. Entries are bounded in memory
(2,000 summaries, 300 details, 48 collections) with oldest-first eviction, so
the cache cannot grow without limit. Corrupt or incomplete persisted records
are dropped and logged instead of being served.

Cache contents are public provider metadata only. User-owned library entries
and episode progress are never written to the catalogue cache.

#### Cache persistence

When `SUPABASE_SERVICE_ROLE_KEY` is configured, the cache hydrates from and
persists to the `public.catalog_cache` table through a server-only Supabase
client. The table is logically separate from `user_anime` and
`user_anime_episodes`, has RLS enabled with no policies for `anon` or
`authenticated`, and only the service role can read or write it.

Limitations to be explicit about:

- There is **no filesystem persistence**. Vercel serverless functions have an
  ephemeral, per-instance filesystem, so writing `.cache/catalog` there is not
  durable. The previous file-based cache has been removed and any leftover
  `.cache/catalog` files are no longer read.
- Without the service-role key the cache is **in-memory and best-effort**. It
  improves behaviour within a warm instance but is not shared across instances
  or regions and is lost on cold starts.
- Persistence writes are batched and best-effort. A failed cache write is
  logged and never fails the catalogue request; the data still serves from
  memory for that instance.
- The airing schedule has no safe cached substitute and reports an unavailable
  state during an outage. Library, ratings, notes and episode progress keep
  working because they live in Supabase.

The browser never calls AniList directly for search: `/api/anime/search`
validates filters with Zod, applies caching headers, and converts failures into
useful 400/429/503 responses. Details and home sections are rendered on the
server through the same client.

Current season is calculated at request time from the UTC calendar quarter
(Winter Jan–Mar, Spring Apr–Jun, Summer Jul–Sep, Fall Oct–Dec).

### Library behavior

- One entry per user per anime, enforced by the unique constraint and repository.
- Status changes preserve progress, rating and notes.
- Completing an entry fills progress to the known episode count; reversing
  completion clears `completed_at` and preserves progress.
- Progress cannot be negative and cannot exceed a known episode count. Unknown
  totals remain editable.
- Notes are saved explicitly and trimmed; blank notes become `null`.
- Removing an entry asks for confirmation because it permanently deletes notes
  and history.
- A failed AniList lookup does not hide library entries. They render with an
  explicit “metadata unavailable” state and remain editable/removable.
- Export to JSON or CSV from Settings includes all entries and metadata status.

### Statistics

`features/stats/calculate-stats.ts` derives totals only from recorded data:
status counts, episodes logged, rating distribution/average, genre distribution,
and counts of unknown episode totals / missing metadata. It does **not** estimate
watch time, streaks or historical trends.

## Responsive and accessibility notes

- Desktop: fixed sidebar, multi-column poster grid, filter toolbar.
- Mobile: safe-area-aware bottom navigation, two-column poster grid, filter and
  quick-action bottom sheets, sticky compact header. No horizontal overflow.
- Dialogs use native `<dialog>` semantics with Escape/backdrop close, focus
  management and body scroll locking.
- Consistent focus-visible styling, labelled icon buttons, `aria-live` result
  and toast regions, `prefers-reduced-motion` support, and AA-oriented contrast.
- Light and dark themes are both designed, with a system-following option.

## PWA

- `app/manifest.ts` serves `/manifest.webmanifest` with 192/512/maskable icons.
- `scripts/generate-icons.mjs` produces the PNG icons without extra dependencies.
- `public/sw.js` caches only hashed build assets, icons and the manifest.
  Navigations, `/api/*` and `/auth/*` are always network-only, so personal
  library data is never cached for another user.
- Installation is available in supported browsers when served over HTTPS
  (or localhost). Full offline editing and background sync are intentionally
  out of scope.

## Deployment (Vercel)

1. Push the repository to GitHub and import it into Vercel.
2. Add the environment variables from `.env.example` to Production and Preview.
   Set `NEXT_PUBLIC_SITE_URL` to the production origin. Add
   `SUPABASE_SERVICE_ROLE_KEY` if you want the shared durable catalogue cache.
3. Run the Supabase migrations against the production project, including
   `20261021000000_create_catalog_cache.sql`.
4. Add the production origin and `/auth/callback` URLs to Supabase Auth redirect
   URLs.
5. Deploy. `next build` is the build command; no separate backend is required.

No cache directory or writable volume is required on Vercel.

### Verifying the catalogue cache in production

These checks require project access and are not performed automatically:

- [ ] Both migrations are applied, including
  `20261021000000_create_catalog_cache.sql`.
- [ ] `select relrowsecurity, relforcerowsecurity from pg_class where relname = 'catalog_cache';`
  returns `true, true`.
- [ ] `select * from pg_policies where tablename = 'catalog_cache';` returns no
  rows (service role only).
- [ ] A request to `/rest/v1/catalog_cache?select=key` using the publishable key
  is rejected, while the service role can read the table.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set for server runtimes only, is not a
  `NEXT_PUBLIC_*` variable, and does not appear in client bundles or logs.
- [ ] After a warm catalogue request, `catalog_cache` contains rows whose
  `payload` only has public metadata fields (no user id, rating, notes or
  progress).
- [ ] Removing `SUPABASE_SERVICE_ROLE_KEY` keeps the catalogue working with
  per-instance in-memory caching.
6. Verify `/manifest.webmanifest`, `/icons/*`, sign-in, and a library update in
   the deployed environment.

## Verification performed

Automated checks, all run against this repository:

```text
npm run typecheck     # passed
npm run lint          # passed, no errors or warnings
npm test              # 7 files, 74 tests passed
npm run build         # production build passed (all routes compiled)
npm run qa:responsive # 25 checks passed against a production server
```

Unit and integration coverage includes AniList response mapping (missing
metadata, malformed entries, spoiler tags, non-anime relations), client caching
and request deduplication, pagination bounds, 429/5xx retry with `Retry-After`,
GraphQL errors, missing-media handling, library creation and duplicate
prevention, concurrent insert races, status transitions, completion reversal,
progress validation, repository scoping and removal, statistics, season
calculation, search-parameter serialization, and score/notes validation.

`npm run qa:responsive` drives an installed Chrome over the DevTools protocol
against a running production build. It verified, with live AniList data:

- No horizontal overflow and no clipped content at 320, 390, 768, 1024 and
  1440 px on `/`, `/discover`, `/anime/[id]` and `/login` (20 checks).
- The desktop sidebar appears from 1024 px and the mobile bottom navigation
  below it; the login screen correctly has neither.
- Debounced search updates the URL and results (`cards=4`, first result
  “Cowboy Bebop”), and an impossible query renders the empty state.
- Adding anime while signed out routes to `/login?next=/discover` instead of
  failing silently.
- Anime details render community metadata, related anime and a sign-in action
  linking back to the same title.
- The light theme variables apply (content background `#f7f6fb`) and keep the
  layout inside the viewport.

The script retries once after an AniList rate-limit window and reports
`SKIP` for those checks rather than counting a rate-limited environment as a
pass.

### Not verified here

- No live Supabase project credentials were available in this environment, so
  real sign-in, email delivery, cross-device synchronization and RLS isolation
  were not exercised end-to-end at runtime. The schema, policies and repository
  behavior are covered by `supabase/migrations/20261018000000_create_user_anime.sql`
  and the repository tests, and `/library` was confirmed to redirect to
  `/login?next=%2Flibrary`, but a credentialed run of the checklist below is
  still required before release.
- No Playwright/Cypress suite is configured; `scripts/qa-responsive.mjs` covers
  layout and the signed-out flows only because the authenticated flows need test
  credentials.
- PWA install prompts and offline behavior vary by browser and require an HTTPS
  deployment to test fully.

## Manual QA checklist

1. Search for an anime on `/discover`; type quickly and confirm stale requests
   are aborted and results settle on the final query.
2. Apply genre/format/season/year/sort filters and reload the URL.
3. Open a title, add it with a status, change status, log an episode, rate it,
   save notes, refresh and confirm persistence.
4. Complete a title and verify progress fills to the known episode count; revert
   the status and confirm progress and rating survive.
5. Sign in on a second browser and confirm the same library appears.
6. With a second account, confirm the first account’s library is inaccessible.
7. Test at 320px, 768px, 1024px and 1440px widths: no horizontal scroll, bottom
   navigation clears content, dialogs fit, posters remain readable.
8. Toggle light/dark/system themes and reload.
9. Export JSON and CSV, and verify entries with unavailable metadata are present.
10. In production, install the PWA and reopen it; confirm HTML/API responses are
    not served from cache.

## Scope and limitations

- No public profiles, comments, messaging, social graph or comments.
- No streaming links, playback or torrent integration.
- No watch-time estimation or fabricated history.
- The title-language display preference applies to client-rendered poster cards;
  server-rendered detail headings use the English title with romaji fallback.
- AniList availability and rate limits affect discovery; errors are surfaced with
  retry actions and never replaced with mock data.
- AniList metadata is community-maintained; unknown episode counts are treated as
  unknown rather than guessed.
