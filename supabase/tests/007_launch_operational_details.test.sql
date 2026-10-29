begin;
select plan(17);

select has_column('public', 'organizations', 'website_url', 'organizations store an official website');
select has_column('public', 'user_profiles', 'address', 'host profiles store a house or unit address');
select has_function('public', 'update_organization_settings', array['text', 'text'], 'organization settings RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.update_organization_settings(text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.update_organization_settings(text,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.update_organization_settings(text,text)', 'EXECUTE'),
  'organization settings are authenticated-only'
);
select ok(
  pg_get_functiondef('public.update_organization_settings(text,text)'::regprocedure) like '%role = ''admin''%'
    and pg_get_functiondef('public.update_organization_settings(text,text)'::regprocedure) like '%status = ''active''%',
  'organization settings derive an active administrator from auth.uid()'
);
select ok(
  exists(select 1 from storage.buckets where id = 'organization-logos' and public and file_size_limit = 2097152),
  'organization logo bucket is public with a two-megabyte storage limit'
);
select is(
  (select count(*) from pg_catalog.pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'organization_logos_admin_%'),
  4::bigint,
  'logo access has select, insert, update, and delete policies'
);
select ok(
  pg_get_functiondef('public.manage_organization_membership(uuid,uuid,public.organization_role,public.membership_status)'::regprocedure)
    like '%membership roles cannot be changed%',
  'membership management rejects role changes'
);
select has_function('public', 'update_visit_companions', array['uuid', 'smallint'], 'companion update RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.update_visit_companions(uuid,smallint)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.update_visit_companions(uuid,smallint)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.update_visit_companions(uuid,smallint)', 'EXECUTE'),
  'companion updates are authenticated-only'
);
select ok(
  pg_get_functiondef('public.update_visit_companions(uuid,smallint)'::regprocedure) like '%role = ''security''%'
    and pg_get_functiondef('public.update_visit_companions(uuid,smallint)'::regprocedure) like '%organization_id = actor.organization_id%',
  'companion updates derive an active same-organization security actor'
);
select ok(
  pg_get_functiondef('public.update_visit_companions(uuid,smallint)'::regprocedure) like '%for update%'
    and pg_get_functiondef('public.update_visit_companions(uuid,smallint)'::regprocedure) like '%visit.companions_updated%',
  'companion updates lock the visit and write an audit event'
);
select ok(
  pg_get_functiondef('public.update_visit_companions(uuid,smallint)'::regprocedure) like '%p_companion_count + 1%',
  'companion count converts to total group size including the primary visitor'
);
select ok(
  pg_get_functiondef('private.enforce_visit_mutation()'::regprocedure) like '%new.group_size <> old.group_size%'
    and pg_get_functiondef('private.enforce_visit_mutation()'::regprocedure) like '%new.status not in (''expected'', ''inside'')%'
    and pg_get_functiondef('private.enforce_visit_mutation()'::regprocedure) like '%membership.role = ''security''%'
    and pg_get_functiondef('private.enforce_visit_mutation()'::regprocedure) like '%auth.uid()%'
    and pg_get_functiondef('private.enforce_visit_mutation()'::regprocedure) like '%membership.organization_id = new.organization_id%',
  'visit trigger permits companion corrections only for active same-organization security users'
);
select ok(
  pg_get_functiondef('public.issue_host_credentials(bytea,bytea)'::regprocedure) like '%profile.phone is not null%'
    and pg_get_functiondef('public.issue_host_credentials(bytea,bytea)'::regprocedure) like '%profile.address is not null%',
  'host credentials require phone and address'
);
select ok(
  pg_get_function_result('public.preview_visit_by_qr(bytea)'::regprocedure) like '%host_phone%'
    and pg_get_function_result('public.preview_visit_by_qr(bytea)'::regprocedure) like '%host_address%',
  'QR preview returns host contact details to authorized security callers'
);
select ok(
  pg_get_function_result('public.get_currently_inside()'::regprocedure) like '%host_phone%'
    and pg_get_function_result('public.get_currently_inside()'::regprocedure) like '%host_address%',
  'currently-inside results include host contact details'
);

select * from finish();
rollback;
