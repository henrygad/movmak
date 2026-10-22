begin;
select plan(18);

select has_function('public', 'preview_organization_join_link', array['bytea'], 'join-link preview exists');
select has_function('public', 'get_my_organization_join_request', array[]::text[], 'own-request status exists');
select ok(has_function_privilege('anon', 'public.preview_organization_join_link(bytea)', 'EXECUTE'), 'anon may preview a bearer join link');
select ok(has_function_privilege('authenticated', 'public.preview_organization_join_link(bytea)', 'EXECUTE'), 'signed-in user may preview a bearer join link');
select ok(not has_function_privilege('service_role', 'public.preview_organization_join_link(bytea)', 'EXECUTE'), 'service role has no preview grant');
select ok(has_function_privilege('authenticated', 'public.get_my_organization_join_request()', 'EXECUTE'), 'signed-in applicant may read own status');
select ok(not has_function_privilege('anon', 'public.get_my_organization_join_request()', 'EXECUTE'), 'anon cannot read applicant status');
select ok(not has_function_privilege('service_role', 'public.get_my_organization_join_request()', 'EXECUTE'), 'service role cannot impersonate an applicant');
select ok(pg_get_functiondef('public.create_organization_with_admin(text,text,text)'::regprocedure) like '%organization_membership_requests%', 'organization creation rejects a pending applicant');
select ok(pg_get_functiondef('public.review_organization_membership_request(uuid,text,public.organization_role)'::regprocedure) like '%assigned role must match the invitation role%', 'approval preserves the role stored by the invitation');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('97000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visibility-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('97000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visibility-applicant@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('97000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'visibility-other@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());

insert into public.organizations (id, name, slug, created_by_user_id)
values ('98000000-0000-0000-0000-000000000001', 'Visibility Test Org', 'visibility-test-org', '97000000-0000-0000-0000-000000000001');
insert into public.organization_memberships (id, organization_id, user_id, role, status, created_by_user_id)
values ('99000000-0000-0000-0000-000000000001', '98000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000001', 'admin', 'active', '97000000-0000-0000-0000-000000000001');
insert into private.organization_join_links (id, organization_id, default_role, token_hash, expires_at, created_by_membership_id)
values ('9a000000-0000-0000-0000-000000000001', '98000000-0000-0000-0000-000000000001', 'host', decode(repeat('a1', 32), 'hex'), clock_timestamp() + interval '1 day', '99000000-0000-0000-0000-000000000001');
insert into private.organization_join_links (id, organization_id, default_role, token_hash, created_at, expires_at, created_by_membership_id)
values ('9a000000-0000-0000-0000-000000000002', '98000000-0000-0000-0000-000000000001', 'security', decode(repeat('a3', 32), 'hex'), clock_timestamp() - interval '2 days', clock_timestamp() - interval '1 day', '99000000-0000-0000-0000-000000000001');
insert into private.organization_membership_requests (organization_id, join_link_id, user_id, requested_role)
values ('98000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', '97000000-0000-0000-0000-000000000002', 'host');

set local role anon;
select is((select requested_role from public.preview_organization_join_link(decode(repeat('a1', 32), 'hex'))), 'host'::public.organization_role, 'valid bearer link reveals intended role');
select is((select count(*) from public.preview_organization_join_link(decode(repeat('a2', 32), 'hex'))), 0::bigint, 'unknown token reveals nothing');
select is((select count(*) from public.preview_organization_join_link(decode(repeat('a3', 32), 'hex'))), 0::bigint, 'expired link reveals nothing');
reset role;

update private.organization_join_links set revoked_at = clock_timestamp() where id = '9a000000-0000-0000-0000-000000000001';
set local role anon;
select is((select count(*) from public.preview_organization_join_link(decode(repeat('a1', 32), 'hex'))), 0::bigint, 'revoked link reveals nothing');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select request_status from public.get_my_organization_join_request()), 'pending', 'applicant sees own pending status');
select is((select requested_role from public.get_my_organization_join_request()), 'host'::public.organization_role, 'applicant sees assigned join role');
select throws_ok($$select * from public.create_organization_with_admin('Wrong Org', 'wrong-org', 'Africa/Lagos')$$, 'P0001', 'organization onboarding is not available', 'pending applicant cannot create a different organization');
select set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.get_my_organization_join_request()), 0::bigint, 'another user cannot see applicant status');
reset role;

select * from finish();
rollback;
