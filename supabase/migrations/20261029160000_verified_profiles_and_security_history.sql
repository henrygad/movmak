begin;

alter table public.user_profiles
  add column occupancy_type text,
  add column profile_photo_path text,
  add constraint user_profiles_occupancy_type_valid
    check (occupancy_type is null or occupancy_type in ('landlord', 'tenant')),
  add constraint user_profiles_profile_photo_path_valid
    check (profile_photo_path is null or profile_photo_path ~ '^[0-9a-f-]{36}/profile$');

alter table private.organization_membership_requests
  add column location_verified_at timestamptz,
  add column location_verified_by_membership_id uuid,
  add constraint membership_requests_location_verifier_fk
    foreign key (location_verified_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  add constraint membership_requests_location_verification_consistent check (
    (location_verified_at is null and location_verified_by_membership_id is null)
    or (requested_role = 'host' and location_verified_at is not null and location_verified_by_membership_id is not null)
  );

alter table public.organization_memberships
  add column location_verified_at timestamptz,
  add column location_verified_by_membership_id uuid,
  add column approved_at timestamptz,
  add column approved_by_membership_id uuid,
  add constraint organization_memberships_location_verifier_fk
    foreign key (location_verified_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  add constraint organization_memberships_approver_fk
    foreign key (approved_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  add constraint organization_memberships_location_verification_consistent check (
    (location_verified_at is null and location_verified_by_membership_id is null)
    or (role = 'host' and location_verified_at is not null and location_verified_by_membership_id is not null)
  ),
  add constraint organization_memberships_approval_consistent check (
    (approved_at is null and approved_by_membership_id is null)
    or (approved_at is not null and approved_by_membership_id is not null)
  );

create index organization_membership_requests_pending_host_location_idx
  on private.organization_membership_requests(organization_id, location_verified_at, created_at)
  where status = 'pending' and requested_role = 'host';

create or replace function private.protect_profile_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'profile ownership is immutable';
  end if;

  new.full_name := nullif(pg_catalog.btrim(new.full_name), '');
  new.phone := nullif(pg_catalog.btrim(new.phone), '');
  new.address := nullif(pg_catalog.btrim(new.address), '');
  new.profile_photo_path := nullif(pg_catalog.btrim(new.profile_photo_path), '');
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function private.clear_changed_host_location_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.address is distinct from old.address
    or new.occupancy_type is distinct from old.occupancy_type then
    update private.organization_membership_requests
    set location_verified_at = null,
        location_verified_by_membership_id = null
    where user_id = new.user_id
      and requested_role = 'host'
      and status = 'pending';

    update public.organization_memberships
    set location_verified_at = null,
        location_verified_by_membership_id = null
    where user_id = new.user_id
      and role = 'host';
  end if;
  return new;
end;
$$;

create trigger user_profiles_clear_changed_host_location_verification
after update of address, occupancy_type on public.user_profiles
for each row execute function private.clear_changed_host_location_verification();

grant update (occupancy_type, profile_photo_path) on table public.user_profiles to authenticated;

create function public.list_pending_host_location_verifications()
returns table (
  request_id uuid,
  host_user_id uuid,
  full_name text,
  phone text,
  address text,
  occupancy_type text,
  profile_photo_path text,
  requested_at timestamptz,
  location_verified_at timestamptz,
  location_verified_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select membership.organization_id
    from public.organization_memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.role = 'security'
      and membership.status = 'active'
  )
  select request.id, request.user_id, profile.full_name, profile.phone,
    profile.address, profile.occupancy_type, profile.profile_photo_path,
    request.created_at, request.location_verified_at, verifier_profile.full_name
  from private.organization_membership_requests as request
  join actor on actor.organization_id = request.organization_id
  left join public.user_profiles as profile on profile.user_id = request.user_id
  left join public.organization_memberships as verifier
    on verifier.id = request.location_verified_by_membership_id
   and verifier.organization_id = request.organization_id
  left join public.user_profiles as verifier_profile on verifier_profile.user_id = verifier.user_id
  where request.status = 'pending' and request.requested_role = 'host'
  order by request.created_at;
$$;

create function public.verify_pending_host_location(
  p_request_id uuid,
  p_address text,
  p_occupancy_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  target record;
begin
  select membership.id, membership.organization_id
  into actor
  from public.organization_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.role = 'security'
    and membership.status = 'active'
  for update;
  if not found then
    raise exception 'location verification is not permitted' using errcode = '42501';
  end if;

  p_address := pg_catalog.btrim(p_address);
  p_occupancy_type := pg_catalog.lower(pg_catalog.btrim(p_occupancy_type));
  if p_address is null or pg_catalog.char_length(p_address) not between 5 and 300 then
    raise exception 'host address is invalid';
  end if;
  if p_occupancy_type is null or p_occupancy_type not in ('landlord', 'tenant') then
    raise exception 'host occupancy type is invalid';
  end if;

  select request.id, request.user_id
  into target
  from private.organization_membership_requests as request
  where request.id = p_request_id
    and request.organization_id = actor.organization_id
    and request.requested_role = 'host'
    and request.status = 'pending'
  for update;
  if not found then
    raise exception 'host location request is not available';
  end if;

  update public.user_profiles
  set address = p_address,
      occupancy_type = p_occupancy_type
  where user_id = target.user_id;
  if not found then
    raise exception 'host profile is not available';
  end if;

  update private.organization_membership_requests
  set location_verified_at = clock_timestamp(),
      location_verified_by_membership_id = actor.id
  where id = target.id;

  perform private.write_audit_event(
    actor.organization_id,
    'membership.host_location_verified',
    'organization_membership_requests',
    target.id,
    'authenticated_user',
    actor.id,
    pg_catalog.jsonb_build_object('occupancy_type', p_occupancy_type)
  );
  return true;
end;
$$;

create function public.get_pending_member_review_details()
returns table (
  request_id uuid,
  full_name text,
  phone text,
  address text,
  occupancy_type text,
  profile_photo_path text,
  location_verified_at timestamptz,
  location_verified_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select membership.organization_id
    from public.organization_memberships as membership
    where membership.user_id = (select auth.uid())
      and membership.role = 'admin'
      and membership.status = 'active'
  )
  select request.id, profile.full_name, profile.phone, profile.address,
    profile.occupancy_type, profile.profile_photo_path,
    request.location_verified_at, verifier_profile.full_name
  from private.organization_membership_requests as request
  join actor on actor.organization_id = request.organization_id
  left join public.user_profiles as profile on profile.user_id = request.user_id
  left join public.organization_memberships as verifier
    on verifier.id = request.location_verified_by_membership_id
   and verifier.organization_id = request.organization_id
  left join public.user_profiles as verifier_profile on verifier_profile.user_id = verifier.user_id
  where request.status = 'pending'
  order by request.created_at;
$$;

create or replace function public.review_organization_membership_request(
  p_request_id uuid,
  p_decision text,
  p_assigned_role public.organization_role
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  target record;
  target_profile record;
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
    select full_name, phone, address, occupancy_type into target_profile
    from public.user_profiles where user_id = target.user_id;
    if not found or target_profile.full_name is null or target_profile.phone is null then
      raise exception 'member profile requires a full name and phone number';
    end if;
    if target.requested_role = 'host' and (
      target_profile.address is null
      or target_profile.occupancy_type is null
      or target.location_verified_at is null
      or target.location_verified_by_membership_id is null
    ) then
      raise exception 'host location must be verified before approval';
    end if;

    insert into public.organization_memberships(
      organization_id, user_id, role, status, created_by_user_id,
      location_verified_at, location_verified_by_membership_id,
      approved_at, approved_by_membership_id
    ) values(
      actor.organization_id, target.user_id, target.requested_role, 'active', actor.user_id,
      case when target.requested_role = 'host' then target.location_verified_at else null end,
      case when target.requested_role = 'host' then target.location_verified_by_membership_id else null end,
      clock_timestamp(), actor.id
    );
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
    pg_catalog.jsonb_build_object(
      'assigned_role', case when p_decision = 'approve' then target.requested_role else null end,
      'location_verified_by_membership_id', case when target.requested_role = 'host' then target.location_verified_by_membership_id else null end
    )
  );
  return true;
end;
$$;

create function private.can_view_profile_photo(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())::text or exists (
    select 1
    from public.organization_memberships as viewer
    where viewer.user_id = (select auth.uid())
      and viewer.status = 'active'
      and viewer.role in ('admin', 'security')
      and (
        exists (
          select 1 from public.organization_memberships as target
          where target.user_id::text = p_user_id
            and target.organization_id = viewer.organization_id
        )
        or exists (
          select 1 from private.organization_membership_requests as request
          where request.user_id::text = p_user_id
            and request.organization_id = viewer.organization_id
            and request.status = 'pending'
        )
      )
  );
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('member-profile-photos', 'member-profile-photos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy member_profile_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'member-profile-photos'
  and private.can_view_profile_photo((storage.foldername(name))[1])
);

create policy member_profile_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'member-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/profile'
);

create policy member_profile_photos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'member-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/profile'
)
with check (
  bucket_id = 'member-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name = (select auth.uid())::text || '/profile'
);

create or replace function public.issue_host_credentials(
  p_invitation_token_hash bytea,
  p_host_code_hash bytea
)
returns table (invitation_expires_at timestamptz, host_code_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_membership record;
  issued_at timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'authentication is required'; end if;
  if p_invitation_token_hash is null or p_host_code_hash is null
    or pg_catalog.octet_length(p_invitation_token_hash) <> 32
    or pg_catalog.octet_length(p_host_code_hash) <> 32 then
    raise exception 'credential input is invalid';
  end if;

  select membership.id, membership.organization_id into actor_membership
  from public.organization_memberships as membership
  join public.user_profiles as profile on profile.user_id = membership.user_id
    and profile.full_name is not null
    and profile.phone is not null
    and profile.address is not null
    and profile.occupancy_type is not null
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'host'
    and membership.location_verified_at is not null
    and membership.location_verified_by_membership_id is not null
  for update of membership;
  if not found then raise exception 'verified host profile is required before issuing credentials'; end if;

  issued_at := clock_timestamp();
  if (select pg_catalog.count(*) from public.invitation_credentials
      where host_membership_id = actor_membership.id
        and created_at > issued_at - interval '1 minute') >= 5
    or (select pg_catalog.count(*) from public.invitation_credentials
      where host_membership_id = actor_membership.id
        and created_at > issued_at - interval '1 hour') >= 60 then
    raise exception 'host credential issuance is rate limited';
  end if;

  update public.invitation_credentials set revoked_at = issued_at
  where organization_id = actor_membership.organization_id
    and host_membership_id = actor_membership.id
    and consumed_at is null and revoked_at is null and expires_at > issued_at;
  update public.host_verification_codes set revoked_at = issued_at
  where organization_id = actor_membership.organization_id
    and host_membership_id = actor_membership.id
    and revoked_at is null and expires_at > issued_at;
  insert into public.invitation_credentials(
    organization_id, host_membership_id, token_hash, valid_from, expires_at,
    created_by_membership_id, created_at
  ) values (
    actor_membership.organization_id, actor_membership.id, p_invitation_token_hash,
    issued_at, issued_at + interval '5 minutes', actor_membership.id, issued_at
  );
  insert into public.host_verification_codes(
    organization_id, host_membership_id, code_hash, valid_from, expires_at,
    created_by_membership_id, created_at
  ) values (
    actor_membership.organization_id, actor_membership.id, p_host_code_hash,
    issued_at, issued_at + interval '5 minutes', actor_membership.id, issued_at
  );
  return query select issued_at + interval '5 minutes', issued_at + interval '5 minutes';
end;
$$;

create function public.list_security_visit_history(p_status public.visit_status default null)
returns table (
  visit_id uuid,
  visit_reference text,
  visitor_name text,
  visitor_phone text,
  host_name text,
  host_phone text,
  host_address text,
  purpose text,
  group_size smallint,
  visit_status public.visit_status,
  registered_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select membership.organization_id, auth_user.created_at as account_created_at
    from public.organization_memberships as membership
    join auth.users as auth_user on auth_user.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and membership.role = 'security'
      and membership.status = 'active'
  )
  select visit.id, visit.visit_reference, visitor.full_name, visitor.phone,
    coalesce(host_profile.full_name, 'Organization host'), host_profile.phone,
    host_profile.address, visit.purpose, visit.group_size, visit.status,
    visit.registered_at, visit.checked_in_at, visit.checked_out_at
  from actor
  join public.visits as visit
    on visit.organization_id = actor.organization_id
   and visit.registered_at >= actor.account_created_at
  join public.visitors as visitor
    on visitor.id = visit.visitor_id and visitor.organization_id = visit.organization_id
  join public.organization_memberships as host
    on host.id = visit.host_membership_id and host.organization_id = visit.organization_id
  left join public.user_profiles as host_profile on host_profile.user_id = host.user_id
  where p_status is null or visit.status = p_status
  order by visit.registered_at desc
  limit 500;
$$;

create function public.get_authorized_visit_detail(p_visit_id uuid)
returns table (
  visit_id uuid,
  visit_reference text,
  visitor_name text,
  visitor_phone text,
  host_name text,
  host_phone text,
  host_address text,
  host_occupancy_type text,
  purpose text,
  group_size smallint,
  entry_method public.visit_entry_method,
  visit_status public.visit_status,
  registered_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checked_in_by_name text,
  checked_out_by_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select membership.organization_id, membership.role, auth_user.created_at as account_created_at
    from public.organization_memberships as membership
    join auth.users as auth_user on auth_user.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('admin', 'security')
  )
  select visit.id, visit.visit_reference, visitor.full_name, visitor.phone,
    coalesce(host_profile.full_name, 'Organization host'), host_profile.phone,
    host_profile.address, host_profile.occupancy_type, visit.purpose, visit.group_size,
    visit.entry_method, visit.status, visit.registered_at, visit.checked_in_at,
    visit.checked_out_at, checkin_profile.full_name, checkout_profile.full_name
  from actor
  join public.visits as visit
    on visit.organization_id = actor.organization_id
   and (actor.role = 'admin' or visit.registered_at >= actor.account_created_at)
  join public.visitors as visitor
    on visitor.id = visit.visitor_id and visitor.organization_id = visit.organization_id
  join public.organization_memberships as host
    on host.id = visit.host_membership_id and host.organization_id = visit.organization_id
  left join public.user_profiles as host_profile on host_profile.user_id = host.user_id
  left join public.organization_memberships as checkin_actor
    on checkin_actor.id = visit.checked_in_by_membership_id
   and checkin_actor.organization_id = visit.organization_id
  left join public.user_profiles as checkin_profile on checkin_profile.user_id = checkin_actor.user_id
  left join public.organization_memberships as checkout_actor
    on checkout_actor.id = visit.checked_out_by_membership_id
   and checkout_actor.organization_id = visit.organization_id
  left join public.user_profiles as checkout_profile on checkout_profile.user_id = checkout_actor.user_id
  where visit.id = p_visit_id;
$$;

revoke all on function public.list_pending_host_location_verifications() from public, anon, service_role;
revoke all on function public.verify_pending_host_location(uuid, text, text) from public, anon, service_role;
revoke all on function public.get_pending_member_review_details() from public, anon, service_role;
revoke all on function private.can_view_profile_photo(text) from public, anon, service_role;
revoke all on function public.list_security_visit_history(public.visit_status) from public, anon, service_role;
revoke all on function public.get_authorized_visit_detail(uuid) from public, anon, service_role;

grant execute on function public.list_pending_host_location_verifications() to authenticated;
grant execute on function public.verify_pending_host_location(uuid, text, text) to authenticated;
grant execute on function public.get_pending_member_review_details() to authenticated;
grant execute on function private.can_view_profile_photo(text) to authenticated;
grant execute on function public.list_security_visit_history(public.visit_status) to authenticated;
grant execute on function public.get_authorized_visit_detail(uuid) to authenticated;

comment on column public.host_verification_codes.code_hash is
  'Server-peppered HMAC-SHA-256 of the four-digit temporary host code; raw codes are never stored.';
comment on column public.host_code_attempts.code_fingerprint is
  'Server-peppered fingerprint used to match four-digit host-code attempts; never stores the raw code.';

commit;
