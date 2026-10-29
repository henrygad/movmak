begin;
select plan(3);

select ok(
  has_column_privilege('authenticated', 'public.user_profiles', 'address', 'UPDATE'),
  'authenticated users may update their profile address'
);

select ok(
  not has_column_privilege('authenticated', 'public.user_profiles', 'user_id', 'UPDATE'),
  'authenticated users cannot change profile ownership'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'user_profiles_update_self'
      and roles @> array['authenticated']::name[]
      and qual like '%auth.uid()%'
      and with_check like '%auth.uid()%'
  ),
  'profile updates remain restricted to auth.uid() by RLS'
);

select * from finish();
rollback;
