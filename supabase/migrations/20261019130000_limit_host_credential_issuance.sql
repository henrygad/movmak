begin;

create index invitation_credentials_host_created_idx
  on public.invitation_credentials (host_membership_id, created_at desc);

create or replace function public.issue_host_credentials(
  p_invitation_token_hash bytea,
  p_host_code_hash bytea
)
returns table (
  invitation_expires_at timestamptz,
  host_code_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_membership record;
  issued_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication is required';
  end if;

  if p_invitation_token_hash is null
    or p_host_code_hash is null
    or octet_length(p_invitation_token_hash) <> 32
    or octet_length(p_host_code_hash) <> 32 then
    raise exception 'credential input is invalid';
  end if;

  -- Serialize issuance for the authenticated host. Counting and inserting
  -- under this lock prevents concurrent requests from bypassing the limits.
  select membership.id, membership.organization_id
    into actor_membership
  from public.organization_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and membership.role = 'host'
  for update;

  if not found then
    raise exception 'host operation is not permitted';
  end if;

  issued_at := clock_timestamp();
  if (select count(*) from public.invitation_credentials
      where host_membership_id = actor_membership.id
        and created_at > issued_at - interval '1 minute') >= 5
    or (select count(*) from public.invitation_credentials
      where host_membership_id = actor_membership.id
        and created_at > issued_at - interval '1 hour') >= 60 then
    raise exception 'host credential issuance is rate limited';
  end if;

  update public.invitation_credentials
  set revoked_at = issued_at
  where organization_id = actor_membership.organization_id
    and host_membership_id = actor_membership.id
    and consumed_at is null
    and revoked_at is null
    and expires_at > issued_at;

  update public.host_verification_codes
  set revoked_at = issued_at
  where organization_id = actor_membership.organization_id
    and host_membership_id = actor_membership.id
    and revoked_at is null
    and expires_at > issued_at;

  insert into public.invitation_credentials (
    organization_id, host_membership_id, token_hash, valid_from, expires_at,
    created_by_membership_id, created_at
  ) values (
    actor_membership.organization_id, actor_membership.id, p_invitation_token_hash,
    issued_at, issued_at + interval '5 minutes', actor_membership.id, issued_at
  );

  insert into public.host_verification_codes (
    organization_id, host_membership_id, code_hash, valid_from, expires_at,
    created_by_membership_id, created_at
  ) values (
    actor_membership.organization_id, actor_membership.id, p_host_code_hash,
    issued_at, issued_at + interval '5 minutes', actor_membership.id, issued_at
  );

  return query select issued_at + interval '5 minutes', issued_at + interval '5 minutes';
end;
$$;

-- Keep the original authenticated-only grant. Do not expose credential issuance
-- to anon or the service role, which has no verified host identity.
revoke all on function public.issue_host_credentials(bytea, bytea)
  from public, anon, service_role;
grant execute on function public.issue_host_credentials(bytea, bytea)
  to authenticated;

commit;
