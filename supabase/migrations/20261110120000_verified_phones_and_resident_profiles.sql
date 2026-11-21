-- Phone trust comes only from auth.users.phone_confirmed_at. New resident and
-- security memberships require it; existing memberships are not deactivated.

alter table public.user_profiles
  add column verified_phone_e164 text,
  add column phone_verified_at timestamptz,
  add column resident_status text,
  add column property_status text,
  add column area_zone text,
  add column house_number text,
  add column flat_unit text;

alter table public.user_profiles
  add constraint user_profiles_verified_phone_format check (
    verified_phone_e164 is null or verified_phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'
  ) not valid,
  add constraint user_profiles_phone_verification_consistent check (
    (verified_phone_e164 is null and phone_verified_at is null)
    or (verified_phone_e164 is not null and phone_verified_at is not null)
  ) not valid,
  add constraint user_profiles_resident_status_check check (
    resident_status is null or resident_status in ('primary', 'household_member')
  ) not valid,
  add constraint user_profiles_property_status_check check (
    property_status is null or property_status in ('landlord', 'tenant')
  ) not valid,
  add constraint user_profiles_structured_address_lengths check (
    (area_zone is null or char_length(btrim(area_zone)) between 2 and 120)
    and (house_number is null or char_length(btrim(house_number)) between 1 and 80)
    and (flat_unit is null or char_length(btrim(flat_unit)) between 1 and 80)
  ) not valid;

create function public.sync_my_verified_phone()
returns text language plpgsql security definer set search_path = '' as $$
declare actor_user_id uuid := auth.uid(); trusted_phone text; verified_at timestamptz;
begin
  if actor_user_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  select phone, phone_confirmed_at into trusted_phone, verified_at from auth.users where id = actor_user_id;
  if trusted_phone is null or verified_at is null or trusted_phone !~ '^\\+[1-9][0-9]{7,14}$' then
    raise exception 'a Supabase Auth verified phone is required' using errcode = '42501';
  end if;
  update public.user_profiles
  set phone = trusted_phone, verified_phone_e164 = trusted_phone, phone_verified_at = verified_at
  where user_id = actor_user_id;
  if not found then raise exception 'profile is unavailable'; end if;
  return trusted_phone;
end;
$$;

create function private.require_verified_phone_for_new_operational_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role in ('host', 'security') and new.status = 'active' and not exists (
    select 1 from auth.users where id = new.user_id and phone_confirmed_at is not null
      and phone ~ '^\\+[1-9][0-9]{7,14}$'
  ) then
    raise exception 'a verified phone is required before resident or security approval' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger organization_memberships_require_verified_phone
before insert on public.organization_memberships
for each row execute function private.require_verified_phone_for_new_operational_member();

revoke all on function public.sync_my_verified_phone() from public, anon, service_role;
grant execute on function public.sync_my_verified_phone() to authenticated;
revoke all on function private.require_verified_phone_for_new_operational_member() from public, anon, authenticated, service_role;

comment on function public.sync_my_verified_phone() is
  'Copies a phone to the profile only after re-reading Supabase Auth phone_confirmed_at. Browser-supplied verification state is ignored.';
