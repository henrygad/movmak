create function public.register_gate_visit_idempotent(
  p_host_membership_id uuid, p_full_name text, p_phone text, p_phone_not_provided boolean,
  p_purpose text, p_group_size smallint, p_host_code_attempt_id bigint,
  p_idempotency_key_hash bytea, p_input_fingerprint bytea
)
returns table (registered_visit_id uuid, registered_visit_reference text, replayed boolean)
language plpgsql security definer set search_path = '' as $$
declare actor record; submission record; result record;
begin
  select id, organization_id into actor from public.organization_memberships where user_id = (select auth.uid()) and role = 'security' and status = 'active';
  if not found then raise exception 'gate operation is not permitted' using errcode = '42501'; end if;
  if octet_length(p_idempotency_key_hash) <> 32 or octet_length(p_input_fingerprint) <> 32 then raise exception 'idempotency credential is invalid'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor.id::text || pg_catalog.encode(p_idempotency_key_hash, 'hex'), 5));
  select i.*, v.visit_reference into submission from public.visit_submission_idempotency i left join public.visits v on v.id = i.visit_id and v.organization_id = i.organization_id where i.channel = 'security_gate' and i.scope_id = actor.id and i.key_hash = p_idempotency_key_hash for update of i;
  if found then
    if submission.input_fingerprint <> p_input_fingerprint then raise exception 'idempotency key was already used with different details'; end if;
    return query select submission.visit_id, submission.visit_reference, true; return;
  end if;
  insert into public.visit_submission_idempotency(organization_id, channel, scope_id, key_hash, input_fingerprint) values(actor.organization_id, 'security_gate', actor.id, p_idempotency_key_hash, p_input_fingerprint) returning * into submission;
  select * into result from public.register_gate_visit(p_host_membership_id, p_full_name, p_phone, p_phone_not_provided, p_purpose, p_group_size, p_host_code_attempt_id);
  update public.visit_submission_idempotency set visit_id = result.registered_visit_id, completed_at = clock_timestamp() where id = submission.id;
  return query select result.registered_visit_id, result.registered_visit_reference, false;
end;
$$;
revoke all on function public.register_gate_visit_idempotent(uuid, text, text, boolean, text, smallint, bigint, bytea, bytea) from public, anon, service_role;
grant execute on function public.register_gate_visit_idempotent(uuid, text, text, boolean, text, smallint, bigint, bytea, bytea) to authenticated;
