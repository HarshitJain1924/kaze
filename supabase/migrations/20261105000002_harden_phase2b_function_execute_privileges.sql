-- Harden EXECUTE privileges for the Phase 2B functions.
--
-- 20261105000001 granted EXECUTE to service_role but inherited PostgreSQL's
-- implicit PUBLIC EXECUTE plus the project's default grants to anon and
-- authenticated. All four functions are SECURITY INVOKER with search_path = '',
-- so no data was reachable, but the ACL contradicted the documented
-- service_role-only contract.
--
-- Privileges only: no function bodies, SECURITY DEFINER, triggers, tables,
-- policies, defaults-in-other-schemas or data are changed.

-- 1. Operational functions: service_role only.
revoke execute on function public.backfill_phase2b(uuid)
  from public, anon, authenticated;
revoke execute on function public.validate_phase2b()
  from public, anon, authenticated;
revoke execute on function public.deterministic_anilist_media_id(integer)
  from public, anon, authenticated;

-- 2. Trigger function: owner only. EXECUTE on a trigger function is checked when
--    the trigger is created, not when it fires, so the ten existing triggers keep
--    working; it runs as the firing role and touches no tables.
revoke execute on function public.set_updated_at()
  from public, anon, authenticated, service_role;

-- 3. Preserve the intended operational grants.
grant execute on function public.backfill_phase2b(uuid) to service_role;
grant execute on function public.validate_phase2b() to service_role;
grant execute on function public.deterministic_anilist_media_id(integer) to service_role;

-- 4. Future functions created by the migration role.
--    PUBLIC can only be removed from the role's global default; a schema-scoped
--    REVOKE ... FROM PUBLIC is a documented no-op. anon/authenticated are removed
--    only in public, where their matching default grants exist.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- 5. Fail closed.
do $$
declare
  v_bad     text;
  v_public  oid;
  v_owner   oid;
  v_service oid;
  v_anon    oid;
  v_auth    oid;
begin
  select oid into v_public  from pg_namespace where nspname = 'public';
  select oid into v_owner   from pg_roles where rolname = 'postgres';
  select oid into v_service from pg_roles where rolname = 'service_role';
  select oid into v_anon    from pg_roles where rolname = 'anon';
  select oid into v_auth    from pg_roles where rolname = 'authenticated';

  if v_public is null or v_owner is null or v_service is null
     or v_anon is null or v_auth is null then
    raise exception 'expected schema/roles missing (public, postgres, service_role, anon, authenticated)';
  end if;

  -- (a) No effective EXECUTE for anon or authenticated on any of the four.
  select string_agg(p.proname || ' -> ' || r.rolname, ', ' order by p.proname, r.rolname)
    into v_bad
  from pg_proc p
  cross join (values ('anon'), ('authenticated')) as r(rolname)
  where p.pronamespace = v_public
    and p.proname in ('backfill_phase2b', 'validate_phase2b',
                      'deterministic_anilist_media_id', 'set_updated_at')
    and has_function_privilege(r.rolname, p.oid, 'execute');

  if v_bad is not null then
    raise exception 'EXECUTE still effective for non-service roles: %', v_bad;
  end if;

  -- (b) No PUBLIC grant remains in any of the four ACLs.
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.pronamespace = v_public
      and p.proname in ('backfill_phase2b', 'validate_phase2b',
                        'deterministic_anilist_media_id', 'set_updated_at')
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC still holds EXECUTE on a Phase 2B function';
  end if;

  -- (c) service_role must hold a DIRECT grant on the three operational functions.
  select string_agg(v.name, ', ' order by v.name)
    into v_bad
  from (values ('backfill_phase2b'), ('validate_phase2b'),
               ('deterministic_anilist_media_id')) as v(name)
  join pg_proc p
    on p.proname = v.name
   and p.pronamespace = v_public
  where not exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = v_service
      and a.privilege_type = 'EXECUTE'
  );

  if v_bad is not null then
    raise exception 'service_role lost direct EXECUTE on: %', v_bad;
  end if;

  -- (d) set_updated_at must not grant anything to service_role.
  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.pronamespace = v_public
      and p.proname = 'set_updated_at'
      and a.grantee = v_service
  ) then
    raise exception 'set_updated_at still grants service_role';
  end if;

  -- (e) Ownership and owner EXECUTE intact.
  select string_agg(p.proname, ', ' order by p.proname)
    into v_bad
  from pg_proc p
  where p.pronamespace = v_public
    and p.proname in ('backfill_phase2b', 'validate_phase2b',
                      'deterministic_anilist_media_id', 'set_updated_at')
    and (p.proowner <> v_owner
         or not has_function_privilege('postgres', p.oid, 'execute'));

  if v_bad is not null then
    raise exception 'owner privileges changed for: %', v_bad;
  end if;

  -- (f) Default privileges for functions created by postgres, read from
  --     pg_default_acl only (independent of the four current ACLs).
  if exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole = v_owner
      and d.defaclobjtype = 'f'
      and d.defaclnamespace in (0, v_public)
      and a.privilege_type = 'EXECUTE'
      and a.grantee in (0, v_anon, v_auth)
  ) then
    raise exception 'function defaults still grant EXECUTE to PUBLIC/anon/authenticated';
  end if;

  -- (g) Where the project's public-schema default row exists, it must still grant
  --     service_role. Skipped on plain PostgreSQL (local harness) where the row
  --     does not exist and the revoke above is a no-op.
  if exists (
    select 1 from pg_default_acl d
    where d.defaclrole = v_owner
      and d.defaclnamespace = v_public
      and d.defaclobjtype = 'f'
  ) and not exists (
    select 1
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclrole = v_owner
      and d.defaclnamespace = v_public
      and d.defaclobjtype = 'f'
      and a.privilege_type = 'EXECUTE'
      and a.grantee = v_service
  ) then
    raise exception 'public-schema default privileges lost service_role EXECUTE';
  end if;
end
$$;
