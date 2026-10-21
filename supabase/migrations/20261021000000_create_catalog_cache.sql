-- Shared catalogue metadata cache.
--
-- Holds public AniList/Kitsu metadata only: titles, artwork URLs, format,
-- episode totals, scores, seasons and genres. It must never contain a user id,
-- library entry, watch status, score given by a user, notes, or episode
-- progress. User-owned data stays in public.user_anime and
-- public.user_anime_episodes.
--
-- Reads and writes happen exclusively from the server with the service-role
-- key. Row level security is enabled and forced with no policies for `anon` or
-- `authenticated`, so the browser can never read or poison this table.

create table if not exists public.catalog_cache (
  key text primary key,
  payload jsonb not null,
  cached_at timestamptz not null,
  fresh_until timestamptz not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint catalog_cache_key_length check (char_length(key) between 1 and 200),
  constraint catalog_cache_window_valid check (fresh_until <= expires_at)
);

create index if not exists catalog_cache_expires_idx
  on public.catalog_cache (expires_at);

alter table public.catalog_cache enable row level security;
alter table public.catalog_cache force row level security;

-- Intentionally no policies: only the service role (which bypasses RLS) may
-- access this table. Never grant access to anon or authenticated.
revoke all on public.catalog_cache from anon, authenticated;
grant select, insert, update, delete on public.catalog_cache to service_role;
