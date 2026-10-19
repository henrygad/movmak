begin;

create table private.organization_join_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  default_role public.organization_role not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  rotated_from_id uuid references private.organization_join_links(id) on delete restrict,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  check (expires_at > created_at)
);

create index organization_join_links_org_created_idx
  on private.organization_join_links(organization_id, created_at desc);

create table private.organization_membership_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  join_link_id uuid not null references private.organization_join_links(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_role public.organization_role not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (reviewed_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  check ((status = 'pending' and reviewed_by_membership_id is null and reviewed_at is null)
    or (status in ('approved', 'rejected') and reviewed_by_membership_id is not null and reviewed_at is not null))
);

create unique index organization_membership_requests_one_pending_per_user
  on private.organization_membership_requests(user_id) where status = 'pending';
create index organization_membership_requests_org_status_idx
  on private.organization_membership_requests(organization_id, status, created_at);

alter table private.organization_join_links enable row level security;
alter table private.organization_join_links force row level security;
alter table private.organization_membership_requests enable row level security;
alter table private.organization_membership_requests force row level security;
revoke all on private.organization_join_links from public, anon, authenticated, service_role;
revoke all on private.organization_membership_requests from public, anon, authenticated, service_role;

create function public.create_organization_join_link(
  p_default_role public.organization_role, p_token_hash bytea, p_expires_at timestamptz
) returns table (join_link_id uuid, join_link_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor record; created_id uuid;
begin
  select id, organization_id into actor from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'join link management is not permitted' using errcode = '42501'; end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then raise exception 'join link credential is invalid'; end if;
  if p_expires_at <= statement_timestamp() or p_expires_at > statement_timestamp() + interval '30 days' then raise exception 'join link expiry is invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.organization_id::text, 1));
  if (select count(*) from private.organization_join_links where organization_id = actor.organization_id and created_at > statement_timestamp() - interval '1 hour') >= 10 then
    raise exception 'join link rate limit exceeded';
  end if;
  insert into private.organization_join_links(organization_id, default_role, token_hash, expires_at, created_by_membership_id)
  values(actor.organization_id, p_default_role, p_token_hash, p_expires_at, actor.id) returning id into created_id;
  perform private.write_audit_event(actor.organization_id, 'membership.join_link_created', 'organization_join_links', created_id, 'authenticated_user', actor.id, jsonb_build_object('role', p_default_role, 'expires_at', p_expires_at));
  return query select created_id, p_expires_at;
end; $$;

create function public.rotate_organization_join_link(
  p_join_link_id uuid, p_token_hash bytea, p_expires_at timestamptz
) returns table (join_link_id uuid, join_link_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor record; old_link record; created_id uuid;
begin
  select id, organization_id into actor from public.organization_memberships where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'join link management is not permitted' using errcode = '42501'; end if;
  select * into old_link from private.organization_join_links where id = p_join_link_id and organization_id = actor.organization_id for update;
  if not found or old_link.revoked_at is not null then raise exception 'join link is not available'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.organization_id::text, 1));
  if (select count(*) from private.organization_join_links where organization_id = actor.organization_id and created_at > statement_timestamp() - interval '1 hour') >= 10 then raise exception 'join link rate limit exceeded'; end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then raise exception 'join link credential is invalid'; end if;
  if p_expires_at <= statement_timestamp() or p_expires_at > statement_timestamp() + interval '30 days' then raise exception 'join link expiry is invalid'; end if;
  update private.organization_join_links set revoked_at = clock_timestamp() where id = old_link.id;
  insert into private.organization_join_links(organization_id, default_role, token_hash, expires_at, rotated_from_id, created_by_membership_id)
  values(actor.organization_id, old_link.default_role, p_token_hash, p_expires_at, old_link.id, actor.id) returning id into created_id;
  perform private.write_audit_event(actor.organization_id, 'membership.join_link_rotated', 'organization_join_links', created_id, 'authenticated_user', actor.id, jsonb_build_object('rotated_from_id', old_link.id));
  return query select created_id, p_expires_at;
end; $$;

create function public.revoke_organization_join_link(p_join_link_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor record;
begin
  select id, organization_id into actor from public.organization_memberships where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'join link management is not permitted' using errcode = '42501'; end if;
  update private.organization_join_links set revoked_at = clock_timestamp() where id = p_join_link_id and organization_id = actor.organization_id and revoked_at is null;
  if not found then return false; end if;
  perform private.write_audit_event(actor.organization_id, 'membership.join_link_revoked', 'organization_join_links', p_join_link_id, 'authenticated_user', actor.id);
  return true;
end; $$;

create function public.request_organization_membership(p_token_hash bytea)
returns table (request_id uuid, organization_id uuid, requested_role public.organization_role)
language plpgsql security definer set search_path = '' as $$
declare actor_user_id uuid := auth.uid(); link record; created_id uuid;
begin
  if actor_user_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then raise exception 'join link is invalid or unavailable'; end if;
  if not exists(select 1 from auth.users where id = actor_user_id and email_confirmed_at is not null) then raise exception 'a verified email is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_user_id::text, 0));
  if exists(select 1 from public.organization_memberships where user_id = actor_user_id) then raise exception 'membership request is not available'; end if;
  if exists(select 1 from private.organization_membership_requests where user_id = actor_user_id and status = 'pending') then raise exception 'a membership request is already pending'; end if;
  select * into link from private.organization_join_links where token_hash = p_token_hash and revoked_at is null and expires_at > clock_timestamp() for share;
  if not found then raise exception 'join link is invalid or unavailable'; end if;
  insert into private.organization_membership_requests(organization_id, join_link_id, user_id, requested_role)
  values(link.organization_id, link.id, actor_user_id, link.default_role) returning id into created_id;
  -- The requester has no organization membership yet. The existing audit
  -- constraint therefore requires a system actor, with auth.uid() captured in
  -- immutable event data rather than a forged membership actor.
  perform private.write_audit_event(link.organization_id, 'membership.requested', 'organization_membership_requests', created_id, 'system', null, jsonb_build_object('requester_user_id', actor_user_id, 'requested_role', link.default_role));
  return query select created_id, link.organization_id, link.default_role;
end; $$;

create function public.list_organization_join_access()
returns table (record_type text, record_id uuid, display_name text, email_verified boolean, role public.organization_role, status text, expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with actor as (select organization_id from public.organization_memberships where user_id = (select auth.uid()) and role = 'admin' and status = 'active')
  select 'link', l.id, null::text, false, l.default_role,
    case when l.revoked_at is not null then 'revoked' when l.expires_at <= statement_timestamp() then 'expired' else 'active' end,
    l.expires_at, l.created_at from private.organization_join_links l join actor a using (organization_id)
  union all
  select 'request', r.id, coalesce(p.full_name, 'Organization user'), u.email_confirmed_at is not null, r.requested_role, r.status, null, r.created_at
  from private.organization_membership_requests r join actor a using (organization_id)
  join auth.users u on u.id = r.user_id left join public.user_profiles p on p.user_id = r.user_id
  order by created_at desc limit 200;
$$;

create function public.review_organization_membership_request(p_request_id uuid, p_decision text, p_assigned_role public.organization_role)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor record; target record;
begin
  select id, organization_id, user_id into actor from public.organization_memberships where user_id = (select auth.uid()) and role = 'admin' and status = 'active' for update;
  if not found then raise exception 'membership approval is not permitted' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'reject') then raise exception 'membership decision is invalid'; end if;
  select * into target from private.organization_membership_requests where id = p_request_id and organization_id = actor.organization_id and status = 'pending' for update;
  if not found then raise exception 'membership request is not available'; end if;
  if target.user_id = actor.user_id then raise exception 'self approval is not permitted'; end if;
  if exists(select 1 from public.organization_memberships where user_id = target.user_id) then raise exception 'user already has an organization membership'; end if;
  if p_decision = 'approve' then
    insert into public.organization_memberships(organization_id, user_id, role, status, created_by_user_id)
    values(actor.organization_id, target.user_id, p_assigned_role, 'active', actor.user_id);
  end if;
  update private.organization_membership_requests set status = case when p_decision = 'approve' then 'approved' else 'rejected' end, reviewed_by_membership_id = actor.id, reviewed_at = clock_timestamp() where id = target.id;
  perform private.write_audit_event(actor.organization_id, case when p_decision = 'approve' then 'membership.request_approved' else 'membership.request_rejected' end, 'organization_membership_requests', target.id, 'authenticated_user', actor.id, jsonb_build_object('assigned_role', case when p_decision = 'approve' then p_assigned_role else null end));
  return true;
end; $$;

revoke all on function public.create_organization_join_link(public.organization_role, bytea, timestamptz) from public, anon, service_role;
revoke all on function public.rotate_organization_join_link(uuid, bytea, timestamptz) from public, anon, service_role;
revoke all on function public.revoke_organization_join_link(uuid) from public, anon, service_role;
revoke all on function public.request_organization_membership(bytea) from public, anon, service_role;
revoke all on function public.list_organization_join_access() from public, anon, service_role;
revoke all on function public.review_organization_membership_request(uuid, text, public.organization_role) from public, anon, service_role;
grant execute on function public.create_organization_join_link(public.organization_role, bytea, timestamptz) to authenticated;
grant execute on function public.rotate_organization_join_link(uuid, bytea, timestamptz) to authenticated;
grant execute on function public.revoke_organization_join_link(uuid) to authenticated;
grant execute on function public.request_organization_membership(bytea) to authenticated;
grant execute on function public.list_organization_join_access() to authenticated;
grant execute on function public.review_organization_membership_request(uuid, text, public.organization_role) to authenticated;

-- Retire the earlier email-specific, immediate-activation workflow so it cannot
-- bypass administrator review after this migration is applied. Historical rows
-- remain intact for audit purposes.
revoke execute on function public.create_membership_invitation(uuid, text, public.organization_role, bytea, timestamptz) from authenticated;
revoke execute on function public.accept_membership_invitation(bytea) from authenticated;
revoke execute on function public.revoke_membership_invitation(uuid, uuid) from authenticated;

commit;
