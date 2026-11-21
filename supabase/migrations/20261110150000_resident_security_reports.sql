create table public.resident_security_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  resident_membership_id uuid not null,
  category text not null,
  details text not null,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'resolved')),
  submitted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  updated_by_membership_id uuid,
  constraint resident_security_reports_resident_fk foreign key (resident_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint resident_security_reports_updater_fk foreign key (updated_by_membership_id, organization_id)
    references public.organization_memberships(id, organization_id) on delete restrict,
  constraint resident_security_reports_category_length check (char_length(btrim(category)) between 2 and 80),
  constraint resident_security_reports_details_length check (char_length(btrim(details)) between 10 and 2000),
  constraint resident_security_reports_resolution_consistent check (
    (status <> 'resolved' and resolved_at is null) or (status = 'resolved' and resolved_at is not null)
  )
);
create index resident_security_reports_org_status_idx on public.resident_security_reports(organization_id, status, submitted_at desc);
create index resident_security_reports_resident_idx on public.resident_security_reports(resident_membership_id, submitted_at desc);
alter table public.resident_security_reports enable row level security;
alter table public.resident_security_reports force row level security;
revoke all on public.resident_security_reports from public, anon, authenticated;

create function public.submit_resident_security_report(p_category text, p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor record; report_id uuid;
begin
  select id, organization_id into actor from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'host' and status = 'active';
  if not found then raise exception 'security report submission is not permitted' using errcode = '42501'; end if;
  p_category := btrim(p_category); p_details := btrim(p_details);
  if char_length(p_category) not between 2 and 80 or char_length(p_details) not between 10 and 2000 then raise exception 'security report details are invalid'; end if;
  insert into public.resident_security_reports(organization_id, resident_membership_id, category, details)
  values(actor.organization_id, actor.id, p_category, p_details) returning id into report_id;
  perform private.write_audit_event(actor.organization_id, 'security_report.submitted', 'resident_security_reports', report_id, 'authenticated_user', actor.id, jsonb_build_object('category', p_category));
  return report_id;
end;
$$;

create function public.list_my_security_reports()
returns table (report_id uuid, category text, details text, status text, submitted_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select report.id, report.category, report.details, report.status, report.submitted_at, report.updated_at
  from public.resident_security_reports report
  join public.organization_memberships actor on actor.id = report.resident_membership_id
  where actor.user_id = (select auth.uid()) and actor.role = 'host' and actor.status = 'active'
  order by report.submitted_at desc;
$$;

create function public.list_organization_security_reports(p_status text default null)
returns table (report_id uuid, resident_name text, category text, details text, status text, submitted_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with actor as (
    select organization_id from public.organization_memberships
    where user_id = (select auth.uid()) and role = 'admin' and status = 'active'
  )
  select report.id, coalesce(profile.full_name, 'Resident'), report.category, report.details,
    report.status, report.submitted_at, report.updated_at
  from public.resident_security_reports report join actor using(organization_id)
  join public.organization_memberships resident on resident.id = report.resident_membership_id
  left join public.user_profiles profile on profile.user_id = resident.user_id
  where p_status is null or report.status = p_status
  order by report.submitted_at desc;
$$;

create function public.update_security_report_status(p_report_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor record; previous_status text;
begin
  if p_status not in ('submitted', 'under_review', 'resolved') then raise exception 'security report status is invalid'; end if;
  select id, organization_id into actor from public.organization_memberships
  where user_id = (select auth.uid()) and role = 'admin' and status = 'active';
  if not found then raise exception 'security report management is not permitted' using errcode = '42501'; end if;
  select status into previous_status from public.resident_security_reports where id = p_report_id and organization_id = actor.organization_id for update;
  if not found then raise exception 'security report is unavailable'; end if;
  update public.resident_security_reports set status = p_status, updated_at = clock_timestamp(),
    resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, clock_timestamp()) else null end,
    updated_by_membership_id = actor.id where id = p_report_id;
  perform private.write_audit_event(actor.organization_id, 'security_report.status_updated', 'resident_security_reports', p_report_id, 'authenticated_user', actor.id, jsonb_build_object('previous_status', previous_status, 'status', p_status));
  return true;
end;
$$;

revoke all on function public.submit_resident_security_report(text, text) from public, anon, service_role;
grant execute on function public.submit_resident_security_report(text, text) to authenticated;
revoke all on function public.list_my_security_reports() from public, anon, service_role;
grant execute on function public.list_my_security_reports() to authenticated;
revoke all on function public.list_organization_security_reports(text) from public, anon, service_role;
grant execute on function public.list_organization_security_reports(text) to authenticated;
revoke all on function public.update_security_report_status(uuid, text) from public, anon, service_role;
grant execute on function public.update_security_report_status(uuid, text) to authenticated;
