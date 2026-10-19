create unique index organization_memberships_one_organization_per_user
  on public.organization_memberships (user_id);

drop policy memberships_insert_admin on public.organization_memberships;
revoke insert on table public.organization_memberships from authenticated;
revoke insert (organization_id, user_id, role, status)
  on table public.organization_memberships from authenticated;

create table private.organization_membership_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  invited_email text not null,
  role public.organization_role not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id uuid references auth.users (id) on delete restrict,
  revoked_at timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint membership_invitations_creator_fk
    foreign key (created_by_membership_id, organization_id)
    references public.organization_memberships (id, organization_id) on delete restrict,
  constraint membership_invitations_email_normalized check (
    invited_email = lower(btrim(invited_email))
    and char_length(invited_email) between 3 and 320
  ),
  constraint membership_invitations_hash_length check (octet_length(token_hash) = 32),
  constraint membership_invitations_expiry check (expires_at > created_at),
  constraint membership_invitations_state check (
    (consumed_at is null and consumed_by_user_id is null and revoked_at is null)
    or (consumed_at is not null and consumed_by_user_id is not null and revoked_at is null)
    or (consumed_at is null and consumed_by_user_id is null and revoked_at is not null)
  )
);

create index membership_invitations_org_created_idx
  on private.organization_membership_invitations (organization_id, created_at desc);
create index membership_invitations_email_expiry_idx
  on private.organization_membership_invitations (invited_email, expires_at desc);

alter table private.organization_membership_invitations enable row level security;
alter table private.organization_membership_invitations force row level security;
revoke all on table private.organization_membership_invitations
  from public, anon, authenticated, service_role;

create function public.create_membership_invitation(
  p_organization_id uuid,
  p_invited_email text,
  p_role public.organization_role,
  p_token_hash bytea,
  p_expires_at timestamptz
)
returns table (invitation_id uuid, invitation_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_membership_id uuid;
  created_invitation_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select membership.id
    into actor_membership_id
  from public.organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = actor_user_id
    and membership.role = 'admin'
    and membership.status = 'active';

  if actor_membership_id is null then
    raise exception 'membership invitation is not permitted';
  end if;

  p_invited_email := pg_catalog.lower(pg_catalog.btrim(p_invited_email));
  if p_invited_email is null
    or pg_catalog.char_length(p_invited_email) not between 3 and 320
    or p_invited_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invited email is invalid';
  end if;
  if p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32 then
    raise exception 'invitation credential is invalid';
  end if;
  if p_expires_at is null
    or p_expires_at <= statement_timestamp()
    or p_expires_at > statement_timestamp() + interval '7 days' then
    raise exception 'invitation expiry is invalid';
  end if;

  insert into private.organization_membership_invitations (
    organization_id, invited_email, role, token_hash, expires_at,
    created_by_membership_id
  ) values (
    p_organization_id, p_invited_email, p_role, p_token_hash, p_expires_at,
    actor_membership_id
  ) returning id into created_invitation_id;

  perform private.write_audit_event(
    p_organization_id, 'membership.invitation_created',
    'organization_membership_invitations', created_invitation_id,
    'authenticated_user', actor_membership_id,
    jsonb_build_object('role', p_role, 'expires_at', p_expires_at)
  );

  return query select created_invitation_id, p_expires_at;
end;
$$;

create function public.accept_membership_invitation(p_token_hash bytea)
returns table (membership_id uuid, organization_id uuid, assigned_role public.organization_role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_email text;
  invitation_record record;
  created_membership_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32 then
    raise exception 'membership invitation is invalid or unavailable';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text, 0)
  );

  if exists (
    select 1 from public.organization_memberships as membership
    where membership.user_id = actor_user_id
  ) then
    raise exception 'membership invitation is not available';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(users.email))
    into actor_email
  from auth.users as users
  where users.id = actor_user_id
    and users.email_confirmed_at is not null;

  if actor_email is null then
    raise exception 'a verified email is required';
  end if;

  select invitation.*,
         creator.user_id as inviter_user_id
    into invitation_record
  from private.organization_membership_invitations as invitation
  join public.organization_memberships as creator
    on creator.id = invitation.created_by_membership_id
   and creator.organization_id = invitation.organization_id
   and creator.role = 'admin'
   and creator.status = 'active'
  where invitation.token_hash = p_token_hash
    and invitation.invited_email = actor_email
    and invitation.expires_at > statement_timestamp()
    and invitation.consumed_at is null
    and invitation.revoked_at is null
  for update of invitation, creator;

  if invitation_record.id is null then
    raise exception 'membership invitation is invalid or unavailable';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, status, created_by_user_id
  ) values (
    invitation_record.organization_id, actor_user_id, invitation_record.role,
    'active', invitation_record.inviter_user_id
  ) returning id into created_membership_id;

  update private.organization_membership_invitations
  set consumed_at = clock_timestamp(), consumed_by_user_id = actor_user_id
  where id = invitation_record.id;

  perform private.write_audit_event(
    invitation_record.organization_id, 'membership.invitation_accepted',
    'organization_membership_invitations', invitation_record.id,
    'authenticated_user', created_membership_id,
    jsonb_build_object('role', invitation_record.role)
  );

  return query select created_membership_id, invitation_record.organization_id, invitation_record.role;
end;
$$;

create function public.revoke_membership_invitation(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_membership_id uuid;
begin
  select membership.id into actor_membership_id
  from public.organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = actor_user_id
    and membership.role = 'admin'
    and membership.status = 'active';

  if actor_membership_id is null then
    raise exception 'membership invitation is not permitted';
  end if;

  update private.organization_membership_invitations
  set revoked_at = clock_timestamp()
  where id = p_invitation_id
    and organization_id = p_organization_id
    and consumed_at is null
    and revoked_at is null;

  if not found then
    return false;
  end if;

  perform private.write_audit_event(
    p_organization_id, 'membership.invitation_revoked',
    'organization_membership_invitations', p_invitation_id,
    'authenticated_user', actor_membership_id
  );
  return true;
end;
$$;

revoke execute on function public.create_membership_invitation(uuid, text, public.organization_role, bytea, timestamptz)
  from public, anon, service_role;
revoke execute on function public.accept_membership_invitation(bytea)
  from public, anon, service_role;
revoke execute on function public.revoke_membership_invitation(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.create_membership_invitation(uuid, text, public.organization_role, bytea, timestamptz)
  to authenticated;
grant execute on function public.accept_membership_invitation(bytea) to authenticated;
grant execute on function public.revoke_membership_invitation(uuid, uuid) to authenticated;

comment on table private.organization_membership_invitations is
  'Private one-time membership authorizations. Raw bearer tokens are never stored.';
