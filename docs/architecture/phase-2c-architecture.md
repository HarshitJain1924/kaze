# Phase 2C Architecture Decision Record

- Status: Frozen architecture; implementation not authorized.
- Baseline: 03f09f49 on main.

This is the authoritative Phase 2C implementation contract. It does not
authorize migrations, application changes, database execution, staging,
production access, or canonical-read cutover.

## Authority and repository evidence

Legacy public.user_anime and public.user_anime_episodes are the sole
user-state authority. Canonical public.user_media and
public.user_media_episodes are projections. Canonical-to-legacy writes are
prohibited. Application reads remain legacy-backed until separately approved
canonical-read cutover.

Verified source evidence:

- supabase/migrations/20261018000000_create_user_anime.sql:5-28
- supabase/migrations/20261018000001_create_user_anime_episodes.sql:5-18
- supabase/migrations/20261105000000_create_canonical_media_schema.sql:1-5
- repositories/library.ts:129-340
- app/api/library/route.ts:10-34
- app/api/library/[anilistId]/route.ts:28-117
- app/api/library/[anilistId]/episodes/route.ts:55-140
- features/library/load-library.ts:29-45
- types/library.ts:20-53
- tests/media-migrations-pg.integration.test.ts:591-617

The current repository still performs direct legacy reads/writes and current
migrations grant authenticated direct DML. These are implementation starting
facts, not approved Phase 2C behavior.

## Coordination and projection state

phase2c_entry_coordination has:

~~~text
user_id uuid not null
anilist_id integer not null
generation bigint not null
deleted boolean not null
source_revision bigint not null
lifecycle_version bigint not null
progress_version bigint not null
score_version bigint not null
notes_version bigint not null
primary key (user_id, anilist_id)
foreign key (user_id) references auth.users(id) on delete cascade
~~~

phase2c_projection_state has:

~~~text
user_id uuid not null
anilist_id integer not null
generation bigint not null
projection_revision bigint not null
projected_deleted boolean not null
primary key (user_id, anilist_id)
foreign key (user_id) references auth.users(id) on delete cascade
~~~

Both rows survive entry deletion. Account deletion cascades from auth.users.
Runtime roles have no DELETE privilege or DELETE policy on either table.

Synchronization requires:

~~~text
C.generation = P.generation
C.deleted = P.projected_deleted
C.source_revision = P.projection_revision
~~~

It additionally requires the expected legacy and canonical parent/episode
presence and content. Any missing row, mismatch, stale revision, invalid
content, or unexpected presence is degraded. Every mutation rejects degraded
state; reconciliation repairs it.

## Generation and CAS

Every mutation receives expected_generation. The independent groups are:

- lifecycle: status, started_at, completed_at;
- progress: progress, volumes_progress;
- score: score;
- notes: notes.

media_type is immutable during Phase 2C.

Initial add with generation 0 creates generation 1, source revision 1, and
field-group versions all equal to 1. A narrow initial-create exception may
return an existing row only for an add whose coordination state is untouched
generation 1, live, source revision 1, whose projection is generation 1/live/
revision 1, and whose normalized payload matches exactly. The normalized
payload includes user, AniList ID, media type, initial status, zero progress,
null score, null notes, and status-derived dates. Generated IDs and timestamps
are excluded. A differing payload returns initial-add-conflict and cannot
overwrite the winner.

The exception expires after any state-changing mutation, not after a true
no-op. It cannot authorize a patch or re-add.

Re-add requires the current deleted generation and advances generation.
All other generation mismatches return stale-generation-conflict.

The client supplies the expected version and complete baseline for every
patched group:

- lifecycle: status, started_at, completed_at;
- progress: progress, volumes_progress;
- score: score, with JSON null representing SQL NULL;
- notes: notes, with JSON null representing SQL NULL.

Versions provide ABA protection. Baselines validate request construction and do
not replace version checks. Lifecycle dates are derived and are not
independently patchable. Any stale group rejects the entire mixed patch.
A current-token no-op changes nothing; a stale-token no-op returns conflict.

## Lock order

Every operation uses this total order:

~~~text
1. coordination rows
2. projection-state rows
3. legacy parent rows
4. legacy episode rows
5. canonical parent rows
6. canonical episode rows
~~~

Each level is sorted by user_id, anilist_id, and then episode_number where
applicable. First creation uses unique-key insert followed by FOR UPDATE.
Multi-entry operations acquire all coordination locks, then all
projection-state locks, before any lower-level lock. No path acquires a
control-row lock after a lower-level lock.

## Mutation and episode protocol

Add/re-add locks coordination, validates generation, locks projection state,
locks the legacy parent, and creates or returns the appropriate legacy entry.
It assigns revisions and projects canonical state in one transaction.

Parent patch locks coordination and projection state, validates generation,
versions, and baselines, locks legacy state, applies the patch, increments only
changed group versions, increments source revision if needed, projects, and
commits.

Delete locks all entry state, deletes legacy episodes and parent, advances
generation and source revision, marks coordination deleted, removes canonical
rows, marks projection deleted, and commits. Coordination and projection-state
rows are never deleted.

Episode operations are desired-state commands. They lock entry state and the
legacy parent, apply desired episode state, recompute the parent, compare
pre/post fields, update revisions, project parent and episodes, and commit.
Episode-row changes advance source_revision even if derived parent fields do
not. Field versions advance only when their fields change. Repeated desired
state is a no-op.

Any projection failure rolls back the complete mutation.

## Authenticated read contracts

public.phase2c_read_library is a SECURITY DEFINER, STABLE SQL function with
SET search_path = ''. Its body is one SQL statement reading legacy parents,
legacy episodes, coordination state, and projection state from one statement
snapshot. Identity comes only from auth.uid(); null identity is rejected.

It returns one envelope:

~~~text
{
  libraryStatus: ready | bootstrap_pending | degraded,
  entries: [
    {
      entry: legacy-authoritative entry,
      cas: generation and four field versions, or null,
      watchedEpisodes: [],
      projectionStatus: synchronized | degraded | bootstrap_pending
    }
  ]
}
~~~

An empty library returns ready with an empty entries array. Entries without
episodes return an empty array. Mixed entry statuses are allowed. Missing
coordination returns null tokens and bootstrap_pending; tokens are never
fabricated.

public.phase2c_read_entry_state(anilist_id) is an authenticated,
legacy-backed SECURITY DEFINER lookup returning only:

~~~text
never_seen | live | deleted | bootstrap_pending | degraded
~~~

Live results include generation and field versions. Deleted results include
the deleted generation. Neither read RPC exposes raw control rows or
cross-user data. Exact composite return types are an implementation detail
that must preserve these fields and semantics.

## Retry and projection health

Patch retries with old versions conflict; the client refetches and accepts
success only if intended values already exist. Delete and re-add retries with
old generations conflict; the entry-state lookup distinguishes deleted,
live/re-added, never-seen, and degraded states. Initial-add retries use only
the untouched-generation-1 exception. Episode retries are desired-state
idempotent.

An entry is synchronized only when coordination and projection generations,
deleted states, and revisions match and physical/content checks pass. A live
entry with projection_revision zero or any other mismatch is degraded:

- legacy-backed reads remain available and report degraded;
- user mutations are rejected;
- reconciliation retries projection;
- failed repair leaves source and projection revisions unchanged;
- successful repair advances projection state only after canonical writes commit.

## Reconciliation

Per-entry reconciliation uses READ COMMITTED and locks:

~~~text
coordination
→ projection state
→ legacy parent
→ legacy episodes
→ canonical parent
→ canonical episodes
~~~

The authoritative legacy read occurs after legacy locks.

Legacy-backed entries without coordination require bootstrap. Canonical-only
entries without coordination are quarantined, not treated as deleted. Live
coordination with a live parent is projected. Live coordination with an absent
parent is an invariant violation and is retained/quarantined. Deleted
coordination with an absent parent is reconciled to canonical absence.
Deleted coordination with a live parent is an invariant violation.

Mismatch evidence is committed in a separate service-only issue transaction
before repair. Repair success resolves the issue and advances projection
revision only after commit. Failed repair leaves durable unresolved evidence
and degraded state.

Full reconciliation uses a REPEATABLE READ candidate enumeration, then
READ COMMITTED per-entry decisions. It unions legacy keys, coordination keys,
and canonical keys with unambiguous AniList mappings that are representable by
legacy anime/manga state. Movie/TV, unmappable, and ambiguous canonical-only
rows are retained and quarantined. A pass cannot claim global completeness
while unrestricted writes continue.

## Security, grants, and cutover

phase2c_api_owner and phase2c_reconcile_owner are dedicated non-login,
non-superuser, non-BYPASSRLS roles with no application or administrative role
membership.

User read and mutation RPCs are SECURITY DEFINER, owned by
phase2c_api_owner, with SET search_path = '' and fully qualified names. The
API owner receives SELECT/INSERT/UPDATE/DELETE on legacy and canonical user
tables, SELECT/INSERT/UPDATE on coordination and projection state, SELECT on
media mappings, and required auth-helper EXECUTE. It has no control-row DELETE.

The reconciliation gateway is SECURITY DEFINER, owned by
phase2c_reconcile_owner, executable only by service_role. It validates the
service request role through an auth helper; it does not compare current_user
to service_role because current_user is the definer owner. Private helpers are
owner-only and outside exposed API schemas. The reconciliation owner receives
legacy SELECT only, canonical DML, control SELECT/INSERT/UPDATE, and media
mapping SELECT. It receives no legacy or catalogue DML.

All relevant tables use RLS and FORCE ROW LEVEL SECURITY with explicit role
targets:

- authenticated: own-row legacy SELECT only;
- phase2c_api_owner: own-row legacy/canonical/control access using
  auth.uid() = user_id, without control DELETE;
- phase2c_reconcile_owner: cross-user legacy SELECT, canonical DML, and
  control SELECT/INSERT/UPDATE, without control DELETE;
- anon: no policies or grants;
- service_role: no direct Phase 2C table grants.

RLS policies do not grant SQL privileges. The actual migration/schema owner
must be verified before changing default function privileges; current
repository SQL references postgres, which is intent evidence rather than
staging proof.

## Bootstrap and atomic cutover

1. Complete Phase 2B staging execution and verification.
2. Deploy additive Phase 2C schema and functions.
3. Disable old application and worker writes.
4. Drain in-flight requests and transactions.
5. Verify no old writer sessions or queued writers remain.
6. Acquire ACCESS EXCLUSIVE locks deterministically: user_anime, then
   user_anime_episodes.
7. Initialize entries and projections.
8. Verify bootstrap completeness while locks remain held.
9. Revoke direct DML and apply RPC grants in the same transaction.
10. Commit.
11. Verify effective privileges and failed direct writes.
12. Enable RPC-only traffic.

The locks conflict with ordinary INSERT/UPDATE/DELETE RowExclusiveLock
behavior but do not replace writer drain.

## Rollback boundaries

Before Phase 2C, additive canonical objects may be removed after confirming no
canonical-only data or consumers depend on them; legacy data remains intact.

During Phase 2C, legacy remains authoritative. Rollback disables projection
writers; canonical projections may be rebuilt from legacy or removed under an
approved maintenance procedure. No rollback may write canonical data back into
legacy tables.

After separately approved canonical-read cutover, rollback requires preserving
canonical-only state and an explicit retention/conversion plan. It is not
automatically lossless for movie/TV state the legacy schema cannot represent.

## Testing and staging evidence

Real PostgreSQL two-session tests are required for simultaneous adds, stale
CAS/delete/re-add retries, ABA, desired-state episode retries, source revision
changes, projection-state creation, reconciliation races, absent-parent cases,
canonical-only retention, read snapshots versus concurrent mutations,
revision-zero repair, bootstrap versus old writers, queued-writer drain,
effective table/function privileges, role membership, FORCE RLS,
SECURITY DEFINER helper/service validation, projection rollback, deadlocks, and
serialization retries.

PGlite validates SQL shape and single-session behavior only. It cannot prove
these concurrency, pooling, privilege, or Supabase-role guarantees.

## Unresolved implementation details

The exact composite return types, issue-ledger shape and reason vocabulary,
SQLSTATE-to-API mapping, migration filenames/order, and staging harness are
implementation details. They must preserve this record and be verified before
production approval.

## Authorization boundary

This record authorizes documentation only. It does not authorize
implementation, migration execution, staging or Supabase operations,
production access, canonical-read cutover, branch changes, or commits.
Production remains untouched until separate implementation, staging-evidence,
and rollout approval is issued.
