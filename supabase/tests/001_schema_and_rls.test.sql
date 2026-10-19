begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(88);

select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'user_profiles', 'user_profiles table exists');
select has_table('public', 'role_permissions', 'role_permissions table exists');
select has_table('public', 'organization_memberships', 'organization_memberships table exists');
select has_table('public', 'invitation_credentials', 'invitation_credentials table exists');
select has_table('public', 'host_verification_codes', 'host_verification_codes table exists');
select has_table('public', 'visitors', 'visitors table exists');
select has_table('public', 'visits', 'visits table exists');
select has_table('public', 'visit_qr_credentials', 'visit_qr_credentials table exists');
select has_table('public', 'host_code_attempts', 'host_code_attempts table exists');
select has_table('public', 'audit_events', 'audit_events table exists');

select ok(
  catalog.relrowsecurity and catalog.relforcerowsecurity,
  format('%I has enabled and forced RLS', catalog.relname)
)
from pg_catalog.pg_class as catalog
join pg_catalog.pg_namespace as namespace
  on namespace.oid = catalog.relnamespace
where namespace.nspname = 'public'
  and catalog.relname in (
    'organizations',
    'user_profiles',
    'role_permissions',
    'organization_memberships',
    'invitation_credentials',
    'host_verification_codes',
    'visitors',
    'visits',
    'visit_qr_credentials',
    'host_code_attempts',
    'audit_events'
  )
order by catalog.relname;

select is(
  (
    select count(*)::integer from pg_catalog.pg_policies
    where schemaname in ('public', 'private')
      and roles @> array['anon']::name[]
  ),
  0,
  'anonymous users have no application RLS policies'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'invitation_credentials',
        'host_verification_codes',
        'visit_qr_credentials',
        'host_code_attempts'
      )
  ),
  0,
  'credential and verification tables have no client policies'
);

select ok(
  (
    select count(*) = 1
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'organization_memberships'
  ) and exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'organization_memberships'
      and policyname = 'memberships_select_self_or_admin'
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
  ),
  'memberships have only the authenticated self-or-admin SELECT policy'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT')
    and not has_column_privilege('authenticated', 'public.organization_memberships', 'organization_id', 'INSERT'),
  'authenticated users cannot insert memberships directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.organization_memberships', 'role', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.organization_memberships', 'status', 'UPDATE'),
  'authenticated users cannot update membership roles or status directly'
);

select ok(
  has_function_privilege('authenticated', 'public.manage_organization_membership(uuid,uuid,public.organization_role,public.membership_status)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.manage_organization_membership(uuid,uuid,public.organization_role,public.membership_status)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.manage_organization_membership(uuid,uuid,public.organization_role,public.membership_status)', 'EXECUTE'),
  'membership management RPC is executable only by authenticated users'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'visits'
      and policyname = 'visits_select_admin_or_inside_security'
  ),
  'visit inventory policy exists'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'visitors'
      and policyname = 'visitors_select_admin_or_inside_security'
  ),
  'visitor detail policy exists'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'audit_events'
      and policyname = 'audit_events_select_admin'
  ),
  'audit policy exists'
);

select ok(
  not has_table_privilege('anon', 'public.visits', 'SELECT'),
  'anonymous users cannot select visits'
);

select ok(
  has_table_privilege('authenticated', 'public.visits', 'SELECT'),
  'authenticated users have policy-constrained visit select privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.visits', 'INSERT'),
  'authenticated users cannot insert visits directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.visits', 'UPDATE'),
  'authenticated users cannot update visits directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.invitation_credentials', 'SELECT'),
  'authenticated users cannot read invitation hashes'
);

select ok(
  not exists (
    select 1 from public.role_permissions
    where role = 'host' and permission in ('visit_view_all', 'visit_view_inside')
  ),
  'hosts receive no visitor inventory permission'
);

select ok(
  not exists (
    select 1 from public.role_permissions
    where role = 'security' and permission = 'visit_view_all'
  ),
  'security users cannot view full visit history'
);

select ok(
  exists (
    select 1 from public.role_permissions
    where role = 'admin' and permission = 'visit_view_all'
  ),
  'admins can view organization visit history'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.register_invited_visit(bytea,text,text,text,bytea,smallint)',
    'EXECUTE'
  ),
  'anonymous clients cannot call visitor registration directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.register_invited_visit(bytea,text,text,text,bytea,smallint)',
    'EXECUTE'
  ),
  'authenticated clients cannot call visitor registration directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.register_invited_visit(bytea,text,text,text,bytea,smallint)',
    'EXECUTE'
  ),
  'trusted service role can call visitor registration'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.verify_host_code(uuid,bytea)',
    'EXECUTE'
  ),
  'anonymous clients cannot verify host codes'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.verify_host_code(uuid,bytea)',
    'EXECUTE'
  ),
  'authenticated operators can verify host codes'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.verify_host_code(uuid,bytea)',
    'EXECUTE'
  ),
  'service role cannot bypass operator identity for host-code verification'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.check_in_visit_by_qr(bytea)',
    'EXECUTE'
  ),
  'anonymous clients cannot call QR check-in'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.check_in_visit_by_qr(bytea)',
    'EXECUTE'
  ),
  'authenticated operators can call QR check-in'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.check_in_visit_by_qr(bytea)',
    'EXECUTE'
  ),
  'service role cannot bypass operator identity for QR check-in'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.check_out_visit(uuid)',
    'EXECUTE'
  ),
  'anonymous clients cannot check visits out'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.check_out_visit(uuid)',
    'EXECUTE'
  ),
  'authenticated operators can check visits out'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.check_out_visit(uuid)',
    'EXECUTE'
  ),
  'service role cannot bypass operator identity for checkout'
);

select ok(
  to_regprocedure('public.verify_host_code(uuid,uuid,bytea)') is null,
  'forged-actor host-code function signature does not exist'
);

select ok(
  to_regprocedure('public.check_in_visit_by_qr(bytea,uuid)') is null,
  'forged-actor QR check-in function signature does not exist'
);

select ok(
  to_regprocedure('public.check_out_visit(uuid,uuid)') is null,
  'forged-actor checkout function signature does not exist'
);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org1-admin@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization One Admin"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org1-host@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization One Host"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org1-security@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization One Security"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org2-admin@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization Two Admin"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org2-host@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization Two Host"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'org2-security@example.test',
    '',
    clock_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Organization Two Security"}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  );

insert into public.organizations (id, name, slug, created_by_user_id)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Organization One',
    'organization-one',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Organization Two',
    'organization-two',
    '10000000-0000-0000-0000-000000000004'
  );

insert into public.organization_memberships (
  id,
  organization_id,
  user_id,
  role,
  status,
  created_by_user_id
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'admin',
    'active',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'host',
    'active',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'security',
    'active',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    'admin',
    'active',
    '10000000-0000-0000-0000-000000000004'
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    'host',
    'active',
    '10000000-0000-0000-0000-000000000004'
  ),
  (
    '30000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000006',
    'security',
    'active',
    '10000000-0000-0000-0000-000000000004'
  );

insert into public.visitors (
  id,
  organization_id,
  full_name,
  phone,
  phone_not_provided,
  created_by_membership_id
)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Test Visitor',
  null,
  true,
  '30000000-0000-0000-0000-000000000003'
);

insert into public.visits (
  id,
  organization_id,
  visitor_id,
  host_membership_id,
  entry_method,
  purpose,
  group_size,
  status,
  created_by_membership_id
)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'direct_gate',
  'RLS validation',
  1,
  'inside',
  '30000000-0000-0000-0000-000000000003'
);

insert into public.invitation_credentials (
  id,
  organization_id,
  host_membership_id,
  token_hash,
  valid_from,
  expires_at,
  created_by_membership_id
)
values (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  decode(repeat('11', 32), 'hex'),
  statement_timestamp(),
  statement_timestamp() + interval '5 minutes',
  '30000000-0000-0000-0000-000000000002'
);

insert into public.host_verification_codes (
  id,
  organization_id,
  host_membership_id,
  code_hash,
  valid_from,
  expires_at,
  created_by_membership_id
)
values (
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  decode(repeat('33', 32), 'hex'),
  statement_timestamp(),
  statement_timestamp() + interval '5 minutes',
  '30000000-0000-0000-0000-000000000002'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select is((select count(*) from public.visits), 1::bigint, 'org admin sees own organization visits');
select is((select count(*) from public.organization_memberships), 3::bigint, 'org admin sees only own organization memberships');
select ok((select count(*) from public.audit_events) > 0, 'org admin sees own organization audit events');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select is((select count(*) from public.visits), 0::bigint, 'host sees no visitor inventory');
select is((select count(*) from public.organization_memberships), 1::bigint, 'host sees only own membership');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select is((select count(*) from public.visits), 1::bigint, 'security sees currently-inside visits');
select is((select count(*) from public.organization_memberships), 1::bigint, 'security sees only own membership');
select is((select count(*) from public.audit_events), 0::bigint, 'security cannot read audit history');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select is((select count(*) from public.visits), 0::bigint, 'another organization admin cannot see org one visits');
select is((select count(*) from public.organization_memberships), 3::bigint, 'another organization admin sees only their organization memberships');

reset role;

set local role service_role;

select lives_ok(
  $$
    select *
    from public.register_invited_visit(
      decode(repeat('11', 32), 'hex'),
      'Invited Visitor',
      '+2348000000000',
      'Invitation replay test',
      decode(repeat('22', 32), 'hex'),
      1::smallint
    )
  $$,
  'service role can perform public visitor registration'
);

select throws_ok(
  $$
    select *
    from public.register_invited_visit(
      decode(repeat('11', 32), 'hex'),
      'Replay Visitor',
      '+2348000000001',
      'Replayed invitation',
      decode(repeat('23', 32), 'hex'),
      1::smallint
    )
  $$,
  'P0001',
  'registration credential is invalid or unavailable',
  'a consumed invitation credential cannot be replayed'
);

reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select *
    from public.verify_host_code(
      '20000000-0000-0000-0000-000000000001',
      decode(repeat('33', 32), 'hex')
    )
  $$,
  'P0001',
  'gate operation is not permitted',
  'an authenticated host cannot perform security verification'
);

select throws_ok(
  $$select * from public.check_in_visit_by_qr(decode(repeat('22', 32), 'hex'))$$,
  'P0001',
  'gate operation is not permitted',
  'an authenticated host cannot check a visit in'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select *
    from public.verify_host_code(
      '20000000-0000-0000-0000-000000000001',
      decode(repeat('33', 32), 'hex')
    )
  $$,
  'P0001',
  'gate operation is not permitted',
  'security from another organization cannot verify an org one host code'
);

select throws_ok(
  $$select * from public.check_in_visit_by_qr(decode(repeat('22', 32), 'hex'))$$,
  'P0001',
  'gate operation is not permitted',
  'security from another organization cannot check in an org one visit'
);

select throws_ok(
  $$select * from public.check_out_visit('50000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'gate operation is not permitted',
  'security from another organization cannot check out an org one visit'
);

reset role;

select is(
  (
    select status
    from public.visits
    where invitation_credential_id = '60000000-0000-0000-0000-000000000001'
  ),
  'expected'::public.visit_status,
  'cross-organization check-in leaves the invitation visit expected'
);

select is(
  (
    select status
    from public.visits
    where id = '50000000-0000-0000-0000-000000000001'
  ),
  'inside'::public.visit_status,
  'cross-organization checkout leaves the direct visit inside'
);

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select is(
  (
    select count(*)
    from public.verify_host_code(
      '20000000-0000-0000-0000-000000000001',
      decode(repeat('33', 32), 'hex')
    )
  ),
  1::bigint,
  'active org security can verify a current host code'
);

select lives_ok(
  $$select * from public.check_in_visit_by_qr(decode(repeat('22', 32), 'hex'))$$,
  'active org security can check in an expected visit'
);

select throws_ok(
  $$select * from public.check_in_visit_by_qr(decode(repeat('22', 32), 'hex'))$$,
  'P0001',
  'visit credential is invalid or unavailable',
  'an already-used QR cannot check the same visit in twice'
);

select lives_ok(
  $$
    select *
    from public.check_out_visit((
      select id
      from public.visits
      where invitation_credential_id = '60000000-0000-0000-0000-000000000001'
    ))
  $$,
  'active org security can check out an inside invitation visit'
);

select throws_ok(
  $$select * from public.check_in_visit_by_qr(decode(repeat('22', 32), 'hex'))$$,
  'P0001',
  'visit credential is invalid or unavailable',
  'a closed visit QR cannot be replayed'
);

select lives_ok(
  $$select * from public.check_out_visit('50000000-0000-0000-0000-000000000001')$$,
  'active org security can check out an inside direct visit'
);

select throws_ok(
  $$select * from public.check_out_visit('50000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'visit is not available for checkout',
  'a closed visit cannot be checked out twice'
);

reset role;

select is(
  (
    select attempted_by_membership_id
    from public.host_code_attempts
    where succeeded = true
    order by id desc
    limit 1
  ),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'host-code verification records the authenticated security membership'
);

select is(
  (
    select checked_in_by_membership_id
    from public.visits
    where invitation_credential_id = '60000000-0000-0000-0000-000000000001'
  ),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'check-in records the authenticated security membership'
);

select is(
  (
    select actor_user_id
    from public.audit_events
    where action = 'visit.checked_in'
      and target_id = (
        select id
        from public.visits
        where invitation_credential_id = '60000000-0000-0000-0000-000000000001'
      )
    order by id desc
    limit 1
  ),
  '10000000-0000-0000-0000-000000000003'::uuid,
  'check-in audit identity comes from the authenticated session'
);

select is(
  (
    select checked_out_by_membership_id
    from public.visits
    where id = '50000000-0000-0000-0000-000000000001'
  ),
  '30000000-0000-0000-0000-000000000003'::uuid,
  'checkout records the authenticated security membership'
);

select throws_ok(
  $$
    update public.visits
    set status = 'inside'
    where id = '50000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'invalid visit status transition',
  'a closed direct visit cannot transition back to inside'
);

select throws_ok(
  $$
    update public.visits
    set status = 'expected'
    where invitation_credential_id = '60000000-0000-0000-0000-000000000001'
  $$,
  'P0001',
  'invalid visit status transition',
  'a closed invitation visit cannot transition back to expected'
);

select ok(
  (
    select consumed_at is not null
    from public.invitation_credentials
    where id = '60000000-0000-0000-0000-000000000001'
  ),
  'successful registration permanently consumes its invitation credential'
);

select ok(
  (
    select revoked_at is not null
    from public.visit_qr_credentials
    where token_hash = decode(repeat('22', 32), 'hex')
  ),
  'checkout permanently revokes the visit QR credential'
);

select * from finish();
rollback;
