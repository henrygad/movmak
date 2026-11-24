create function public.update_my_primary_resident_profile(
  p_full_name text,
  p_property_status text,
  p_area_zone text,
  p_house_number text,
  p_flat_unit text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    where membership.user_id = actor_user_id
      and membership.role = 'host'
      and membership.status = 'active'
    union all
    select 1
    from private.organization_membership_requests as request
    where request.user_id = actor_user_id
      and request.requested_role = 'host'
      and request.status = 'pending'
  ) then
    raise exception 'resident profile update is not permitted' using errcode = '42501';
  end if;

  p_full_name := nullif(pg_catalog.btrim(p_full_name), '');
  p_property_status := nullif(pg_catalog.btrim(p_property_status), '');
  p_area_zone := nullif(pg_catalog.btrim(p_area_zone), '');
  p_house_number := nullif(pg_catalog.btrim(p_house_number), '');
  p_flat_unit := nullif(pg_catalog.btrim(p_flat_unit), '');

  if p_full_name is null or pg_catalog.char_length(p_full_name) not between 2 and 160 then
    raise exception 'resident name is invalid';
  end if;
  if p_property_status is null or p_property_status not in ('landlord', 'tenant') then
    raise exception 'resident property status is invalid';
  end if;
  if p_area_zone is null or pg_catalog.char_length(p_area_zone) not between 2 and 120 then
    raise exception 'resident area or zone is invalid';
  end if;
  if p_house_number is null or pg_catalog.char_length(p_house_number) not between 1 and 80 then
    raise exception 'resident house number is invalid';
  end if;
  if p_flat_unit is not null and pg_catalog.char_length(p_flat_unit) > 80 then
    raise exception 'resident flat or unit is invalid';
  end if;

  update public.user_profiles
  set full_name = p_full_name,
      address = pg_catalog.concat_ws(', ', p_house_number, p_flat_unit, p_area_zone),
      occupancy_type = p_property_status,
      resident_status = 'primary',
      property_status = p_property_status,
      area_zone = p_area_zone,
      house_number = p_house_number,
      flat_unit = p_flat_unit
  where user_id = actor_user_id
    and resident_status is distinct from 'household_member';

  if not found then
    raise exception 'primary resident profile is unavailable' using errcode = '42501';
  end if;

  return true;
end;
$$;

revoke all on function public.update_my_primary_resident_profile(text, text, text, text, text)
  from public, anon, service_role;
grant execute on function public.update_my_primary_resident_profile(text, text, text, text, text)
  to authenticated;

comment on function public.update_my_primary_resident_profile(text, text, text, text, text) is
  'Updates only the authenticated primary resident profile after server-side role and input validation.';
