create function public.create_organization_with_admin(
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
    select 1
    from public.organization_memberships as membership
    where membership.user_id = actor_user_id
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
    organization_id,
    user_id,
    role,
    status,
    created_by_user_id
  )
  values (
    created_organization_id,
    actor_user_id,
    'admin',
    'active',
    actor_user_id
  )
  returning id into created_membership_id;

  return query select created_organization_id, created_membership_id;
end;
$$;

revoke execute on function public.create_organization_with_admin(text, text, text)
  from public, anon, service_role;
grant execute on function public.create_organization_with_admin(text, text, text)
  to authenticated;

comment on function public.create_organization_with_admin(text, text, text) is
  'Atomically creates an organization and first active admin for an authenticated user with no existing membership.';
