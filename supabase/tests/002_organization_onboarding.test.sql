begin;
select plan(25);

select has_function(
  'public',
  'create_organization_with_admin',
  array['text', 'text', 'text'],
  'organization onboarding function exists'
);
select function_lang_is(
  'public',
  'create_organization_with_admin',
  array['text', 'text', 'text'],
  'plpgsql',
  'organization onboarding function uses plpgsql'
);
select is(
  (select prosecdef from pg_catalog.pg_proc where oid = 'public.create_organization_with_admin(text,text,text)'::regprocedure),
  true,
  'organization onboarding function is security definer'
);
select is(
  (select proconfig from pg_catalog.pg_proc where oid = 'public.create_organization_with_admin(text,text,text)'::regprocedure),
  array['search_path='],
  'organization onboarding function has an empty search path'
);
select ok(
  not has_function_privilege('anon', 'public.create_organization_with_admin(text,text,text)', 'EXECUTE'),
  'anonymous users cannot create organizations'
);
select ok(
  has_function_privilege('authenticated', 'public.create_organization_with_admin(text,text,text)', 'EXECUTE'),
  'authenticated users can request organization onboarding'
);
select ok(
  not has_function_privilege('service_role', 'public.create_organization_with_admin(text,text,text)', 'EXECUTE'),
  'service role cannot forge onboarding identity'
);
select throws_ok(
  $$select * from public.create_organization_with_admin('Test', 'test', 'Africa/Lagos')$$,
  '42501',
  'authentication is required',
  'onboarding requires an authenticated database identity'
);
select ok(
  to_regprocedure('public.create_organization_with_admin(uuid,text,text,text)') is null,
  'onboarding does not accept a caller-supplied actor UUID'
);

select ok(pg_get_functiondef('public.create_organization_with_admin(text,text,text)'::regprocedure) like '%pg_advisory_xact_lock%', 'same-user attempts are serialized');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'platform@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new-admin@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'duplicate@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suspended@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoked@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('81000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invalid@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());

insert into public.organizations (id, name, slug, created_by_user_id)
values
  ('82000000-0000-0000-0000-000000000001', 'Existing Active', 'existing-active', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', 'Existing Suspended', 'existing-suspended', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000003', 'Existing Revoked', 'existing-revoked', '81000000-0000-0000-0000-000000000001');

insert into public.organization_memberships (organization_id, user_id, role, status, created_by_user_id)
values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000004', 'admin', 'active', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000005', 'admin', 'suspended', '81000000-0000-0000-0000-000000000001'),
  ('82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000006', 'admin', 'revoked', '81000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
create temporary table onboarding_result on commit drop as select * from public.create_organization_with_admin('Approved Organization', 'approved-organization', 'Africa/Lagos');
reset role;
select is((select count(*) from onboarding_result), 1::bigint, 'successful onboarding returns one row');
select ok((select organization_id is not null and membership_id is not null from onboarding_result), 'returned IDs are populated');
select ok(exists(select 1 from public.organizations o join onboarding_result r on r.organization_id = o.id where o.slug = 'approved-organization'), 'returned organization exists');
select ok(exists(select 1 from public.organization_memberships m join onboarding_result r on r.membership_id = m.id where m.organization_id = r.organization_id and m.user_id = '81000000-0000-0000-0000-000000000002' and m.role = 'admin' and m.status = 'active'), 'returned membership is active admin');
select ok(exists(select 1 from public.audit_events a join onboarding_result r on r.organization_id = a.organization_id where a.action = 'organization.created'), 'organization creation is audited');
select ok(exists(select 1 from public.audit_events a join onboarding_result r on r.organization_id = a.organization_id where a.action = 'membership.created'), 'membership creation is audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from public.create_organization_with_admin('Duplicate Organization', 'approved-organization', 'Africa/Lagos')$$, '23505', null, 'duplicate slug fails safely');
reset role;
select is((select count(*) from public.organization_memberships where user_id = '81000000-0000-0000-0000-000000000003'), 0::bigint, 'duplicate slug leaves no membership');
select is((select count(*) from public.organizations where created_by_user_id = '81000000-0000-0000-0000-000000000003'), 0::bigint, 'duplicate slug leaves no organization');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select throws_ok($$select * from public.create_organization_with_admin('Blocked Active', 'blocked-active', 'Africa/Lagos')$$, 'P0001', 'organization onboarding is not available', 'active member is rejected');
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
select throws_ok($$select * from public.create_organization_with_admin('Blocked Suspended', 'blocked-suspended', 'Africa/Lagos')$$, 'P0001', 'organization onboarding is not available', 'suspended member is rejected');
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select throws_ok($$select * from public.create_organization_with_admin('Blocked Revoked', 'blocked-revoked', 'Africa/Lagos')$$, 'P0001', 'organization onboarding is not available', 'revoked member is rejected');
select set_config('request.jwt.claims', '{"sub":"81000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
select throws_ok($$select * from public.create_organization_with_admin('', 'valid-slug', 'Africa/Lagos')$$, 'P0001', 'organization name is invalid', 'invalid name is rejected');
select throws_ok($$select * from public.create_organization_with_admin('Valid Name', 'INVALID SLUG', 'Africa/Lagos')$$, 'P0001', 'organization slug is invalid', 'invalid slug is rejected');
select throws_ok($$select * from public.create_organization_with_admin('Valid Name', 'valid-slug', 'Invalid/Timezone')$$, 'P0001', 'organization timezone is invalid', 'invalid timezone is rejected');
reset role;

select * from finish();
rollback;
