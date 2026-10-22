begin;

-- A bearer join link may reveal only its public-facing organization name and
-- intended role. The secret itself remains hashed in the private table.
create function public.preview_organization_join_link(p_token_hash bytea)
returns table (organization_name text, requested_role public.organization_role)
language sql stable security definer set search_path = '' as $$
  select o.name, l.default_role
  from private.organization_join_links l
  join public.organizations o on o.id = l.organization_id
  where p_token_hash is not null
    and octet_length(p_token_hash) = 32
    and l.token_hash = p_token_hash
    and l.revoked_at is null
    and l.expires_at > statement_timestamp()
  limit 1;
$$;

-- Applicants can see only their own request. They still receive no direct
-- access to the private request table or organization application data.
create function public.get_my_organization_join_request()
returns table (organization_name text, requested_role public.organization_role, request_status text)
language sql stable security definer set search_path = '' as $$
  select o.name, r.requested_role, r.status
  from private.organization_membership_requests r
  join public.organizations o on o.id = r.organization_id
  where r.user_id = (select auth.uid())
  order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc
  limit 1;
$$;

revoke all on function public.preview_organization_join_link(bytea) from public, anon, authenticated, service_role;
grant execute on function public.preview_organization_join_link(bytea) to anon, authenticated;
revoke all on function public.get_my_organization_join_request() from public, anon, authenticated, service_role;
grant execute on function public.get_my_organization_join_request() to authenticated;

-- Creating an organization must not bypass a pending member approval. The
-- advisory lock is the same per-user lock used by request_organization_membership.
create or replace function public.create_organization_with_admin(
  p_name text,
  p_slug text,
  p_timezone text default 'Africa/Lagos'
)
returns table (organization_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  created_organization_id uuid;
  created_membership_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text, 0)
  );

  if exists (
    select 1 from public.organization_memberships m
    where m.user_id = actor_user_id
  ) or exists (
    select 1 from private.organization_membership_requests r
    where r.user_id = actor_user_id and r.status = 'pending'
  ) then
    raise exception 'organization onboarding is not available';
  end if;

  p_name := pg_catalog.btrim(p_name);
  p_slug := pg_catalog.lower(pg_catalog.btrim(p_slug));
  p_timezone := pg_catalog.btrim(p_timezone);

  if p_name is null or pg_catalog.char_length(p_name) not between 2 and 160 then
    raise exception 'organization name is invalid';
  end if;
  if p_slug is null
    or pg_catalog.char_length(p_slug) not between 2 and 100
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'organization slug is invalid';
  end if;
  if p_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'organization timezone is invalid';
  end if;

  insert into public.organizations (name, slug, timezone, created_by_user_id)
  values (p_name, p_slug, p_timezone, actor_user_id)
  returning id into created_organization_id;

  insert into public.organization_memberships (
    organization_id, user_id, role, status, created_by_user_id
  ) values (
    created_organization_id, actor_user_id, 'admin', 'active', actor_user_id
  ) returning id into created_membership_id;

  return query select created_organization_id, created_membership_id;
end;
$$;

-- Replacing the function preserves its signature and existing ACL, but make
-- the intended grant explicit for a repeatable privilege review.
revoke all on function public.create_organization_with_admin(text, text, text)
  from public, anon, service_role;
grant execute on function public.create_organization_with_admin(text, text, text)
  to authenticated;

-- Approval must preserve the role cryptographically bound to the join link.
-- A browser or administrator cannot turn a host request into another role.
create or replace function public.review_organization_membership_request(
  p_request_id uuid,
  p_decision text,
  p_assigned_role public.organization_role
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor record; target record;
begin
  select id, organization_id, user_id into actor
  from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'admin' and status = 'active'
  for update;
  if not found then raise exception 'membership approval is not permitted' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'membership decision is invalid'; end if;

  select * into target
  from private.organization_membership_requests
  where id = p_request_id and organization_id = actor.organization_id and status = 'pending'
  for update;
  if not found then raise exception 'membership request is not available'; end if;
  if target.user_id = actor.user_id then raise exception 'self approval is not permitted'; end if;
  if exists(select 1 from public.organization_memberships where user_id = target.user_id) then
    raise exception 'user already has an organization membership';
  end if;
  if p_assigned_role is distinct from target.requested_role then
    raise exception 'assigned role must match the invitation role';
  end if;

  if p_decision = 'approve' then
    insert into public.organization_memberships(organization_id, user_id, role, status, created_by_user_id)
    values(actor.organization_id, target.user_id, target.requested_role, 'active', actor.user_id);
  end if;
  update private.organization_membership_requests
  set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
      reviewed_by_membership_id = actor.id,
      reviewed_at = clock_timestamp()
  where id = target.id;
  perform private.write_audit_event(
    actor.organization_id,
    case when p_decision = 'approve' then 'membership.request_approved' else 'membership.request_rejected' end,
    'organization_membership_requests', target.id, 'authenticated_user', actor.id,
    jsonb_build_object('assigned_role', case when p_decision = 'approve' then target.requested_role else null end)
  );
  return true;
end; $$;

revoke all on function public.review_organization_membership_request(uuid, text, public.organization_role)
  from public, anon, service_role;
grant execute on function public.review_organization_membership_request(uuid, text, public.organization_role)
  to authenticated;

commit;
