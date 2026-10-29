begin;

-- The companion RPC is the only authenticated write path for visit group size.
-- Keep the mutation trigger as defense in depth: same-status corrections are
-- limited to group size, active gate states, and an active same-organization
-- security actor derived from auth.uid(). Direct table UPDATE remains revoked.
create or replace function private.enforce_visit_mutation()
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
    if new.purpose <> old.purpose then
      raise exception 'visit corrections require an authorized correction operation';
    end if;

    if new.group_size <> old.group_size and (
      new.status not in ('expected', 'inside')
      or not exists (
        select 1
        from public.organization_memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.organization_id = new.organization_id
          and membership.role = 'security'
          and membership.status = 'active'
      )
    ) then
      raise exception 'companion correction requires active security staff' using errcode = '42501';
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

commit;
