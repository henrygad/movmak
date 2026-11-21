-- Retry-safe public visitor registration. This migration is intentionally
-- incremental and must be applied before deploying the matching application.

create table public.visit_submission_idempotency (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  channel text not null,
  scope_id uuid not null,
  key_hash bytea not null,
  input_fingerprint bytea not null,
  visit_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint visit_submission_idempotency_scope_unique unique (channel, scope_id, key_hash),
  constraint visit_submission_idempotency_channel_check check (
    channel in ('public_invitation', 'resident_direct', 'security_gate')
  ),
  constraint visit_submission_idempotency_hashes_check check (
    octet_length(key_hash) = 32 and octet_length(input_fingerprint) = 32
  ),
  constraint visit_submission_idempotency_visit_fk foreign key (visit_id, organization_id)
    references public.visits (id, organization_id) on delete restrict,
  constraint visit_submission_idempotency_completion_check check (
    (visit_id is null and completed_at is null)
    or (visit_id is not null and completed_at is not null)
  )
);

create index visit_submission_idempotency_created_idx
  on public.visit_submission_idempotency (created_at);

alter table public.visit_submission_idempotency enable row level security;
alter table public.visit_submission_idempotency force row level security;
revoke all on table public.visit_submission_idempotency from public, anon, authenticated;
grant select, insert, update on table public.visit_submission_idempotency to service_role;

create function public.register_invited_visit_idempotent(
  p_invitation_token_hash bytea,
  p_full_name text,
  p_phone text,
  p_purpose text,
  p_qr_token_hash bytea,
  p_idempotency_key_hash bytea,
  p_input_fingerprint bytea,
  p_group_size smallint default 1
)
returns table (
  registered_visit_id uuid,
  registered_visit_reference text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record record;
  submission_record record;
  new_visitor_id uuid;
  new_visit_id uuid;
  new_visit_reference text;
begin
  if p_invitation_token_hash is null
    or p_qr_token_hash is null
    or p_idempotency_key_hash is null
    or p_input_fingerprint is null
    or octet_length(p_invitation_token_hash) <> 32
    or octet_length(p_qr_token_hash) <> 32
    or octet_length(p_idempotency_key_hash) <> 32
    or octet_length(p_input_fingerprint) <> 32 then
    raise exception 'registration credential is invalid or unavailable';
  end if;

  if p_full_name is null
    or p_phone is null
    or p_purpose is null
    or p_group_size is null
    or char_length(btrim(p_full_name)) not between 2 and 160
    or btrim(p_phone) !~ '^\\+[1-9][0-9]{7,14}$'
    or char_length(btrim(p_purpose)) not between 2 and 500
    or p_group_size not between 1 and 100 then
    raise exception 'registration details are invalid';
  end if;

  -- Lock by invitation first. That serializes simultaneous first submissions
  -- without making a raw client key a global identifier.
  select credential.id, credential.organization_id, credential.host_membership_id,
    credential.valid_from, credential.expires_at, credential.consumed_at,
    credential.revoked_at, host_membership.status as host_status,
    host_membership.role as host_role
  into invitation_record
  from public.invitation_credentials as credential
  join public.organization_memberships as host_membership
    on host_membership.id = credential.host_membership_id
   and host_membership.organization_id = credential.organization_id
  where credential.token_hash = p_invitation_token_hash
  for update of credential;

  if not found then
    raise exception 'registration credential is invalid or unavailable';
  end if;

  select submission.id, submission.input_fingerprint, submission.visit_id,
    visit.visit_reference
  into submission_record
  from public.visit_submission_idempotency as submission
  left join public.visits as visit
    on visit.id = submission.visit_id
   and visit.organization_id = submission.organization_id
  where submission.channel = 'public_invitation'
    and submission.scope_id = invitation_record.id
    and submission.key_hash = p_idempotency_key_hash
  for update of submission;

  if found then
    if submission_record.input_fingerprint <> p_input_fingerprint then
      raise exception 'idempotency key was already used with different details';
    end if;
    if submission_record.visit_id is null then
      raise exception 'registration is still being processed';
    end if;
    return query select submission_record.visit_id, submission_record.visit_reference, true;
    return;
  end if;

  if invitation_record.valid_from > clock_timestamp()
    or invitation_record.expires_at <= clock_timestamp()
    or invitation_record.consumed_at is not null
    or invitation_record.revoked_at is not null
    or invitation_record.host_status <> 'active'
    or invitation_record.host_role <> 'host' then
    raise exception 'registration credential is invalid or unavailable';
  end if;

  insert into public.visit_submission_idempotency (
    organization_id, channel, scope_id, key_hash, input_fingerprint
  ) values (
    invitation_record.organization_id, 'public_invitation', invitation_record.id,
    p_idempotency_key_hash, p_input_fingerprint
  ) returning id into submission_record;

  insert into public.visitors (
    organization_id, full_name, phone, phone_not_provided, created_by_membership_id
  ) values (
    invitation_record.organization_id, btrim(p_full_name), btrim(p_phone), false, null
  ) returning id into new_visitor_id;

  insert into public.visits (
    organization_id, visitor_id, host_membership_id, entry_method, purpose,
    group_size, status, invitation_credential_id, created_by_membership_id
  ) values (
    invitation_record.organization_id, new_visitor_id,
    invitation_record.host_membership_id, 'invitation', btrim(p_purpose),
    p_group_size, 'expected', invitation_record.id, null
  ) returning id, visit_reference into new_visit_id, new_visit_reference;

  insert into public.visit_qr_credentials (organization_id, visit_id, token_hash)
  values (invitation_record.organization_id, new_visit_id, p_qr_token_hash);

  update public.visit_submission_idempotency
  set visit_id = new_visit_id, completed_at = clock_timestamp()
  where id = submission_record.id;

  return query select new_visit_id, new_visit_reference, false;
end;
$$;

revoke execute on function public.register_invited_visit_idempotent(
  bytea, text, text, text, bytea, bytea, bytea, smallint
) from public, anon, authenticated;
grant execute on function public.register_invited_visit_idempotent(
  bytea, text, text, text, bytea, bytea, bytea, smallint
) to service_role;

comment on table public.visit_submission_idempotency is
  'Hash-only, channel-and-scope-bound submission replay records. Raw idempotency keys are never stored.';
comment on function public.register_invited_visit_idempotent(
  bytea, text, text, text, bytea, bytea, bytea, smallint
) is
  'Service-role-only atomic public registration. Same key and canonical input replays the original visit; changed input is rejected.';
