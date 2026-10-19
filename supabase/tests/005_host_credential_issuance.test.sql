begin;
select plan(16);

select has_function('public', 'issue_host_credentials', array['bytea', 'bytea'], 'host issuance RPC exists');
select ok(has_function_privilege('authenticated', 'public.issue_host_credentials(bytea,bytea)', 'EXECUTE'), 'authenticated hosts may call issuance');
select ok(not has_function_privilege('anon', 'public.issue_host_credentials(bytea,bytea)', 'EXECUTE'), 'anonymous callers cannot issue host credentials');
select ok(not has_function_privilege('service_role', 'public.issue_host_credentials(bytea,bytea)', 'EXECUTE'), 'service role cannot forge host identity');
select ok(to_regprocedure('public.issue_host_credentials(uuid,bytea,bytea)') is null, 'issuance accepts no forged host identifier');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'host-limit@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'security-limit@example.test', '', clock_timestamp(), '{"provider":"email","providers":["email"]}', '{}', clock_timestamp(), clock_timestamp());
insert into public.organizations (id, name, slug, created_by_user_id)
values ('a2000000-0000-0000-0000-000000000001', 'Host Credential Test', 'host-credential-test', 'a1000000-0000-0000-0000-000000000001');
insert into public.organization_memberships (id, organization_id, user_id, role, status, created_by_user_id)
values
  ('a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'host', 'active', 'a1000000-0000-0000-0000-000000000001'),
  ('a3000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'security', 'active', 'a1000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.issue_host_credentials(decode(repeat('11', 32), 'hex'), decode(repeat('21', 32), 'hex'))$$,
  'P0001', 'host operation is not permitted', 'security role cannot issue host credentials'
);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($test$
  do $do$ begin
    for i in 1..5 loop
      perform * from public.issue_host_credentials(
        decode(lpad(to_hex(i), 64, '0'), 'hex'),
        decode(lpad(to_hex(i + 100), 64, '0'), 'hex')
      );
    end loop;
  end $do$;
$test$, 'five authenticated host issuances succeed within the permitted minute');
reset role;

select is((select count(*) from public.invitation_credentials where host_membership_id = 'a3000000-0000-0000-0000-000000000001'), 5::bigint, 'five invitation credentials were created');
select is((select count(*) from public.invitation_credentials where host_membership_id = 'a3000000-0000-0000-0000-000000000001' and revoked_at is null), 1::bigint, 'only the newest invitation remains unrevoked');
select is((select count(*) from public.host_verification_codes where host_membership_id = 'a3000000-0000-0000-0000-000000000001' and revoked_at is null), 1::bigint, 'only the newest host code remains unrevoked');
select ok((select bool_and(expires_at = valid_from + interval '5 minutes') from public.invitation_credentials where host_membership_id = 'a3000000-0000-0000-0000-000000000001'), 'invitation expiry is exactly five minutes after validity starts');
select ok((select bool_and(expires_at = valid_from + interval '5 minutes') from public.host_verification_codes where host_membership_id = 'a3000000-0000-0000-0000-000000000001'), 'host code expiry is exactly five minutes after validity starts');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.issue_host_credentials(decode(repeat('16', 32), 'hex'), decode(repeat('26', 32), 'hex'))$$,
  'P0001', 'host credential issuance is rate limited', 'the sixth issuance is rejected'
);
reset role;
select is((select count(*) from public.invitation_credentials where host_membership_id = 'a3000000-0000-0000-0000-000000000001'), 5::bigint, 'rate limit leaves no partial new invitation');
select is((select count(*) from public.audit_events where action = 'invitation.issued' and actor_membership_id = 'a3000000-0000-0000-0000-000000000001'), 5::bigint, 'successful issuance is audited without raw secrets');
select is((select count(*) from public.audit_events where action = 'invitation.revoked' and organization_id = 'a2000000-0000-0000-0000-000000000001'), 4::bigint, 'rotation revocations are audited');

select * from finish();
rollback;
