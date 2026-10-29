begin;

-- Supabase Storage upserts require SELECT as well as INSERT and UPDATE.
-- Keep reads scoped to active administrators and their own organization folder.
create policy organization_logos_admin_select on storage.objects
for select to authenticated
using (
  bucket_id = 'organization-logos' and exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = (select auth.uid()) and membership.role = 'admin'
      and membership.status = 'active'
      and membership.organization_id::text = (storage.foldername(name))[1]
  )
);

commit;
