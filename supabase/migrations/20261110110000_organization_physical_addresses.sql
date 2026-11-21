-- Existing organizations remain usable with a null address. New organizations
-- must use the v2 creation RPC, which requires one. New resident join requests
-- are blocked until an administrator completes the address.

alter table public.organizations
  add column physical_address text;

alter table public.organizations
  add constraint organizations_physical_address_length
  check (physical_address is null or char_length(btrim(physical_address)) between 5 and 500) not valid;

create function public.create_organization_with_admin_v2(
  p_name text,
  p_website_url text,
  p_physical_address text,
  p_timezone text default 'Africa/Lagos'
)
returns table (organization_id uuid, membership_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  actor_user_id uuid := auth.uid();
  created_organization_id uuid;
  created_membership_id uuid;
  generated_slug text;
begin
  if actor_user_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor_user_id::text, 0));
  if exists (select 1 from public.organization_memberships where user_id = actor_user_id)
    or exists (select 1 from private.organization_membership_requests where user_id = actor_user_id and status = 'pending') then
    raise exception 'organization onboarding is not available';
  end if;

  p_name := pg_catalog.btrim(p_name);
  p_website_url := pg_catalog.btrim(p_website_url);
  p_physical_address := pg_catalog.btrim(p_physical_address);
  p_timezone := pg_catalog.btrim(p_timezone);
  if p_name is null or pg_catalog.char_length(p_name) not between 2 and 160 then raise exception 'organization name is invalid'; end if;
  if p_website_url is null or p_website_url !~* '^https?://[^[:space:]/]+\.[^[:space:]]+$'
    or pg_catalog.char_length(p_website_url) > 2048 then raise exception 'organization website is invalid'; end if;
  if p_physical_address is null or pg_catalog.char_length(p_physical_address) not between 5 and 500 then
    raise exception 'organization physical address is invalid';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'organization timezone is invalid';
  end if;

  generated_slug := pg_catalog.btrim(
    pg_catalog.regexp_replace(pg_catalog.lower(p_name), '[^a-z0-9]+', '-', 'g'), '-'
  );
  if pg_catalog.char_length(generated_slug) < 2 then generated_slug := 'organization'; end if;
  generated_slug := pg_catalog.left(generated_slug, 90) || '-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8);

  insert into public.organizations (name, slug, website_url, physical_address, timezone, created_by_user_id)
  values (p_name, generated_slug, p_website_url, p_physical_address, p_timezone, actor_user_id)
  returning id into created_organization_id;

  insert into public.organization_memberships (organization_id, user_id, role, status, created_by_user_id)
  values (created_organization_id, actor_user_id, 'admin', 'active', actor_user_id)
  returning id into created_membership_id;

  return query select created_organization_id, created_membership_id;
end;
$$;

create function public.update_organization_settings_v2(
  p_website_url text,
  p_logo_url text,
  p_physical_address text
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor record;
begin
  select id, organization_id into actor from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'organization settings are not permitted' using errcode = '42501'; end if;
  p_website_url := pg_catalog.btrim(p_website_url);
  p_physical_address := pg_catalog.btrim(p_physical_address);
  if p_website_url is null or p_website_url !~* '^https?://[^[:space:]/]+\.[^[:space:]]+$'
    or pg_catalog.char_length(p_website_url) > 2048 then raise exception 'organization website is invalid'; end if;
  if p_physical_address is null or pg_catalog.char_length(p_physical_address) not between 5 and 500 then
    raise exception 'organization physical address is invalid';
  end if;
  if p_logo_url is not null and (
    pg_catalog.char_length(p_logo_url) > 2048 or p_logo_url !~ '^https://'
    or p_logo_url not like '%/storage/v1/object/public/organization-logos/' || actor.organization_id::text || '/logo'
  ) then raise exception 'organization logo URL is invalid'; end if;
  update public.organizations
  set website_url = p_website_url, logo_url = p_logo_url, physical_address = p_physical_address
  where id = actor.organization_id;
  perform private.write_audit_event(
    actor.organization_id, 'organization.settings_updated', 'organizations',
    actor.organization_id, 'authenticated_user', actor.id,
    jsonb_build_object('physical_address_complete', true)
  );
  return true;
end;
$$;

create function private.require_resident_join_address()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.requested_role = 'host' and not exists (
    select 1 from public.organizations
    where id = new.organization_id and physical_address is not null
      and char_length(btrim(physical_address)) between 5 and 500
  ) then
    raise exception 'organization physical address must be completed before resident onboarding';
  end if;
  return new;
end;
$$;

create trigger organization_membership_requests_require_resident_address
before insert on private.organization_membership_requests
for each row execute function private.require_resident_join_address();

revoke all on function public.create_organization_with_admin_v2(text, text, text, text) from public, anon, service_role;
grant execute on function public.create_organization_with_admin_v2(text, text, text, text) to authenticated;
revoke all on function public.update_organization_settings_v2(text, text, text) from public, anon, service_role;
grant execute on function public.update_organization_settings_v2(text, text, text) to authenticated;
revoke all on function private.require_resident_join_address() from public, anon, authenticated, service_role;

comment on column public.organizations.physical_address is
  'Required for organizations created through v2. Null is retained only for legacy organizations awaiting administrator remediation.';
