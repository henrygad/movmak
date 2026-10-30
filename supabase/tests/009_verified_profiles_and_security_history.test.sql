begin;
select plan(29);

select has_column('public', 'user_profiles', 'occupancy_type', 'host occupancy is stored');
select has_column('public', 'user_profiles', 'profile_photo_path', 'security profile photo path is stored');
select has_column('public', 'organization_memberships', 'location_verified_by_membership_id', 'approved host retains the security verifier');
select has_column('public', 'organization_memberships', 'approved_by_membership_id', 'approved member retains the approving administrator');
select has_function('public', 'verify_pending_host_location', array['uuid', 'text', 'text', 'text'], 'location verification RPC exists');
select has_function('public', 'list_security_visit_history', array['public.visit_status'], 'security visit history RPC exists');
select has_function('public', 'get_authorized_visit_detail', array['uuid'], 'authorized visit detail RPC exists');
select has_function('public', 'preview_organization_join_branding', array['bytea'], 'join branding RPC exists');
select ok(has_function_privilege('authenticated', 'public.verify_pending_host_location(uuid,text,text,text)', 'EXECUTE'), 'authenticated security may call location verification');
select ok(not has_function_privilege('anon', 'public.verify_pending_host_location(uuid,text,text,text)', 'EXECUTE'), 'anonymous users cannot verify locations');
select ok(not has_function_privilege('service_role', 'public.verify_pending_host_location(uuid,text,text,text)', 'EXECUTE'), 'service role cannot forge a location verifier');
select ok(not has_function_privilege('anon', 'public.list_security_visit_history(public.visit_status)', 'EXECUTE'), 'anonymous users cannot read security history');
select ok(not has_function_privilege('service_role', 'public.list_security_visit_history(public.visit_status)', 'EXECUTE'), 'service role cannot impersonate security history access');
select ok(has_function_privilege('anon', 'public.preview_organization_join_branding(bytea)', 'EXECUTE'), 'anonymous bearer links may read public branding');
select ok(pg_get_functiondef('public.list_security_visit_history(public.visit_status)'::regprocedure) like '%visit.registered_at >= actor.account_created_at%', 'security history starts at account creation');
select ok(pg_get_functiondef('public.get_authorized_visit_detail(uuid)'::regprocedure) like '%actor.role = ''admin'' or visit.registered_at >= actor.account_created_at%', 'security visit details enforce the account creation cutoff');
select ok(pg_get_functiondef('public.issue_host_credentials(bytea,bytea)'::regprocedure) like '%verified host profile is required%', 'host credential issuance requires a verified profile');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verification-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('b1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verification-security@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('b1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verification-host@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('b1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verification-other-security@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());

insert into public.organizations (id, name, slug, created_by_user_id)
values
  ('b2000000-0000-0000-0000-000000000001', 'Verification Organization', 'verification-organization', 'b1000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000002', 'Other Verification Organization', 'other-verification-organization', 'b1000000-0000-0000-0000-000000000004');

insert into public.organization_memberships (id, organization_id, user_id, role, status, created_by_user_id)
values
  ('b3000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'admin', 'active', 'b1000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'security', 'active', 'b1000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'security', 'active', 'b1000000-0000-0000-0000-000000000004');

insert into private.organization_join_links (id, organization_id, default_role, token_hash, expires_at, created_by_membership_id)
values ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'host', decode(repeat('b1', 32), 'hex'), clock_timestamp() + interval '1 day', 'b3000000-0000-0000-0000-000000000001');
insert into private.organization_membership_requests (id, organization_id, join_link_id, user_id, requested_role)
values ('b5000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000003', 'host');
insert into public.user_profiles (user_id, full_name, phone, address, occupancy_type)
values ('b1000000-0000-0000-0000-000000000003', 'Pending Host', '+2348000000000', 'Incorrect House', 'tenant')
on conflict (user_id) do update set full_name = excluded.full_name, phone = excluded.phone,
  address = excluded.address, occupancy_type = excluded.occupancy_type;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select public.review_organization_membership_request('b5000000-0000-0000-0000-000000000001', 'approve', 'host')$$,
  'P0001', 'host location must be verified before approval',
  'admin cannot approve an unverified host'
);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select public.verify_pending_host_location('b5000000-0000-0000-0000-000000000001', 'request', '10 Correct House', 'tenant')$$,
  'P0001', 'host location request is not available',
  'security cannot verify a host in another organization'
);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.list_pending_host_location_verifications()), 1::bigint, 'same-organization security sees the pending host');
select lives_ok(
  $$select public.verify_pending_host_location('b5000000-0000-0000-0000-000000000001', 'request', '10 Correct House', 'landlord')$$,
  'security can correct and verify the host location'
);
reset role;

select is((select address from public.user_profiles where user_id = 'b1000000-0000-0000-0000-000000000003'), '10 Correct House', 'verified address is saved to the host profile');
select is((select location_verified_by_membership_id from private.organization_membership_requests where id = 'b5000000-0000-0000-0000-000000000001'), 'b3000000-0000-0000-0000-000000000002'::uuid, 'request records the security verifier');
select is((select count(*) from public.audit_events where action = 'membership.host_location_verified' and actor_membership_id = 'b3000000-0000-0000-0000-000000000002'), 1::bigint, 'location verification is audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select public.review_organization_membership_request('b5000000-0000-0000-0000-000000000001', 'approve', 'host')$$,
  'admin can approve the verified host'
);
reset role;

select is((select location_verified_by_membership_id from public.organization_memberships where user_id = 'b1000000-0000-0000-0000-000000000003'), 'b3000000-0000-0000-0000-000000000002'::uuid, 'approved host retains the security verifier');
select is((select approved_by_membership_id from public.organization_memberships where user_id = 'b1000000-0000-0000-0000-000000000003'), 'b3000000-0000-0000-0000-000000000001'::uuid, 'approved host records the approving administrator');

update public.user_profiles set address = '11 Changed House' where user_id = 'b1000000-0000-0000-0000-000000000003';
select is((select location_verified_at from public.organization_memberships where user_id = 'b1000000-0000-0000-0000-000000000003'), null::timestamptz, 'changing an approved host address clears verification');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.list_pending_host_location_verifications() where verification_target_type = 'membership'), 1::bigint, 'security can see an active host requiring re-verification');
reset role;

select * from finish();
rollback;
