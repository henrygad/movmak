begin;
select plan(11);

select has_table('private', 'organization_membership_invitations', 'private invitation table exists');
select ok(not has_table_privilege('anon', 'private.organization_membership_invitations', 'SELECT'), 'anon cannot read invitations');
select ok(not has_table_privilege('authenticated', 'private.organization_membership_invitations', 'SELECT'), 'authenticated cannot read invitations');
select ok(not has_table_privilege('service_role', 'private.organization_membership_invitations', 'SELECT'), 'service role cannot read invitations');
select ok(not has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT'), 'members cannot bypass join approval with direct inserts');
select ok(not has_column_privilege('authenticated', 'public.organization_memberships', 'organization_id', 'INSERT'), 'membership insert column grants are revoked');
select ok(not has_function_privilege('authenticated', 'public.create_membership_invitation(uuid,text,public.organization_role,bytea,timestamptz)', 'EXECUTE'), 'legacy invitation creation is retired');
select ok(not has_function_privilege('authenticated', 'public.accept_membership_invitation(bytea)', 'EXECUTE'), 'legacy immediate-activation acceptance is retired');
select ok(not has_function_privilege('authenticated', 'public.revoke_membership_invitation(uuid,uuid)', 'EXECUTE'), 'legacy invitation revocation is retired');
select ok(not has_function_privilege('anon', 'public.accept_membership_invitation(bytea)', 'EXECUTE'), 'anon cannot accept invitations');
select ok(not has_function_privilege('service_role', 'public.accept_membership_invitation(bytea)', 'EXECUTE'), 'service role cannot forge invitation acceptance identity');
/* Historical immediate-activation tests retained for reference. The secure
   join-link migration revokes these RPCs and 004_secure_join_links.test.sql
   exercises the replacement request-and-approval workflow.
select ok(pg_get_functiondef('public.accept_membership_invitation(bytea)'::regprocedure) like '%pg_advisory_xact_lock%', 'acceptance serializes per user');
select ok(pg_get_functiondef('public.accept_membership_invitation(bytea)'::regprocedure) like '%for update of invitation%', 'acceptance locks the credential against replay');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'worker@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('91000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wrong@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('91000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoked@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('91000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());

insert into public.organizations (id, name, slug, created_by_user_id)
values
  ('92000000-0000-0000-0000-000000000001', 'Invitation Org', 'invitation-org', '91000000-0000-0000-0000-000000000001'),
  ('92000000-0000-0000-0000-000000000002', 'Other Org', 'other-invitation-org', '91000000-0000-0000-0000-000000000005');
insert into public.organization_memberships (id, organization_id, user_id, role, status, created_by_user_id)
values
  ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'admin', 'active', '91000000-0000-0000-0000-000000000001'),
  ('93000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000005', 'admin', 'active', '91000000-0000-0000-0000-000000000005');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temporary table invitation_result on commit drop as
select * from public.create_membership_invitation('92000000-0000-0000-0000-000000000001', 'WORKER@example.test', 'host', decode(repeat('11', 32), 'hex'), clock_timestamp() + interval '2 days');
reset role;
select is((select count(*) from invitation_result), 1::bigint, 'active admin creates one invitation');
select is((select invited_email from private.organization_membership_invitations where token_hash = decode(repeat('11', 32), 'hex')), 'worker@example.test', 'invited email is normalized');
select is((select role from private.organization_membership_invitations where token_hash = decode(repeat('11', 32), 'hex')), 'host'::public.organization_role, 'administrator controls assigned role');
select ok(exists(select 1 from public.audit_events where action = 'membership.invitation_created' and organization_id = '92000000-0000-0000-0000-000000000001'), 'invitation creation is audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from public.accept_membership_invitation(decode(repeat('11', 32), 'hex'))$$, 'P0001', 'membership invitation is invalid or unavailable', 'mismatched email cannot accept');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select * from public.accept_membership_invitation(decode(repeat('11', 32), 'hex'))$$, 'matching verified user accepts');
select throws_ok($$select * from public.accept_membership_invitation(decode(repeat('11', 32), 'hex'))$$, 'P0001', 'membership invitation is not available', 'consumed invitation cannot be replayed');
reset role;
select ok(exists(select 1 from public.organization_memberships where user_id = '91000000-0000-0000-0000-000000000002' and organization_id = '92000000-0000-0000-0000-000000000001' and role = 'host' and status = 'active'), 'acceptance creates the assigned active membership');
select ok((select consumed_at is not null and consumed_by_user_id = '91000000-0000-0000-0000-000000000002' from private.organization_membership_invitations where token_hash = decode(repeat('11', 32), 'hex')), 'acceptance consumes the invitation');
select ok(exists(select 1 from public.audit_events where action = 'membership.invitation_accepted' and organization_id = '92000000-0000-0000-0000-000000000001'), 'invitation acceptance is audited');
select throws_ok($$insert into public.organization_memberships (organization_id,user_id,role,status,created_by_user_id) values ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000002','host','active','91000000-0000-0000-0000-000000000005')$$, '23505', null, 'one user cannot join a second organization');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temporary table revoked_invitation on commit drop as
select * from public.create_membership_invitation('92000000-0000-0000-0000-000000000001', 'revoked@example.test', 'security', decode(repeat('22', 32), 'hex'), clock_timestamp() + interval '2 days');
select is(public.revoke_membership_invitation('92000000-0000-0000-0000-000000000001', (select invitation_id from revoked_invitation)), true, 'issuing organization admin revokes an invitation');
select throws_ok($$select * from public.create_membership_invitation('92000000-0000-0000-0000-000000000001', 'bad@example.test', 'host', decode(repeat('33', 32), 'hex'), clock_timestamp() + interval '8 days')$$, 'P0001', 'invitation expiry is invalid', 'invitation lifetime is capped');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select public.revoke_membership_invitation('92000000-0000-0000-0000-000000000001', (select invitation_id from revoked_invitation))$$, 'P0001', 'membership invitation is not permitted', 'cross-organization admin cannot revoke');
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$select * from public.accept_membership_invitation(decode(repeat('22', 32), 'hex'))$$, 'P0001', 'membership invitation is invalid or unavailable', 'revoked invitation cannot be accepted');
reset role;
*/

select * from finish();
rollback;
