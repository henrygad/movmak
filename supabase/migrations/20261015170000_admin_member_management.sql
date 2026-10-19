begin;

revoke update on table public.organization_memberships from authenticated;
revoke update (role, status) on table public.organization_memberships from authenticated;
drop policy memberships_update_admin on public.organization_memberships;

create function public.manage_organization_membership(
  p_organization_id uuid,
  p_membership_id uuid,
  p_role public.organization_role,
  p_status public.membership_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor record;
  target record;
begin
  select id, user_id into actor
  from public.organization_memberships
  where organization_id = p_organization_id
    and user_id = (select auth.uid())
    and role = 'admin' and status = 'active'
  for update;
  if not found then raise exception 'membership management is not permitted'; end if;

  select id, user_id, role, status into target
  from public.organization_memberships
  where id = p_membership_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'membership is not available'; end if;
  if target.user_id = actor.user_id then
    raise exception 'administrators cannot change their own membership';
  end if;

  if target.role = 'admin' and target.status = 'active'
    and (p_role <> 'admin' or p_status <> 'active')
    and not exists (
      select 1 from public.organization_memberships as other
      where other.organization_id = p_organization_id
        and other.id <> target.id
        and other.role = 'admin' and other.status = 'active'
    ) then
    raise exception 'the organization must retain an active administrator';
  end if;

  update public.organization_memberships
  set role = p_role,
      status = p_status,
      revoked_at = case when p_status = 'revoked' then coalesce(revoked_at, clock_timestamp()) else null end
  where id = target.id;
  return true;
end;
$$;

create function public.list_organization_invitations(p_organization_id uuid)
returns table (
  invitation_id uuid,
  invited_email text,
  invited_role public.organization_role,
  invitation_status text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select invitation.id, invitation.invited_email, invitation.role,
    case
      when invitation.consumed_at is not null then 'accepted'
      when invitation.revoked_at is not null then 'revoked'
      when invitation.expires_at <= statement_timestamp() then 'expired'
      else 'pending'
    end,
    invitation.expires_at, invitation.created_at
  from private.organization_membership_invitations as invitation
  where invitation.organization_id = p_organization_id
    and private.has_permission(p_organization_id, 'membership_manage')
  order by invitation.created_at desc
  limit 100;
$$;

create function public.get_admin_visit_metrics()
returns table (visit_status public.visit_status, visit_count bigint, people_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select visit.status, count(*)::bigint, coalesce(sum(visit.group_size), 0)::bigint
  from public.organization_memberships as actor
  join public.visits as visit on visit.organization_id = actor.organization_id
  where actor.user_id = (select auth.uid())
    and actor.role = 'admin' and actor.status = 'active'
  group by visit.status;
$$;

revoke all on function public.manage_organization_membership(uuid, uuid, public.organization_role, public.membership_status) from public, anon, service_role;
revoke all on function public.list_organization_invitations(uuid) from public, anon, service_role;
revoke all on function public.get_admin_visit_metrics() from public, anon, service_role;
grant execute on function public.manage_organization_membership(uuid, uuid, public.organization_role, public.membership_status) to authenticated;
grant execute on function public.list_organization_invitations(uuid) to authenticated;
grant execute on function public.get_admin_visit_metrics() to authenticated;

commit;
