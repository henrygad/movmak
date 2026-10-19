begin;

create function public.list_active_hosts()
returns table (host_membership_id uuid, host_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select host.id, coalesce(profile.full_name, 'Organization host')
  from public.organization_memberships as actor
  join public.organization_memberships as host
    on host.organization_id = actor.organization_id
   and host.status = 'active'
   and host.role = 'host'
  left join public.user_profiles as profile on profile.user_id = host.user_id
  where actor.user_id = (select auth.uid())
    and actor.status = 'active'
    and actor.role = 'security'
  order by coalesce(profile.full_name, 'Organization host'), host.id;
$$;

create function public.preview_visit_by_qr(p_qr_token_hash bytea)
returns table (
  visit_id uuid,
  visit_reference text,
  visitor_name text,
  visitor_phone text,
  host_name text,
  purpose text,
  group_size smallint,
  visit_status public.visit_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_qr_token_hash is null or octet_length(p_qr_token_hash) <> 32 then
    return;
  end if;

  return query
  select
    visit.id,
    visit.visit_reference,
    visitor.full_name,
    visitor.phone,
    coalesce(profile.full_name, 'Organization host'),
    visit.purpose,
    visit.group_size,
    visit.status
  from public.visit_qr_credentials as qr
  join public.visits as visit on visit.id = qr.visit_id and visit.organization_id = qr.organization_id
  join public.visitors as visitor on visitor.id = visit.visitor_id and visitor.organization_id = visit.organization_id
  join public.organization_memberships as actor
    on actor.organization_id = visit.organization_id
   and actor.user_id = (select auth.uid())
   and actor.status = 'active'
   and actor.role = 'security'
  join public.organization_memberships as host on host.id = visit.host_membership_id and host.organization_id = visit.organization_id
  left join public.user_profiles as profile on profile.user_id = host.user_id
  where qr.token_hash = p_qr_token_hash
    and qr.revoked_at is null
    and (qr.expires_at is null or qr.expires_at > clock_timestamp())
    and visit.status in ('expected', 'inside');
end;
$$;

create function public.register_gate_visit(
  p_host_membership_id uuid,
  p_full_name text,
  p_phone text,
  p_phone_not_provided boolean,
  p_purpose text,
  p_group_size smallint,
  p_host_code_attempt_id bigint default null
)
returns table (registered_visit_id uuid, registered_visit_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  new_visitor_id uuid;
  new_visit_id uuid;
  new_reference text;
  selected_method public.visit_entry_method;
begin
  select membership.id, membership.organization_id
    into actor
  from public.organization_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'security'
  for update;

  if not found then raise exception 'gate operation is not permitted'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 160
    or p_purpose is null or char_length(btrim(p_purpose)) not between 2 and 500
    or p_group_size is null or p_group_size not between 1 and 100
    or p_phone_not_provided is null
    or (not p_phone_not_provided and (p_phone is null or char_length(btrim(p_phone)) not between 3 and 40)) then
    raise exception 'visitor details are invalid';
  end if;

  if not private.membership_has_role(p_host_membership_id, actor.organization_id, array['host'::public.organization_role]) then
    raise exception 'selected host is not available';
  end if;

  selected_method := case when p_host_code_attempt_id is null then 'direct_gate'::public.visit_entry_method else 'host_verified'::public.visit_entry_method end;

  insert into public.visitors (organization_id, full_name, phone, phone_not_provided, created_by_membership_id)
  values (actor.organization_id, btrim(p_full_name), case when p_phone_not_provided then null else btrim(p_phone) end, p_phone_not_provided, actor.id)
  returning id into new_visitor_id;

  insert into public.visits (
    organization_id, visitor_id, host_membership_id, entry_method, purpose,
    group_size, status, host_code_attempt_id, created_by_membership_id
  ) values (
    actor.organization_id, new_visitor_id, p_host_membership_id, selected_method,
    btrim(p_purpose), p_group_size, 'inside', p_host_code_attempt_id, actor.id
  ) returning id, visit_reference into new_visit_id, new_reference;

  return query select new_visit_id, new_reference;
end;
$$;

create function public.get_currently_inside()
returns table (
  visit_id uuid,
  visit_reference text,
  visitor_name text,
  host_name text,
  purpose text,
  group_size smallint,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select visit.id, visit.visit_reference, visitor.full_name,
    coalesce(profile.full_name, 'Organization host'), visit.purpose,
    visit.group_size, visit.checked_in_at
  from public.organization_memberships as actor
  join public.visits as visit on visit.organization_id = actor.organization_id and visit.status = 'inside'
  join public.visitors as visitor on visitor.id = visit.visitor_id and visitor.organization_id = visit.organization_id
  join public.organization_memberships as host on host.id = visit.host_membership_id and host.organization_id = visit.organization_id
  left join public.user_profiles as profile on profile.user_id = host.user_id
  where actor.user_id = (select auth.uid()) and actor.status = 'active' and actor.role = 'security'
  order by visit.checked_in_at desc;
$$;

revoke all on function public.list_active_hosts() from public, anon, service_role;
revoke all on function public.preview_visit_by_qr(bytea) from public, anon, service_role;
revoke all on function public.register_gate_visit(uuid, text, text, boolean, text, smallint, bigint) from public, anon, service_role;
revoke all on function public.get_currently_inside() from public, anon, service_role;
grant execute on function public.list_active_hosts() to authenticated;
grant execute on function public.preview_visit_by_qr(bytea) to authenticated;
grant execute on function public.register_gate_visit(uuid, text, text, boolean, text, smallint, bigint) to authenticated;
grant execute on function public.get_currently_inside() to authenticated;

commit;
