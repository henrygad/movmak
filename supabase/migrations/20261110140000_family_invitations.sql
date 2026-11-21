create table private.family_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  household_id uuid not null,
  invited_by_membership_id uuid not null,
  full_name text not null,
  email text not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by_membership_id uuid,
  delivery_status text not null default 'created' check (delivery_status in ('created', 'requested', 'sent', 'failed', 'accepted')),
  delivery_error_code text,
  created_at timestamptz not null default clock_timestamp(),
  constraint family_invitations_household_fk foreign key (household_id, organization_id)
    references public.residential_households(id, organization_id) on delete restrict,
  constraint family_invitations_inviter_fk foreign key (invited_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint family_invitations_acceptor_fk foreign key (accepted_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint family_invitations_name_length check (char_length(btrim(full_name)) between 2 and 160),
  constraint family_invitations_email_normalized check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  constraint family_invitations_expiry check (expires_at > created_at and expires_at <= created_at + interval '14 days'),
  constraint family_invitations_terminal_state check (not (revoked_at is not null and accepted_at is not null)),
  constraint family_invitations_acceptance_consistent check (
    (accepted_at is null and accepted_by_membership_id is null)
    or (accepted_at is not null and accepted_by_membership_id is not null and delivery_status = 'accepted')
  )
);

create unique index family_invitations_one_live_email
  on private.family_invitations(household_id, email)
  where revoked_at is null and accepted_at is null;

create table private.family_invitation_delivery_attempts (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references private.family_invitations(id) on delete restrict,
  requested_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  status text not null check (status in ('requested', 'sent', 'failed')),
  provider_code text
);

alter table private.family_invitations enable row level security;
alter table private.family_invitations force row level security;
alter table private.family_invitation_delivery_attempts enable row level security;
alter table private.family_invitation_delivery_attempts force row level security;
revoke all on private.family_invitations from public, anon, authenticated, service_role;
revoke all on private.family_invitation_delivery_attempts from public, anon, authenticated, service_role;

create function public.create_family_invitation(
  p_full_name text,
  p_email text,
  p_token_hash bytea,
  p_expires_at timestamptz
)
returns table (invitation_id uuid, household_id uuid)
language plpgsql security definer set search_path = '' as $$
declare actor record; household record; created_id uuid;
begin
  select membership.id, membership.organization_id, membership.user_id into actor
  from public.organization_memberships membership
  join public.user_profiles profile on profile.user_id = membership.user_id
  where membership.user_id = (select auth.uid()) and membership.role = 'host'
    and membership.status = 'active' and profile.phone_verified_at is not null;
  if not found then raise exception 'family invitation is not permitted' using errcode = '42501'; end if;
  select h.* into household from public.residential_households h
  where h.primary_membership_id = actor.id and h.organization_id = actor.organization_id and h.status = 'active';
  if not found then raise exception 'an active primary household is required'; end if;
  p_full_name := btrim(p_full_name); p_email := lower(btrim(p_email));
  if char_length(p_full_name) not between 2 and 160 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'family invitation details are invalid'; end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then raise exception 'family invitation credential is invalid'; end if;
  if p_expires_at <= clock_timestamp() or p_expires_at > clock_timestamp() + interval '14 days' then raise exception 'family invitation expiry is invalid'; end if;
  if exists (
    select 1 from public.organization_memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = actor.organization_id and lower(u.email) = p_email and m.status <> 'revoked'
  ) then raise exception 'this person already belongs to the organization'; end if;
  insert into private.family_invitations(organization_id, household_id, invited_by_membership_id, full_name, email, token_hash, expires_at)
  values(actor.organization_id, household.id, actor.id, p_full_name, p_email, p_token_hash, p_expires_at)
  returning id into created_id;
  perform private.write_audit_event(actor.organization_id, 'family.invitation_created', 'family_invitations', created_id, 'authenticated_user', actor.id, jsonb_build_object('household_id', household.id));
  return query select created_id, household.id;
end;
$$;

create function public.mark_family_invitation_delivery(
  p_invitation_id uuid,
  p_status text,
  p_provider_code text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare invitation record;
begin
  if auth.role() <> 'service_role' then raise exception 'service role is required' using errcode = '42501'; end if;
  if p_status not in ('requested', 'sent', 'failed') then raise exception 'delivery status is invalid'; end if;
  select * into invitation from private.family_invitations where id = p_invitation_id for update;
  if not found or invitation.accepted_at is not null or invitation.revoked_at is not null then return false; end if;
  insert into private.family_invitation_delivery_attempts(invitation_id, completed_at, status, provider_code)
  values(invitation.id, case when p_status in ('sent', 'failed') then clock_timestamp() else null end, p_status, left(p_provider_code, 80));
  update private.family_invitations set delivery_status = p_status, delivery_error_code = case when p_status = 'failed' then left(p_provider_code, 80) else null end where id = invitation.id;
  return true;
end;
$$;

create function public.list_my_family_invitations()
returns table (invitation_id uuid, full_name text, email text, status text, expires_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select invitation.id, invitation.full_name, invitation.email,
    case when invitation.accepted_at is not null then 'accepted'
      when invitation.revoked_at is not null then 'revoked'
      when invitation.expires_at <= statement_timestamp() then 'expired'
      else invitation.delivery_status end,
    invitation.expires_at, invitation.created_at
  from private.family_invitations invitation
  join public.organization_memberships actor on actor.id = invitation.invited_by_membership_id
  where actor.user_id = (select auth.uid()) and actor.status = 'active'
  order by invitation.created_at desc limit 100;
$$;

create function public.revoke_family_invitation(p_invitation_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor record; invitation record;
begin
  select id, organization_id into actor from public.organization_memberships where user_id = (select auth.uid()) and role = 'host' and status = 'active';
  if not found then raise exception 'family invitation is not permitted' using errcode = '42501'; end if;
  update private.family_invitations set revoked_at = clock_timestamp()
  where id = p_invitation_id and organization_id = actor.organization_id and invited_by_membership_id = actor.id and revoked_at is null and accepted_at is null
  returning * into invitation;
  if not found then return false; end if;
  perform private.write_audit_event(actor.organization_id, 'family.invitation_revoked', 'family_invitations', invitation.id, 'authenticated_user', actor.id);
  return true;
end;
$$;

create function public.accept_family_invitation(p_token_hash bytea)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_user record; invitation record; household record; membership_id uuid;
begin
  select id, lower(email) as email, email_confirmed_at, phone, phone_confirmed_at into actor_user from auth.users where id = (select auth.uid());
  if not found or actor_user.email_confirmed_at is null or actor_user.phone_confirmed_at is null then raise exception 'verified email and phone are required' using errcode = '42501'; end if;
  select * into invitation from private.family_invitations where token_hash = p_token_hash for update;
  if not found or invitation.revoked_at is not null or invitation.accepted_at is not null or invitation.expires_at <= clock_timestamp() then raise exception 'family invitation is invalid or unavailable'; end if;
  if actor_user.email <> invitation.email then raise exception 'sign in with the invited email address' using errcode = '42501'; end if;
  if exists(select 1 from public.organization_memberships where user_id = actor_user.id) then raise exception 'this account already has an organization membership'; end if;
  select * into household from public.residential_households where id = invitation.household_id and organization_id = invitation.organization_id and status = 'active' for update;
  if not found or not exists(select 1 from public.organization_memberships where id = household.primary_membership_id and status = 'active') then raise exception 'the primary household is not eligible'; end if;
  update public.user_profiles set
    full_name = invitation.full_name, phone = actor_user.phone,
    verified_phone_e164 = actor_user.phone, phone_verified_at = actor_user.phone_confirmed_at,
    resident_status = 'household_member', property_status = household.property_status,
    area_zone = household.area_zone, house_number = household.house_number,
    flat_unit = household.flat_unit,
    address = concat_ws(', ', household.house_number, household.flat_unit, household.area_zone),
    occupancy_type = household.property_status
  where user_id = actor_user.id;
  insert into public.organization_memberships(organization_id, user_id, role, status, created_by_user_id, approved_at, approved_by_membership_id)
  values(invitation.organization_id, actor_user.id, 'host', 'active', (select user_id from public.organization_memberships where id = household.primary_membership_id), clock_timestamp(), household.primary_membership_id)
  returning id into membership_id;
  insert into public.residential_household_members(organization_id, household_id, membership_id, member_kind)
  values(invitation.organization_id, household.id, membership_id, 'member');
  update private.family_invitations set accepted_at = clock_timestamp(), accepted_by_membership_id = membership_id, delivery_status = 'accepted' where id = invitation.id;
  perform private.write_audit_event(invitation.organization_id, 'family.invitation_accepted', 'family_invitations', invitation.id, 'authenticated_user', membership_id, jsonb_build_object('household_id', household.id));
  return membership_id;
end;
$$;

revoke all on function public.create_family_invitation(text, text, bytea, timestamptz) from public, anon, service_role;
grant execute on function public.create_family_invitation(text, text, bytea, timestamptz) to authenticated;
revoke all on function public.list_my_family_invitations() from public, anon, service_role;
grant execute on function public.list_my_family_invitations() to authenticated;
revoke all on function public.revoke_family_invitation(uuid) from public, anon, service_role;
grant execute on function public.revoke_family_invitation(uuid) to authenticated;
revoke all on function public.accept_family_invitation(bytea) from public, anon, service_role;
grant execute on function public.accept_family_invitation(bytea) to authenticated;
revoke all on function public.mark_family_invitation_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mark_family_invitation_delivery(uuid, text, text) to service_role;
