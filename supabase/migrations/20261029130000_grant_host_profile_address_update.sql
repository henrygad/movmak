begin;

-- The address column was added after the original column-level profile grant.
-- RLS continues to restrict authenticated users to their own profile row.
grant update (address) on table public.user_profiles to authenticated;

commit;
