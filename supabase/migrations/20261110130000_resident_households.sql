create table public.residential_households (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  area_zone text not null,
  house_number text not null,
  flat_unit text,
  property_status text not null check (property_status in ('landlord', 'tenant')),
  primary_membership_id uuid not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  suspended_at timestamptz,
  suspended_by_membership_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint residential_households_id_org_unique unique (id, organization_id),
  constraint residential_households_primary_unique unique (primary_membership_id),
  constraint residential_households_primary_fk foreign key (primary_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint residential_households_suspender_fk foreign key (suspended_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint residential_households_address_lengths check (
    char_length(btrim(area_zone)) between 2 and 120
    and char_length(btrim(house_number)) between 1 and 80
    and (flat_unit is null or char_length(btrim(flat_unit)) between 1 and 80)
  ),
  constraint residential_households_suspension_consistent check (
    (status = 'active' and suspended_at is null and suspended_by_membership_id is null)
    or (status = 'suspended' and suspended_at is not null and suspended_by_membership_id is not null)
  )
);

create table public.residential_household_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  household_id uuid not null,
  membership_id uuid not null,
  member_kind text not null check (member_kind in ('primary', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  joined_at timestamptz not null default clock_timestamp(),
  suspended_at timestamptz,
  removed_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  constraint residential_household_members_household_fk foreign key (household_id, organization_id)
    references public.residential_households(id, organization_id) on delete restrict,
  constraint residential_household_members_membership_fk foreign key (membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint residential_household_members_one_membership unique (membership_id),
  constraint residential_household_members_state_consistent check (
    (status = 'active' and suspended_at is null and removed_at is null)
    or (status = 'suspended' and suspended_at is not null and removed_at is null)
    or (status = 'removed' and removed_at is not null)
  )
);

create unique index residential_household_members_one_primary
  on public.residential_household_members(household_id) where member_kind = 'primary' and status <> 'removed';
create index residential_households_org_address_idx
  on public.residential_households(organization_id, area_zone, house_number);

create function private.create_primary_household_after_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare profile record; household_id uuid;
begin
  if new.role <> 'host' or new.status <> 'active' then return new; end if;
  select resident_status, property_status, area_zone, house_number, flat_unit into profile
  from public.user_profiles where user_id = new.user_id;
  -- Legacy Hosts have null structured fields and are never auto-attached.
  if not found or profile.resident_status is distinct from 'primary' then return new; end if;
  if profile.property_status is null or profile.area_zone is null or profile.house_number is null then
    raise exception 'structured resident address is required before approval';
  end if;
  insert into public.residential_households(
    organization_id, area_zone, house_number, flat_unit, property_status, primary_membership_id
  ) values (
    new.organization_id, profile.area_zone, profile.house_number, profile.flat_unit,
    profile.property_status, new.id
  ) returning id into household_id;
  insert into public.residential_household_members(
    organization_id, household_id, membership_id, member_kind
  ) values (new.organization_id, household_id, new.id, 'primary');
  return new;
end;
$$;

create trigger organization_memberships_create_primary_household
after insert on public.organization_memberships
for each row execute function private.create_primary_household_after_approval();

alter table public.residential_households enable row level security;
alter table public.residential_households force row level security;
alter table public.residential_household_members enable row level security;
alter table public.residential_household_members force row level security;
revoke all on public.residential_households from public, anon;
revoke all on public.residential_household_members from public, anon;
grant select on public.residential_households to authenticated;
grant select on public.residential_household_members to authenticated;

create function private.can_view_residential_household(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.residential_households as household
    join public.organization_memberships as actor
      on actor.organization_id = household.organization_id
     and actor.user_id = (select auth.uid())
     and actor.status = 'active'
    where household.id = p_household_id
      and (
        actor.role = 'admin'
        or actor.id = household.primary_membership_id
        or exists (
          select 1
          from public.residential_household_members as household_member
          where household_member.household_id = household.id
            and household_member.membership_id = actor.id
            and household_member.status = 'active'
        )
      )
  );
$$;

create function private.can_view_residential_household_member(p_household_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.residential_household_members as household_member
    join public.residential_households as household
      on household.id = household_member.household_id
     and household.organization_id = household_member.organization_id
    join public.organization_memberships as actor
      on actor.organization_id = household_member.organization_id
     and actor.user_id = (select auth.uid())
     and actor.status = 'active'
    where household_member.id = p_household_member_id
      and (
        actor.role = 'admin'
        or actor.id = household_member.membership_id
        or actor.id = household.primary_membership_id
      )
  );
$$;

create policy residential_households_select_authorized on public.residential_households
for select to authenticated
using (private.can_view_residential_household(id));

create policy residential_household_members_select_authorized on public.residential_household_members
for select to authenticated
using (private.can_view_residential_household_member(id));

create function public.manage_residential_household(
  p_household_id uuid,
  p_action text,
  p_target_membership_id uuid default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor record; household record; target record;
begin
  select id, organization_id into actor from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'household management is not permitted' using errcode = '42501'; end if;
  select * into household from public.residential_households
  where id = p_household_id and organization_id = actor.organization_id for update;
  if not found then raise exception 'household is unavailable'; end if;

  if p_action = 'suspend_household' then
    update public.residential_households set status = 'suspended', suspended_at = clock_timestamp(), suspended_by_membership_id = actor.id, updated_at = clock_timestamp() where id = household.id;
    update public.organization_memberships set status = 'suspended' where id in (select membership_id from public.residential_household_members where household_id = household.id and status <> 'removed');
    update public.residential_household_members set status = 'suspended', suspended_at = clock_timestamp(), updated_at = clock_timestamp() where household_id = household.id and status = 'active';
  elsif p_action = 'restore_household' then
    update public.residential_households set status = 'active', suspended_at = null, suspended_by_membership_id = null, updated_at = clock_timestamp() where id = household.id;
    update public.organization_memberships set status = 'active' where id in (select membership_id from public.residential_household_members where household_id = household.id and status = 'suspended');
    update public.residential_household_members set status = 'active', suspended_at = null, updated_at = clock_timestamp() where household_id = household.id and status = 'suspended';
  elsif p_action in ('suspend_primary', 'suspend_member', 'restore_member') then
    select * into target from public.residential_household_members where household_id = household.id and membership_id = p_target_membership_id and status <> 'removed' for update;
    if not found then raise exception 'household member is unavailable'; end if;
    if p_action = 'suspend_primary' and target.member_kind <> 'primary' then raise exception 'target is not the primary resident'; end if;
    if p_action = 'suspend_member' and target.member_kind <> 'member' then raise exception 'target is not a household member'; end if;
    update public.organization_memberships set status = case when p_action = 'restore_member' then 'active'::public.membership_status else 'suspended'::public.membership_status end where id = target.membership_id;
    update public.residential_household_members set status = case when p_action = 'restore_member' then 'active' else 'suspended' end, suspended_at = case when p_action = 'restore_member' then null else clock_timestamp() end, updated_at = clock_timestamp() where id = target.id;
  elsif p_action = 'replace_primary' then
    select * into target from public.residential_household_members where household_id = household.id and membership_id = p_target_membership_id and member_kind = 'member' and status = 'active' for update;
    if not found then raise exception 'replacement primary must be an active household member'; end if;
    update public.residential_household_members set member_kind = 'member', updated_at = clock_timestamp() where household_id = household.id and member_kind = 'primary' and status <> 'removed';
    update public.residential_household_members set member_kind = 'primary', updated_at = clock_timestamp() where id = target.id;
    update public.residential_households set primary_membership_id = target.membership_id, updated_at = clock_timestamp() where id = household.id;
  else raise exception 'household action is invalid';
  end if;

  perform private.write_audit_event(actor.organization_id, 'household.' || p_action, 'residential_households', household.id, 'authenticated_user', actor.id, jsonb_build_object('target_membership_id', p_target_membership_id));
  return true;
end;
$$;

revoke all on function public.manage_residential_household(uuid, text, uuid) from public, anon, service_role;
grant execute on function public.manage_residential_household(uuid, text, uuid) to authenticated;
revoke all on function private.create_primary_household_after_approval() from public, anon, authenticated, service_role;
revoke all on function private.can_view_residential_household(uuid) from public, anon, service_role;
revoke all on function private.can_view_residential_household_member(uuid) from public, anon, service_role;
grant execute on function private.can_view_residential_household(uuid) to authenticated;
grant execute on function private.can_view_residential_household_member(uuid) to authenticated;
