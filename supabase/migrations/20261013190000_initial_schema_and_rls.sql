begin;

create schema if not exists private;

revoke create on schema public from public;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create type public.organization_entry_mode as enum (
  'both',
  'invitation_only',
  'direct_gate_only'
);

create type public.organization_role as enum (
  'admin',
  'host',
  'security'
);

create type public.membership_status as enum (
  'active',
  'suspended',
  'revoked'
);

create type public.app_permission as enum (
  'organization_view',
  'membership_manage',
  'visit_view_all',
  'visit_view_inside',
  'gate_operate',
  'invitation_issue',
  'host_code_issue',
  'host_code_verify',
  'audit_view'
);

create type public.visit_status as enum (
  'expected',
  'inside',
  'left'
);

create type public.visit_entry_method as enum (
  'invitation',
  'direct_gate',
  'host_verified'
);

create type public.audit_actor_type as enum (
  'authenticated_user',
  'public_visitor',
  'system'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Africa/Lagos',
  entry_mode public.organization_entry_mode not null default 'both',
  logo_url text,
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint organizations_name_length check (char_length(btrim(name)) between 2 and 160),
  constraint organizations_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_timezone_present check (char_length(btrim(timezone)) > 0),
  constraint organizations_logo_url_length check (logo_url is null or char_length(logo_url) <= 2048)
);

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint user_profiles_name_length check (full_name is null or char_length(btrim(full_name)) between 2 and 160),
  constraint user_profiles_phone_length check (phone is null or char_length(btrim(phone)) between 3 and 40)
);

create table public.role_permissions (
  role public.organization_role not null,
  permission public.app_permission not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
values
  ('admin', 'organization_view'),
  ('admin', 'membership_manage'),
  ('admin', 'visit_view_all'),
  ('admin', 'audit_view'),
  ('host', 'organization_view'),
  ('host', 'invitation_issue'),
  ('host', 'host_code_issue'),
  ('security', 'organization_view'),
  ('security', 'visit_view_inside'),
  ('security', 'gate_operate'),
  ('security', 'host_code_verify');

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  role public.organization_role not null,
  status public.membership_status not null default 'active',
  created_by_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  constraint organization_memberships_org_user_unique unique (organization_id, user_id),
  constraint organization_memberships_id_org_unique unique (id, organization_id),
  constraint organization_memberships_revocation_consistent check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create index organization_memberships_user_active_idx
  on public.organization_memberships (user_id, organization_id, role)
  where status = 'active';

create index organization_memberships_org_status_idx
  on public.organization_memberships (organization_id, status, role);

create table public.invitation_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  host_membership_id uuid not null,
  token_hash bytea not null unique,
  code_hash bytea unique,
  valid_from timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by_membership_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint invitation_credentials_id_org_host_unique unique (id, organization_id, host_membership_id),
  constraint invitation_credentials_host_fk foreign key (host_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint invitation_credentials_creator_fk foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint invitation_credentials_token_hash_length check (octet_length(token_hash) = 32),
  constraint invitation_credentials_code_hash_length check (code_hash is null or octet_length(code_hash) = 32),
  constraint invitation_credentials_expiry_order check (
    expires_at > valid_from
    and expires_at <= valid_from + interval '5 minutes'
  ),
  constraint invitation_credentials_consumed_order check (consumed_at is null or consumed_at >= valid_from),
  constraint invitation_credentials_revoked_order check (revoked_at is null or revoked_at >= valid_from),
  constraint invitation_credentials_single_terminal_state check (not (consumed_at is not null and revoked_at is not null))
);

create index invitation_credentials_active_host_idx
  on public.invitation_credentials (organization_id, host_membership_id, expires_at)
  where consumed_at is null and revoked_at is null;

create table public.host_verification_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  host_membership_id uuid not null,
  code_hash bytea not null,
  valid_from timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_by_membership_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  constraint host_verification_codes_org_hash_unique unique (organization_id, code_hash),
  constraint host_verification_codes_id_org_unique unique (id, organization_id),
  constraint host_verification_codes_host_fk foreign key (host_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint host_verification_codes_creator_fk foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint host_verification_codes_hash_length check (octet_length(code_hash) = 32),
  constraint host_verification_codes_expiry_order check (
    expires_at > valid_from
    and expires_at <= valid_from + interval '5 minutes'
  ),
  constraint host_verification_codes_revoked_order check (revoked_at is null or revoked_at >= valid_from),
  constraint host_verification_codes_use_count check (use_count >= 0),
  constraint host_verification_codes_last_used_order check (last_used_at is null or last_used_at >= valid_from)
);

create index host_verification_codes_active_host_idx
  on public.host_verification_codes (organization_id, host_membership_id, expires_at)
  where revoked_at is null;

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text not null,
  phone text,
  phone_not_provided boolean not null default false,
  created_by_membership_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint visitors_id_org_unique unique (id, organization_id),
  constraint visitors_creator_fk foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint visitors_name_length check (char_length(btrim(full_name)) between 2 and 160),
  constraint visitors_phone_length check (phone is null or char_length(btrim(phone)) between 3 and 40),
  constraint visitors_phone_state check (
    (phone is not null and phone_not_provided = false)
    or (phone is null and phone_not_provided = true)
  )
);

create index visitors_org_created_idx on public.visitors (organization_id, created_at desc);

create sequence public.visit_reference_seq as bigint start with 1 increment by 1 no cycle;

create function private.next_visit_reference()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select format(
    'VIS-%s-%s',
    to_char(clock_timestamp() at time zone 'UTC', 'YYYY'),
    lpad(nextval('public.visit_reference_seq')::text, 6, '0')
  );
$$;

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  visit_reference text not null unique default private.next_visit_reference(),
  visitor_id uuid not null,
  host_membership_id uuid not null,
  entry_method public.visit_entry_method not null,
  purpose text not null,
  group_size smallint not null default 1,
  status public.visit_status not null,
  invitation_credential_id uuid,
  host_code_attempt_id bigint unique,
  created_by_membership_id uuid,
  registered_at timestamptz not null default clock_timestamp(),
  checked_in_at timestamptz,
  checked_in_by_membership_id uuid,
  checked_out_at timestamptz,
  checked_out_by_membership_id uuid,
  updated_at timestamptz not null default clock_timestamp(),
  constraint visits_id_org_unique unique (id, organization_id),
  constraint visits_visitor_fk foreign key (visitor_id, organization_id)
    references public.visitors (id, organization_id) on delete restrict,
  constraint visits_host_fk foreign key (host_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint visits_creator_fk foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint visits_checkin_actor_fk foreign key (checked_in_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint visits_checkout_actor_fk foreign key (checked_out_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint visits_invitation_fk foreign key (invitation_credential_id, organization_id, host_membership_id)
    references public.invitation_credentials (id, organization_id, host_membership_id) on delete restrict,
  constraint visits_reference_format check (visit_reference ~ '^VIS-[0-9]{4}-[0-9]{6,}$'),
  constraint visits_purpose_length check (char_length(btrim(purpose)) between 2 and 500),
  constraint visits_group_size check (group_size between 1 and 100),
  constraint visits_invitation_method_consistent check (
    (entry_method = 'invitation' and invitation_credential_id is not null)
    or (entry_method <> 'invitation' and invitation_credential_id is null)
  ),
  constraint visits_host_verification_consistent check (
    (entry_method = 'host_verified' and host_code_attempt_id is not null)
    or (entry_method <> 'host_verified' and host_code_attempt_id is null)
  ),
  constraint visits_direct_creator_required check (
    entry_method = 'invitation' or created_by_membership_id is not null
  ),
  constraint visits_direct_not_expected check (
    entry_method = 'invitation' or status <> 'expected'
  ),
  constraint visits_status_timestamps_consistent check (
    (
      status = 'expected'
      and checked_in_at is null
      and checked_in_by_membership_id is null
      and checked_out_at is null
      and checked_out_by_membership_id is null
    )
    or (
      status = 'inside'
      and checked_in_at is not null
      and checked_in_by_membership_id is not null
      and checked_out_at is null
      and checked_out_by_membership_id is null
    )
    or (
      status = 'left'
      and checked_in_at is not null
      and checked_in_by_membership_id is not null
      and checked_out_at is not null
      and checked_out_by_membership_id is not null
      and checked_out_at >= checked_in_at
    )
  )
);

create index visits_org_status_registered_idx
  on public.visits (organization_id, status, registered_at desc);

create index visits_org_host_registered_idx
  on public.visits (organization_id, host_membership_id, registered_at desc);

create index visits_visitor_idx on public.visits (visitor_id, registered_at desc);

create table public.visit_qr_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  visit_id uuid not null unique,
  token_hash bytea not null unique,
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint visit_qr_credentials_id_org_unique unique (id, organization_id),
  constraint visit_qr_credentials_visit_fk foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete restrict,
  constraint visit_qr_credentials_hash_length check (octet_length(token_hash) = 32),
  constraint visit_qr_credentials_expiry_order check (expires_at is null or expires_at > issued_at),
  constraint visit_qr_credentials_last_used_order check (last_used_at is null or last_used_at >= issued_at),
  constraint visit_qr_credentials_revoked_order check (revoked_at is null or revoked_at >= issued_at)
);

create index visit_qr_credentials_active_idx
  on public.visit_qr_credentials (visit_id, expires_at)
  where revoked_at is null;

create table public.host_code_attempts (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  attempted_by_membership_id uuid not null,
  code_fingerprint bytea not null,
  succeeded boolean not null,
  matched_code_id uuid,
  attempted_at timestamptz not null default clock_timestamp(),
  constraint host_code_attempts_actor_fk foreign key (attempted_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint host_code_attempts_code_fk foreign key (matched_code_id, organization_id)
    references public.host_verification_codes (id, organization_id) on delete restrict,
  constraint host_code_attempts_fingerprint_length check (octet_length(code_fingerprint) = 32),
  constraint host_code_attempts_match_consistent check (
    (succeeded and matched_code_id is not null)
    or (not succeeded and matched_code_id is null)
  )
);

create index host_code_attempts_actor_rate_limit_idx
  on public.host_code_attempts (organization_id, attempted_by_membership_id, attempted_at desc)
  where succeeded = false;

create index host_code_attempts_org_rate_limit_idx
  on public.host_code_attempts (organization_id, attempted_at desc)
  where succeeded = false;

alter table public.visits
  add constraint visits_host_code_attempt_fk
  foreign key (host_code_attempt_id)
  references public.host_code_attempts (id)
  on delete restrict;

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  action text not null,
  target_table text not null,
  target_id uuid,
  actor_type public.audit_actor_type not null,
  actor_user_id uuid references auth.users (id) on delete restrict,
  actor_membership_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint audit_events_actor_membership_fk foreign key (actor_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint audit_events_action_present check (char_length(btrim(action)) between 3 and 100),
  constraint audit_events_target_present check (char_length(btrim(target_table)) between 1 and 100),
  constraint audit_events_data_object check (jsonb_typeof(event_data) = 'object'),
  constraint audit_events_actor_consistent check (
    (
      actor_type = 'authenticated_user'
      and actor_user_id is not null
      and actor_membership_id is not null
    )
    or (
      actor_type in ('public_visitor', 'system')
      and actor_user_id is null
      and actor_membership_id is null
    )
  )
);

create index audit_events_org_occurred_idx
  on public.audit_events (organization_id, occurred_at desc);

create index audit_events_target_idx
  on public.audit_events (target_table, target_id, occurred_at desc);

create function private.is_active_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create function private.has_permission(
  p_organization_id uuid,
  p_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    join public.role_permissions as role_permission
      on role_permission.role = membership.role
     and role_permission.permission = p_permission
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create function private.can_manage_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as actor_membership
    join public.organization_memberships as target_membership
      on target_membership.organization_id = actor_membership.organization_id
    where actor_membership.user_id = (select auth.uid())
      and actor_membership.status = 'active'
      and actor_membership.role = 'admin'
      and target_membership.user_id = p_user_id
  );
$$;

create function private.membership_has_role(
  p_membership_id uuid,
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.id = p_membership_id
      and membership.organization_id = p_organization_id
      and membership.status = 'active'
      and membership.role = any (p_roles)
  );
$$;

create function private.validate_organization_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id
      or new.created_by_user_id <> old.created_by_user_id
      or new.created_at <> old.created_at then
      raise exception 'organization identity fields are immutable';
    end if;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'invalid organization timezone';
  end if;

  new.name := btrim(new.name);
  new.slug := lower(btrim(new.slug));
  new.timezone := btrim(new.timezone);
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger organizations_validate_mutation
before insert or update on public.organizations
for each row execute function private.validate_organization_mutation();

create function private.protect_profile_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.user_id <> old.user_id
    or new.created_at <> old.created_at
  ) then
    raise exception 'profile identity fields are immutable';
  end if;

  new.full_name := nullif(btrim(new.full_name), '');
  new.phone := nullif(btrim(new.phone), '');
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger user_profiles_protect_mutation
before insert or update on public.user_profiles
for each row execute function private.protect_profile_mutation();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, full_name)
  values (
    new.id,
    case
      when char_length(btrim(new.raw_user_meta_data ->> 'full_name')) between 2 and 160
        then btrim(new.raw_user_meta_data ->> 'full_name')
      else null
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create function private.enforce_membership_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id := coalesce(new.created_by_user_id, auth.uid());
    new.created_at := clock_timestamp();
  else
    if new.id <> old.id
      or new.organization_id <> old.organization_id
      or new.user_id <> old.user_id
      or new.created_by_user_id <> old.created_by_user_id
      or new.created_at <> old.created_at then
      raise exception 'membership identity fields are immutable';
    end if;

    if old.role = 'admin'
      and old.status = 'active'
      and not (new.role = 'admin' and new.status = 'active') then
      perform 1
      from public.organizations as organization
      where organization.id = old.organization_id
      for update;

      if not exists (
        select 1
        from public.organization_memberships as other_admin
        where other_admin.organization_id = old.organization_id
          and other_admin.id <> old.id
          and other_admin.role = 'admin'
          and other_admin.status = 'active'
      ) then
        raise exception 'an organization must retain an active administrator';
      end if;
    end if;
  end if;

  if new.status = 'revoked' then
    new.revoked_at := coalesce(new.revoked_at, clock_timestamp());
  else
    new.revoked_at := null;
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger organization_memberships_enforce_mutation
before insert or update on public.organization_memberships
for each row execute function private.enforce_membership_mutation();

create function private.write_audit_event(
  p_organization_id uuid,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_actor_type public.audit_actor_type,
  p_actor_membership_id uuid,
  p_event_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user uuid;
begin
  if p_actor_type = 'authenticated_user' then
    select membership.user_id
      into actor_user
    from public.organization_memberships as membership
    where membership.id = p_actor_membership_id
      and membership.organization_id = p_organization_id;

    if actor_user is null then
      raise exception 'audit actor membership is invalid';
    end if;
  elsif p_actor_membership_id is not null then
    raise exception 'non-user audit actors cannot have memberships';
  end if;

  insert into public.audit_events (
    organization_id,
    action,
    target_table,
    target_id,
    actor_type,
    actor_user_id,
    actor_membership_id,
    event_data
  )
  values (
    p_organization_id,
    p_action,
    p_target_table,
    p_target_id,
    p_actor_type,
    actor_user,
    p_actor_membership_id,
    coalesce(p_event_data, '{}'::jsonb)
  );
end;
$$;

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_membership uuid;
  action_name text;
  previous_role public.organization_role;
  previous_status public.membership_status;
begin
  select membership.id
    into actor_membership
  from public.organization_memberships as membership
  where membership.organization_id = new.organization_id
    and membership.user_id = auth.uid()
  limit 1;

  if tg_op = 'INSERT' then
    action_name := 'membership.created';
  else
    action_name := 'membership.updated';
    previous_role := old.role;
    previous_status := old.status;
  end if;

  perform private.write_audit_event(
    new.organization_id,
    action_name,
    'organization_memberships',
    new.id,
    case when actor_membership is null then 'system'::public.audit_actor_type else 'authenticated_user'::public.audit_actor_type end,
    actor_membership,
    jsonb_build_object(
      'subject_user_id', new.user_id,
      'role', new.role,
      'status', new.status,
      'previous_role', previous_role,
      'previous_status', previous_status
    )
  );

  return new;
end;
$$;

create trigger organization_memberships_audit_change
after insert or update on public.organization_memberships
for each row execute function private.audit_membership_change();

create function private.protect_visitor_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id <> old.id
    or new.organization_id <> old.organization_id
    or new.created_by_membership_id is distinct from old.created_by_membership_id
    or new.created_at <> old.created_at
  ) then
    raise exception 'visitor identity fields are immutable';
  end if;

  new.full_name := btrim(new.full_name);
  new.phone := nullif(btrim(new.phone), '');
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger visitors_protect_mutation
before insert or update on public.visitors
for each row execute function private.protect_visitor_mutation();

create function private.enforce_visit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed_credential uuid;
  organization_mode public.organization_entry_mode;
begin
  new.purpose := btrim(new.purpose);

  if tg_op = 'INSERT' then
    new.registered_at := clock_timestamp();
    new.updated_at := new.registered_at;

    select organization.entry_mode
      into organization_mode
    from public.organizations as organization
    where organization.id = new.organization_id;

    if organization_mode is null
      or (new.entry_method = 'invitation' and organization_mode = 'direct_gate_only')
      or (new.entry_method <> 'invitation' and organization_mode = 'invitation_only') then
      raise exception 'visit entry method is not enabled for this organization';
    end if;

    if not private.membership_has_role(
      new.host_membership_id,
      new.organization_id,
      array['host'::public.organization_role]
    ) then
      raise exception 'visit host is not active and authorized';
    end if;

    if new.entry_method = 'invitation' then
      if new.status <> 'expected' then
        raise exception 'invitation visits must begin in expected status';
      end if;

      new.created_by_membership_id := null;
      new.checked_in_at := null;
      new.checked_in_by_membership_id := null;
      new.checked_out_at := null;
      new.checked_out_by_membership_id := null;

      update public.invitation_credentials as credential
      set consumed_at = new.registered_at
      where credential.id = new.invitation_credential_id
        and credential.organization_id = new.organization_id
        and credential.host_membership_id = new.host_membership_id
        and credential.valid_from <= new.registered_at
        and credential.expires_at > new.registered_at
        and credential.consumed_at is null
        and credential.revoked_at is null
      returning credential.id into consumed_credential;

      if consumed_credential is null then
        raise exception 'invitation credential is invalid or unavailable';
      end if;
    else
      if not private.membership_has_role(
        new.created_by_membership_id,
        new.organization_id,
        array['security'::public.organization_role]
      ) then
        raise exception 'direct registration requires active security staff';
      end if;

      if new.entry_method = 'host_verified' and not exists (
        select 1
        from public.host_code_attempts as verification
        join public.host_verification_codes as code
          on code.id = verification.matched_code_id
         and code.organization_id = verification.organization_id
        where verification.id = new.host_code_attempt_id
          and verification.organization_id = new.organization_id
          and verification.attempted_by_membership_id = new.created_by_membership_id
          and verification.succeeded = true
          and verification.attempted_at >= new.registered_at - interval '10 minutes'
          and verification.attempted_at <= new.registered_at
          and code.host_membership_id = new.host_membership_id
      ) then
        raise exception 'host verification is invalid or unavailable';
      end if;

      new.status := 'inside';
      new.checked_in_at := new.registered_at;
      new.checked_in_by_membership_id := new.created_by_membership_id;
      new.checked_out_at := null;
      new.checked_out_by_membership_id := null;
    end if;

    return new;
  end if;

  if new.id <> old.id
    or new.organization_id <> old.organization_id
    or new.visit_reference <> old.visit_reference
    or new.visitor_id <> old.visitor_id
    or new.host_membership_id <> old.host_membership_id
    or new.entry_method <> old.entry_method
    or new.invitation_credential_id is distinct from old.invitation_credential_id
    or new.host_code_attempt_id is distinct from old.host_code_attempt_id
    or new.created_by_membership_id is distinct from old.created_by_membership_id
    or new.registered_at <> old.registered_at then
    raise exception 'visit identity fields are immutable';
  end if;

  if old.status = 'expected' and new.status = 'inside' then
    if not private.membership_has_role(
      new.checked_in_by_membership_id,
      new.organization_id,
      array['security'::public.organization_role]
    ) then
      raise exception 'check-in requires active security staff';
    end if;

    new.checked_in_at := clock_timestamp();
    new.checked_out_at := null;
    new.checked_out_by_membership_id := null;
  elsif old.status = 'inside' and new.status = 'left' then
    if not private.membership_has_role(
      new.checked_out_by_membership_id,
      new.organization_id,
      array['security'::public.organization_role]
    ) then
      raise exception 'checkout requires active security staff';
    end if;

    new.checked_in_at := old.checked_in_at;
    new.checked_in_by_membership_id := old.checked_in_by_membership_id;
    new.checked_out_at := clock_timestamp();
  elsif new.status = old.status then
    if new.purpose <> old.purpose
      or new.group_size <> old.group_size then
      raise exception 'visit corrections require an authorized correction operation';
    end if;

    new.checked_in_at := old.checked_in_at;
    new.checked_in_by_membership_id := old.checked_in_by_membership_id;
    new.checked_out_at := old.checked_out_at;
    new.checked_out_by_membership_id := old.checked_out_by_membership_id;
  else
    raise exception 'invalid visit status transition';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger visits_enforce_mutation
before insert or update on public.visits
for each row execute function private.enforce_visit_mutation();

create function private.audit_visit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_membership uuid;
  actor_kind public.audit_actor_type;
  action_name text;
  previous_status public.visit_status;
begin
  if tg_op = 'INSERT' then
    if new.entry_method = 'invitation' then
      action_name := 'visit.registered';
      actor_kind := 'public_visitor';
      actor_membership := null;
    else
      action_name := 'visit.registered_and_checked_in';
      actor_kind := 'authenticated_user';
      actor_membership := new.created_by_membership_id;
    end if;
  elsif old.status = 'expected' and new.status = 'inside' then
    action_name := 'visit.checked_in';
    actor_kind := 'authenticated_user';
    actor_membership := new.checked_in_by_membership_id;
  elsif old.status = 'inside' and new.status = 'left' then
    action_name := 'visit.checked_out';
    actor_kind := 'authenticated_user';
    actor_membership := new.checked_out_by_membership_id;
  else
    action_name := 'visit.corrected';
    select membership.id
      into actor_membership
    from public.organization_memberships as membership
    where membership.organization_id = new.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    limit 1;
    actor_kind := case
      when actor_membership is null then 'system'::public.audit_actor_type
      else 'authenticated_user'::public.audit_actor_type
    end;
  end if;

  if tg_op = 'UPDATE' then
    previous_status := old.status;
  end if;

  perform private.write_audit_event(
    new.organization_id,
    action_name,
    'visits',
    new.id,
    actor_kind,
    actor_membership,
    jsonb_build_object(
      'visit_reference', new.visit_reference,
      'entry_method', new.entry_method,
      'status', new.status,
      'group_size', new.group_size,
      'previous_status', previous_status
    )
  );

  return new;
end;
$$;

create trigger visits_audit_change
after insert or update on public.visits
for each row execute function private.audit_visit_change();

create function private.protect_invitation_credential_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id
      or new.organization_id <> old.organization_id
      or new.host_membership_id <> old.host_membership_id
      or new.token_hash <> old.token_hash
      or new.code_hash is distinct from old.code_hash
      or new.valid_from <> old.valid_from
      or new.expires_at <> old.expires_at
      or new.created_by_membership_id is distinct from old.created_by_membership_id
      or new.created_at <> old.created_at then
      raise exception 'invitation credential identity fields are immutable';
    end if;

    if old.consumed_at is not null and new.consumed_at is distinct from old.consumed_at then
      raise exception 'consumed invitation credentials are immutable';
    end if;

    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'revoked invitation credentials are immutable';
    end if;
  end if;

  return new;
end;
$$;

create trigger invitation_credentials_protect_mutation
before update on public.invitation_credentials
for each row execute function private.protect_invitation_credential_mutation();

create function private.protect_host_code_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id
      or new.organization_id <> old.organization_id
      or new.host_membership_id <> old.host_membership_id
      or new.code_hash <> old.code_hash
      or new.valid_from <> old.valid_from
      or new.expires_at <> old.expires_at
      or new.created_by_membership_id is distinct from old.created_by_membership_id
      or new.created_at <> old.created_at then
      raise exception 'host code identity fields are immutable';
    end if;

    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'revoked host codes are immutable';
    end if;

    if new.use_count < old.use_count
      or (
        old.last_used_at is not null
        and (new.last_used_at is null or new.last_used_at < old.last_used_at)
      ) then
      raise exception 'host code usage counters cannot move backwards';
    end if;
  end if;

  return new;
end;
$$;

create trigger host_verification_codes_protect_mutation
before update on public.host_verification_codes
for each row execute function private.protect_host_code_mutation();

create function private.protect_qr_credential_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.organization_id <> old.organization_id
    or new.visit_id <> old.visit_id
    or new.token_hash <> old.token_hash
    or new.issued_at <> old.issued_at
    or new.expires_at is distinct from old.expires_at then
    raise exception 'QR credential identity fields are immutable';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked QR credentials are immutable';
  end if;

  if old.last_used_at is not null
    and (new.last_used_at is null or new.last_used_at < old.last_used_at) then
    raise exception 'QR credential usage time cannot move backwards';
  end if;

  return new;
end;
$$;

create trigger visit_qr_credentials_protect_mutation
before update on public.visit_qr_credentials
for each row execute function private.protect_qr_credential_mutation();

create function private.ensure_invited_visit_has_qr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.entry_method = 'invitation' and not exists (
    select 1
    from public.visit_qr_credentials as credential
    where credential.visit_id = new.id
      and credential.organization_id = new.organization_id
  ) then
    raise exception 'invitation visits require a visit-specific QR credential';
  end if;

  return new;
end;
$$;

create constraint trigger invited_visits_require_qr
after insert or update on public.visits
deferrable initially deferred
for each row execute function private.ensure_invited_visit_has_qr();

create function private.revoke_qr_after_checkout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'inside' and new.status = 'left' then
    update public.visit_qr_credentials
    set revoked_at = coalesce(revoked_at, new.checked_out_at)
    where visit_id = new.id
      and organization_id = new.organization_id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

create trigger visits_revoke_qr_after_checkout
after update on public.visits
for each row execute function private.revoke_qr_after_checkout();

create function private.prevent_immutable_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception '% records are append-only', tg_table_name;
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.prevent_immutable_log_mutation();

create trigger host_code_attempts_append_only
before update or delete on public.host_code_attempts
for each row execute function private.prevent_immutable_log_mutation();

create function private.audit_organization_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit_event(
    new.id,
    'organization.created',
    'organizations',
    new.id,
    'system',
    null,
    jsonb_build_object('created_by_user_id', new.created_by_user_id)
  );
  return new;
end;
$$;

create trigger organizations_audit_created
after insert on public.organizations
for each row execute function private.audit_organization_created();

create function private.audit_invitation_credential_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_name text;
  actor_kind public.audit_actor_type;
  actor_membership uuid;
begin
  if tg_op = 'INSERT' then
    action_name := 'invitation.issued';
    actor_membership := new.created_by_membership_id;
    actor_kind := case
      when actor_membership is null then 'system'::public.audit_actor_type
      else 'authenticated_user'::public.audit_actor_type
    end;
  elsif old.consumed_at is null and new.consumed_at is not null then
    action_name := 'invitation.consumed';
    actor_kind := 'public_visitor';
    actor_membership := null;
  elsif old.revoked_at is null and new.revoked_at is not null then
    action_name := 'invitation.revoked';
    select membership.id
      into actor_membership
    from public.organization_memberships as membership
    where membership.organization_id = new.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    limit 1;
    actor_kind := case
      when actor_membership is null then 'system'::public.audit_actor_type
      else 'authenticated_user'::public.audit_actor_type
    end;
  else
    return new;
  end if;

  perform private.write_audit_event(
    new.organization_id,
    action_name,
    'invitation_credentials',
    new.id,
    actor_kind,
    actor_membership,
    jsonb_build_object(
      'host_membership_id', new.host_membership_id,
      'expires_at', new.expires_at
    )
  );
  return new;
end;
$$;

create trigger invitation_credentials_audit_change
after insert or update on public.invitation_credentials
for each row execute function private.audit_invitation_credential_change();

create function private.audit_host_code_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_name text;
  actor_kind public.audit_actor_type;
  actor_membership uuid;
begin
  if tg_op = 'INSERT' then
    action_name := 'host_code.issued';
    actor_membership := new.created_by_membership_id;
    actor_kind := case
      when actor_membership is null then 'system'::public.audit_actor_type
      else 'authenticated_user'::public.audit_actor_type
    end;
  elsif old.revoked_at is null and new.revoked_at is not null then
    action_name := 'host_code.revoked';
    select membership.id
      into actor_membership
    from public.organization_memberships as membership
    where membership.organization_id = new.organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
    limit 1;
    actor_kind := case
      when actor_membership is null then 'system'::public.audit_actor_type
      else 'authenticated_user'::public.audit_actor_type
    end;
  else
    return new;
  end if;

  perform private.write_audit_event(
    new.organization_id,
    action_name,
    'host_verification_codes',
    new.id,
    actor_kind,
    actor_membership,
    jsonb_build_object(
      'host_membership_id', new.host_membership_id,
      'expires_at', new.expires_at
    )
  );
  return new;
end;
$$;

create trigger host_verification_codes_audit_change
after insert or update on public.host_verification_codes
for each row execute function private.audit_host_code_change();

create function private.audit_qr_credential_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'visit_qr.issued';
  elsif old.revoked_at is null and new.revoked_at is not null then
    action_name := 'visit_qr.revoked';
  else
    return new;
  end if;

  perform private.write_audit_event(
    new.organization_id,
    action_name,
    'visit_qr_credentials',
    new.id,
    'system',
    null,
    jsonb_build_object('visit_id', new.visit_id)
  );
  return new;
end;
$$;

create trigger visit_qr_credentials_audit_change
after insert or update on public.visit_qr_credentials
for each row execute function private.audit_qr_credential_change();

create function public.register_invited_visit(
  p_invitation_token_hash bytea,
  p_full_name text,
  p_phone text,
  p_purpose text,
  p_qr_token_hash bytea,
  p_group_size smallint default 1
)
returns table (registered_visit_id uuid, registered_visit_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record record;
  new_visitor_id uuid;
  new_visit_id uuid;
  new_visit_reference text;
begin
  if p_invitation_token_hash is null
    or p_qr_token_hash is null
    or octet_length(p_invitation_token_hash) <> 32
    or octet_length(p_qr_token_hash) <> 32 then
    raise exception 'registration credential is invalid or unavailable';
  end if;

  if p_full_name is null
    or p_phone is null
    or p_purpose is null
    or p_group_size is null
    or char_length(btrim(p_full_name)) not between 2 and 160
    or char_length(btrim(p_phone)) not between 3 and 40
    or char_length(btrim(p_purpose)) not between 2 and 500
    or p_group_size not between 1 and 100 then
    raise exception 'registration details are invalid';
  end if;

  select
    credential.id,
    credential.organization_id,
    credential.host_membership_id
  into invitation_record
  from public.invitation_credentials as credential
  join public.organization_memberships as host_membership
    on host_membership.id = credential.host_membership_id
   and host_membership.organization_id = credential.organization_id
  where credential.token_hash = p_invitation_token_hash
    and credential.valid_from <= clock_timestamp()
    and credential.expires_at > clock_timestamp()
    and credential.consumed_at is null
    and credential.revoked_at is null
    and host_membership.status = 'active'
    and host_membership.role = 'host'
  for update of credential;

  if not found then
    raise exception 'registration credential is invalid or unavailable';
  end if;

  insert into public.visitors (
    organization_id,
    full_name,
    phone,
    phone_not_provided,
    created_by_membership_id
  )
  values (
    invitation_record.organization_id,
    btrim(p_full_name),
    btrim(p_phone),
    false,
    null
  )
  returning id into new_visitor_id;

  insert into public.visits (
    organization_id,
    visitor_id,
    host_membership_id,
    entry_method,
    purpose,
    group_size,
    status,
    invitation_credential_id,
    created_by_membership_id
  )
  values (
    invitation_record.organization_id,
    new_visitor_id,
    invitation_record.host_membership_id,
    'invitation',
    btrim(p_purpose),
    p_group_size,
    'expected',
    invitation_record.id,
    null
  )
  returning id, visit_reference into new_visit_id, new_visit_reference;

  insert into public.visit_qr_credentials (
    organization_id,
    visit_id,
    token_hash
  )
  values (
    invitation_record.organization_id,
    new_visit_id,
    p_qr_token_hash
  );

  return query select new_visit_id, new_visit_reference;
end;
$$;

create function public.verify_host_code(
  p_organization_id uuid,
  p_code_hash bytea
)
returns table (
  verified_attempt_id bigint,
  verified_host_membership_id uuid,
  verified_host_user_id uuid,
  verified_host_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_membership uuid;
  matched_code record;
  actor_failures integer;
  organization_failures integer;
  successful_attempt_id bigint;
begin
  if p_code_hash is null or octet_length(p_code_hash) <> 32 then
    return;
  end if;

  select membership.id
    into actor_membership
  from public.organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'security';

  if actor_membership is null then
    raise exception 'gate operation is not permitted';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text, 0)
  );

  select count(*)::integer
    into actor_failures
  from public.host_code_attempts as attempt
  where attempt.organization_id = p_organization_id
    and attempt.attempted_by_membership_id = actor_membership
    and attempt.succeeded = false
    and attempt.attempted_at >= clock_timestamp() - interval '5 minutes';

  select count(*)::integer
    into organization_failures
  from public.host_code_attempts as attempt
  where attempt.organization_id = p_organization_id
    and attempt.succeeded = false
    and attempt.attempted_at >= clock_timestamp() - interval '1 minute';

  if actor_failures >= 5 or organization_failures >= 25 then
    insert into public.host_code_attempts (
      organization_id,
      attempted_by_membership_id,
      code_fingerprint,
      succeeded
    )
    values (p_organization_id, actor_membership, p_code_hash, false);

    perform private.write_audit_event(
      p_organization_id,
      'host_code.rate_limited',
      'host_code_attempts',
      null,
      'authenticated_user',
      actor_membership,
      '{}'::jsonb
    );
    return;
  end if;

  select
    code.id,
    code.host_membership_id,
    host_membership.user_id,
    profile.full_name
  into matched_code
  from public.host_verification_codes as code
  join public.organization_memberships as host_membership
    on host_membership.id = code.host_membership_id
   and host_membership.organization_id = code.organization_id
  left join public.user_profiles as profile
    on profile.user_id = host_membership.user_id
  where code.organization_id = p_organization_id
    and code.code_hash = p_code_hash
    and code.valid_from <= clock_timestamp()
    and code.expires_at > clock_timestamp()
    and code.revoked_at is null
    and host_membership.status = 'active'
    and host_membership.role = 'host'
  for update of code;

  if not found then
    insert into public.host_code_attempts (
      organization_id,
      attempted_by_membership_id,
      code_fingerprint,
      succeeded
    )
    values (p_organization_id, actor_membership, p_code_hash, false);
    return;
  end if;

  update public.host_verification_codes
  set
    use_count = use_count + 1,
    last_used_at = clock_timestamp()
  where id = matched_code.id;

  insert into public.host_code_attempts (
    organization_id,
    attempted_by_membership_id,
    code_fingerprint,
    succeeded,
    matched_code_id
  )
  values (
    p_organization_id,
    actor_membership,
    p_code_hash,
    true,
    matched_code.id
  )
  returning id into successful_attempt_id;

  perform private.write_audit_event(
    p_organization_id,
    'host_code.verified',
    'host_verification_codes',
    matched_code.id,
    'authenticated_user',
    actor_membership,
    jsonb_build_object('host_membership_id', matched_code.host_membership_id)
  );

  return query
  select
    successful_attempt_id,
    matched_code.host_membership_id,
    matched_code.user_id,
    matched_code.full_name;
end;
$$;

create function public.check_in_visit_by_qr(
  p_qr_token_hash bytea
)
returns table (checked_in_visit_id uuid, checked_in_visit_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  qr_record record;
  actor_membership uuid;
begin
  if p_qr_token_hash is null or octet_length(p_qr_token_hash) <> 32 then
    raise exception 'visit credential is invalid or unavailable';
  end if;

  select
    qr.id as qr_id,
    visit.id as visit_id,
    visit.organization_id,
    visit.visit_reference
  into qr_record
  from public.visit_qr_credentials as qr
  join public.visits as visit
    on visit.id = qr.visit_id
   and visit.organization_id = qr.organization_id
  where qr.token_hash = p_qr_token_hash
    and qr.revoked_at is null
    and (qr.expires_at is null or qr.expires_at > clock_timestamp())
    and visit.status = 'expected'
  for update of qr, visit;

  if not found then
    raise exception 'visit credential is invalid or unavailable';
  end if;

  select membership.id
    into actor_membership
  from public.organization_memberships as membership
  where membership.organization_id = qr_record.organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'security';

  if actor_membership is null then
    raise exception 'gate operation is not permitted';
  end if;

  update public.visit_qr_credentials
  set last_used_at = clock_timestamp()
  where id = qr_record.qr_id;

  update public.visits
  set
    status = 'inside',
    checked_in_by_membership_id = actor_membership
  where id = qr_record.visit_id;

  return query select qr_record.visit_id, qr_record.visit_reference;
end;
$$;

create function public.check_out_visit(
  p_visit_id uuid
)
returns table (checked_out_visit_id uuid, checked_out_visit_reference text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit_record record;
  actor_membership uuid;
begin
  select visit.id, visit.organization_id, visit.visit_reference
    into visit_record
  from public.visits as visit
  where visit.id = p_visit_id
    and visit.status = 'inside'
  for update;

  if not found then
    raise exception 'visit is not available for checkout';
  end if;

  select membership.id
    into actor_membership
  from public.organization_memberships as membership
  where membership.organization_id = visit_record.organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'security';

  if actor_membership is null then
    raise exception 'gate operation is not permitted';
  end if;

  update public.visits
  set
    status = 'left',
    checked_out_by_membership_id = actor_membership
  where id = visit_record.id;

  return query select visit_record.id, visit_record.visit_reference;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;
alter table public.invitation_credentials enable row level security;
alter table public.invitation_credentials force row level security;
alter table public.host_verification_codes enable row level security;
alter table public.host_verification_codes force row level security;
alter table public.visitors enable row level security;
alter table public.visitors force row level security;
alter table public.visits enable row level security;
alter table public.visits force row level security;
alter table public.visit_qr_credentials enable row level security;
alter table public.visit_qr_credentials force row level security;
alter table public.host_code_attempts enable row level security;
alter table public.host_code_attempts force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy organizations_select_active_members
on public.organizations
for select
to authenticated
using (private.is_active_org_member(id));

create policy user_profiles_select_self_or_managed_users
on public.user_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_user(user_id)
);

create policy user_profiles_update_self
on public.user_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using ((select auth.uid()) is not null);

create policy memberships_select_self_or_admin
on public.organization_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_permission(organization_id, 'membership_manage')
);

create policy memberships_insert_admin
on public.organization_memberships
for insert
to authenticated
with check (
  private.has_permission(organization_id, 'membership_manage')
  and created_by_user_id = (select auth.uid())
);

create policy memberships_update_admin
on public.organization_memberships
for update
to authenticated
using (private.has_permission(organization_id, 'membership_manage'))
with check (private.has_permission(organization_id, 'membership_manage'));

create policy visitors_select_admin_or_inside_security
on public.visitors
for select
to authenticated
using (
  private.has_permission(organization_id, 'visit_view_all')
  or (
    private.has_permission(organization_id, 'visit_view_inside')
    and exists (
      select 1
      from public.visits as active_visit
      where active_visit.organization_id = visitors.organization_id
        and active_visit.visitor_id = visitors.id
        and active_visit.status = 'inside'
    )
  )
);

create policy visits_select_admin_or_inside_security
on public.visits
for select
to authenticated
using (
  private.has_permission(organization_id, 'visit_view_all')
  or (
    status = 'inside'
    and private.has_permission(organization_id, 'visit_view_inside')
  )
);

create policy audit_events_select_admin
on public.audit_events
for select
to authenticated
using (private.has_permission(organization_id, 'audit_view'));

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.invitation_credentials from anon, authenticated;
revoke all on table public.host_verification_codes from anon, authenticated;
revoke all on table public.visitors from anon, authenticated;
revoke all on table public.visits from anon, authenticated;
revoke all on table public.visit_qr_credentials from anon, authenticated;
revoke all on table public.host_code_attempts from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on sequence public.visit_reference_seq from anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.user_profiles to authenticated;
grant update (full_name, phone) on table public.user_profiles to authenticated;
grant select on table public.role_permissions to authenticated;
grant select on table public.organization_memberships to authenticated;
grant insert (organization_id, user_id, role, status)
  on table public.organization_memberships to authenticated;
grant update (role, status)
  on table public.organization_memberships to authenticated;
grant select on table public.visitors to authenticated;
grant select on table public.visits to authenticated;
grant select on table public.audit_events to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;
grant execute on function private.is_active_org_member(uuid) to authenticated;
grant execute on function private.has_permission(uuid, public.app_permission) to authenticated;
grant execute on function private.can_manage_user(uuid) to authenticated;

revoke execute on function public.register_invited_visit(bytea, text, text, text, bytea, smallint)
  from public, anon, authenticated;
revoke execute on function public.verify_host_code(uuid, bytea)
  from public, anon, service_role;
revoke execute on function public.check_in_visit_by_qr(bytea)
  from public, anon, service_role;
revoke execute on function public.check_out_visit(uuid)
  from public, anon, service_role;

grant execute on function public.register_invited_visit(bytea, text, text, text, bytea, smallint)
  to service_role;
grant execute on function public.verify_host_code(uuid, bytea)
  to authenticated;
grant execute on function public.check_in_visit_by_qr(bytea)
  to authenticated;
grant execute on function public.check_out_visit(uuid)
  to authenticated;
grant execute on function private.next_visit_reference() to service_role;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

comment on column public.invitation_credentials.token_hash is
  'SHA-256 hash of a high-entropy invitation bearer token; never store or log the raw token.';
comment on column public.invitation_credentials.code_hash is
  'Server-peppered HMAC-SHA-256 of the temporary invitation code; raw codes must never be stored.';
comment on column public.host_verification_codes.code_hash is
  'Server-peppered HMAC-SHA-256 of the six-digit host code to resist offline enumeration.';
comment on column public.host_code_attempts.code_fingerprint is
  'The same server-peppered fingerprint used for matching; never a raw six-digit code.';
comment on column public.visit_qr_credentials.token_hash is
  'SHA-256 hash of a high-entropy visit QR bearer token; QR payloads must contain no personal data.';
comment on function public.register_invited_visit(bytea, text, text, text, bytea, smallint) is
  'Service-role-only atomic invitation consumption, visitor registration, visit creation, and QR issuance.';
comment on function public.verify_host_code(uuid, bytea) is
  'Authenticated host code verification; derives the security operator from auth.uid() and applies actor and organization rate limits.';
comment on function public.check_in_visit_by_qr(bytea) is
  'Authenticated atomic QR check-in; derives and verifies the active security operator from auth.uid().';
comment on function public.check_out_visit(uuid) is
  'Authenticated atomic checkout; derives the active security operator from auth.uid() and only permits INSIDE to LEFT.';

commit;




