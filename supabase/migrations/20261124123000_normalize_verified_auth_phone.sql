-- Supabase test phone entries can be stored without a leading plus. Preserve
-- Auth as the trust source while saving the verified profile phone as E.164.

create or replace function public.sync_my_verified_phone()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  trusted_phone text;
  canonical_phone text;
  verified_at timestamptz;
begin
  if actor_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  select phone, phone_confirmed_at
  into trusted_phone, verified_at
  from auth.users
  where id = actor_user_id;

  canonical_phone := case
    when trusted_phone ~ '^[+][1-9][0-9]{7,14}$' then trusted_phone
    when trusted_phone ~ '^[1-9][0-9]{7,14}$' then '+' || trusted_phone
    else null
  end;

  if verified_at is null or canonical_phone is null then
    raise exception 'a Supabase Auth verified phone is required'
      using errcode = '42501';
  end if;

  update public.user_profiles
  set phone = canonical_phone,
      verified_phone_e164 = canonical_phone,
      phone_verified_at = verified_at
  where user_id = actor_user_id;

  if not found then
    raise exception 'profile is unavailable';
  end if;

  return canonical_phone;
end;
$$;

create or replace function private.require_verified_phone_for_new_operational_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in ('host', 'security')
    and new.status = 'active'
    and not exists (
      select 1
      from auth.users
      where id = new.user_id
        and phone_confirmed_at is not null
        and (
          phone ~ '^[+][1-9][0-9]{7,14}$'
          or phone ~ '^[1-9][0-9]{7,14}$'
        )
    ) then
    raise exception 'a verified phone is required before resident or security approval'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
