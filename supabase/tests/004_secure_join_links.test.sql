begin;
select plan(43);

select has_table('private', 'organization_join_links', 'private reusable join links exist');
select has_table('private', 'organization_membership_requests', 'private membership requests exist');
select ok(not has_table_privilege('anon', 'private.organization_join_links', 'SELECT'), 'anon cannot read join-link hashes');
select ok(not has_table_privilege('authenticated', 'private.organization_join_links', 'SELECT'), 'members cannot read join-link hashes');
select ok(not has_table_privilege('service_role', 'private.organization_join_links', 'SELECT'), 'service role cannot read join-link hashes directly');
select ok(not has_table_privilege('authenticated', 'private.organization_membership_requests', 'SELECT'), 'members cannot read requests directly');
select ok(has_function_privilege('authenticated', 'public.request_organization_membership(bytea)', 'EXECUTE'), 'authenticated users can request membership');
select ok(not has_function_privilege('anon', 'public.request_organization_membership(bytea)', 'EXECUTE'), 'anon cannot request membership');
select ok(not has_function_privilege('service_role', 'public.request_organization_membership(bytea)', 'EXECUTE'), 'service role cannot forge requests');
select ok(not has_function_privilege('anon', 'public.review_organization_membership_request(uuid,text,public.organization_role)', 'EXECUTE'), 'anon cannot review requests');
select ok(not has_function_privilege('service_role', 'public.review_organization_membership_request(uuid,text,public.organization_role)', 'EXECUTE'), 'service role cannot forge reviewer identity');
select ok(pg_get_functiondef('public.request_organization_membership(bytea)'::regprocedure) like '%email_confirmed_at is not null%', 'request requires verified email');
select ok(pg_get_functiondef('public.request_organization_membership(bytea)'::regprocedure) like '%pg_advisory_xact_lock%', 'request serializes by user');
select ok(pg_get_functiondef('public.request_organization_membership(bytea)'::regprocedure) like '%revoked_at is null%', 'request rejects revoked links');
select ok(pg_get_functiondef('public.request_organization_membership(bytea)'::regprocedure) like '%expires_at > clock_timestamp()%', 'request rejects expired links at validation time');
select ok(pg_get_functiondef('public.review_organization_membership_request(uuid,text,public.organization_role)'::regprocedure) like '%self approval is not permitted%', 'self approval is rejected');
select ok(pg_get_functiondef('public.review_organization_membership_request(uuid,text,public.organization_role)'::regprocedure) like '%user already has an organization membership%', 'approval preserves one-organization rule');
select ok(pg_get_functiondef('public.rotate_organization_join_link(uuid,bytea,timestamptz)'::regprocedure) like '%set revoked_at = clock_timestamp()%', 'rotation revokes the previous link');
select ok(pg_get_functiondef('public.review_organization_membership_request(uuid,text,public.organization_role)'::regprocedure) like '%membership.request_approved%', 'approval is audited');
select ok(pg_get_functiondef('public.review_organization_membership_request(uuid,text,public.organization_role)'::regprocedure) like '%membership.request_rejected%', 'rejection is audited');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('94000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'join-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{"full_name":"Join Admin"}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'requester@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{"full_name":"Requester"}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'unverified@example.test', '', null, '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'existing@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoked-link@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rotated-link@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('94000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rejected@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());

insert into public.organizations (id, name, slug, created_by_user_id)
values
  ('95000000-0000-0000-0000-000000000001', 'Join Link Org', 'join-link-org', '94000000-0000-0000-0000-000000000001'),
  ('95000000-0000-0000-0000-000000000002', 'Other Join Org', 'other-join-org', '94000000-0000-0000-0000-000000000004');
insert into public.organization_memberships (id, organization_id, user_id, role, status, created_by_user_id)
values
  ('96000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', 'admin', 'active', '94000000-0000-0000-0000-000000000001'),
  ('96000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000004', 'admin', 'active', '94000000-0000-0000-0000-000000000004'),
  ('96000000-0000-0000-0000-000000000003', '95000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000005', 'host', 'suspended', '94000000-0000-0000-0000-000000000004');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temporary table join_link_result on commit drop as
select * from public.create_organization_join_link('host', decode(repeat('41', 32), 'hex'), clock_timestamp() + interval '7 days');
reset role;
select is((select count(*) from join_link_result), 1::bigint, 'active administrator creates a reusable join link');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
create temporary table request_result on commit drop as select * from public.request_organization_membership(decode(repeat('41', 32), 'hex'));
reset role;
select is((select organization_id from request_result), '95000000-0000-0000-0000-000000000001'::uuid, 'request returns the link organization');
select is((select requested_role from request_result), 'host'::public.organization_role, 'request returns the link default role');
select ok(not exists(select 1 from public.organization_memberships where user_id = '94000000-0000-0000-0000-000000000002'), 'pending request grants no membership');
select ok(exists(select 1 from public.audit_events where action = 'membership.requested' and organization_id = '95000000-0000-0000-0000-000000000001'), 'request is audited');
select ok(exists(select 1 from public.audit_events where action = 'membership.requested' and event_data->>'requester_user_id' = '94000000-0000-0000-0000-000000000002'), 'request audit records the verified requester identity');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(format('select public.review_organization_membership_request(%L, %L, %L)', (select request_id from request_result), 'approve', 'security'), 'administrator approves a pending request');
reset role;
select ok(exists(select 1 from public.organization_memberships where user_id = '94000000-0000-0000-0000-000000000002' and role = 'security' and status = 'active'), 'approval creates the selected active membership');
select is((select status from private.organization_membership_requests where id = (select request_id from request_result)), 'approved', 'approved request records its final state');
select ok(exists(select 1 from public.audit_events where action = 'membership.request_approved' and target_id = (select request_id from request_result)), 'approval is audited at runtime');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select * from public.request_organization_membership(decode(repeat('41', 32), 'hex'))$$, 'P0001', 'membership request is not available', 'suspended membership cannot bypass the one-organization rule');
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from public.request_organization_membership(decode(repeat('41', 32), 'hex'))$$, 'P0001', 'a verified email is required', 'unverified account cannot request membership');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temporary table revoked_link on commit drop as select * from public.create_organization_join_link('host', decode(repeat('42', 32), 'hex'), clock_timestamp() + interval '7 days');
select is(public.revoke_organization_join_link((select join_link_id from revoked_link)), true, 'administrator revokes a join link');
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select throws_ok($$select * from public.request_organization_membership(decode(repeat('42', 32), 'hex'))$$, 'P0001', 'join link is invalid or unavailable', 'revoked link cannot create a request');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temporary table rotation_source on commit drop as select * from public.create_organization_join_link('host', decode(repeat('43', 32), 'hex'), clock_timestamp() + interval '7 days');
create temporary table rotation_result on commit drop as select * from public.rotate_organization_join_link((select join_link_id from rotation_source), decode(repeat('44', 32), 'hex'), clock_timestamp() + interval '7 days');
reset role;
select ok((select revoked_at is not null from private.organization_join_links where id = (select join_link_id from rotation_source)), 'rotation revokes the old database record');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$select * from public.request_organization_membership(decode(repeat('43', 32), 'hex'))$$, 'P0001', 'join link is invalid or unavailable', 'rotated credential cannot be replayed');
select lives_ok($$select * from public.request_organization_membership(decode(repeat('44', 32), 'hex'))$$, 'replacement credential creates a pending request');
reset role;
select ok(exists(select 1 from private.organization_membership_requests where user_id = '94000000-0000-0000-0000-000000000007' and status = 'pending'), 'replacement credential remains pending until review');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok(format('select public.review_organization_membership_request(%L, %L, %L)', (select id from private.organization_membership_requests where user_id = '94000000-0000-0000-0000-000000000007'), 'approve', 'host'), 'P0001', 'membership request is not available', 'cross-organization administrator cannot review a request');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
create temporary table rejected_request on commit drop as select * from public.request_organization_membership(decode(repeat('41', 32), 'hex'));
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(format('select public.review_organization_membership_request(%L, %L, %L)', (select request_id from rejected_request), 'reject', 'host'), 'administrator rejects a pending request');
reset role;
select is((select status from private.organization_membership_requests where id = (select request_id from rejected_request)), 'rejected', 'rejection records its final state');
select ok(not exists(select 1 from public.organization_memberships where user_id = '94000000-0000-0000-0000-000000000008'), 'rejection creates no membership');
select ok(exists(select 1 from public.audit_events where action = 'membership.request_rejected' and target_id = (select request_id from rejected_request)), 'rejection is audited at runtime');

select * from finish();
rollback;
