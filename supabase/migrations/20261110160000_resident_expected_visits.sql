create function public.register_resident_expected_visit(
  p_full_name text,
  p_phone text,
  p_purpose text,
  p_qr_token_hash bytea,
  p_idempotency_key_hash bytea,
  p_input_fingerprint bytea,
  p_group_size smallint default 1
)
returns table (registered_visit_id uuid, registered_visit_reference text, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare actor record; submission record; new_visitor_id uuid; new_visit_id uuid; new_visit_reference text; credential_id uuid; synthetic_token_hash bytea;
begin
  select membership.id, membership.organization_id into actor
  from public.organization_memberships membership
  join public.user_profiles profile on profile.user_id = membership.user_id
  where membership.user_id = (select auth.uid()) and membership.role = 'host'
    and membership.status = 'active' and profile.phone_verified_at is not null;
  if not found then raise exception 'resident visit registration is not permitted' using errcode = '42501'; end if;
  if p_qr_token_hash is null or p_idempotency_key_hash is null or p_input_fingerprint is null
    or octet_length(p_qr_token_hash) <> 32 or octet_length(p_idempotency_key_hash) <> 32 or octet_length(p_input_fingerprint) <> 32 then raise exception 'visit credentials are invalid'; end if;
  if char_length(btrim(p_full_name)) not between 2 and 160 or btrim(p_phone) !~ '^\\+[1-9][0-9]{7,14}$'
    or char_length(btrim(p_purpose)) not between 2 and 500 or p_group_size not between 1 and 100 then raise exception 'visit details are invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.id::text || pg_catalog.encode(p_idempotency_key_hash, 'hex'), 4));
  select i.*, v.visit_reference into submission from public.visit_submission_idempotency i
  left join public.visits v on v.id = i.visit_id and v.organization_id = i.organization_id
  where i.channel = 'resident_direct' and i.scope_id = actor.id and i.key_hash = p_idempotency_key_hash for update of i;
  if found then
    if submission.input_fingerprint <> p_input_fingerprint then raise exception 'idempotency key was already used with different details'; end if;
    return query select submission.visit_id, submission.visit_reference, true; return;
  end if;
  insert into public.visit_submission_idempotency(organization_id, channel, scope_id, key_hash, input_fingerprint)
  values(actor.organization_id, 'resident_direct', actor.id, p_idempotency_key_hash, p_input_fingerprint) returning * into submission;
  synthetic_token_hash := extensions.digest(actor.id::text || pg_catalog.encode(p_idempotency_key_hash, 'hex'), 'sha256');
  insert into public.invitation_credentials(organization_id, host_membership_id, token_hash, expires_at, created_by_membership_id)
  values(actor.organization_id, actor.id, synthetic_token_hash, clock_timestamp() + interval '5 minutes', actor.id) returning id into credential_id;
  insert into public.visitors(organization_id, full_name, phone, phone_not_provided, created_by_membership_id)
  values(actor.organization_id, btrim(p_full_name), btrim(p_phone), false, actor.id) returning id into new_visitor_id;
  insert into public.visits(organization_id, visitor_id, host_membership_id, entry_method, purpose, group_size, status, invitation_credential_id, created_by_membership_id)
  values(actor.organization_id, new_visitor_id, actor.id, 'invitation', btrim(p_purpose), p_group_size, 'expected', credential_id, null)
  returning id, visits.visit_reference into new_visit_id, new_visit_reference;
  insert into public.visit_qr_credentials(organization_id, visit_id, token_hash) values(actor.organization_id, new_visit_id, p_qr_token_hash);
  update public.visit_submission_idempotency set visit_id = new_visit_id, completed_at = clock_timestamp() where id = submission.id;
  perform private.write_audit_event(actor.organization_id, 'visit.resident_registered', 'visits', new_visit_id, 'authenticated_user', actor.id, jsonb_build_object('visit_reference', new_visit_reference));
  return query select new_visit_id, new_visit_reference, false;
end;
$$;
revoke all on function public.register_resident_expected_visit(text, text, text, bytea, bytea, bytea, smallint) from public, anon, service_role;
grant execute on function public.register_resident_expected_visit(text, text, text, bytea, bytea, bytea, smallint) to authenticated;
