create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function expected_parent_role(child_role_type text)
returns text
language sql
immutable
as $$
  select case child_role_type
    when 'member' then 'leader'
    when 'leader' then 'squad'
    when 'squad' then 'platoon'
    when 'platoon' then 'o1'
    else null
  end;
$$;

create or replace function current_unit_type_for_role(role_type text)
returns text
language sql
immutable
as $$
  select case role_type
    when 'member' then 'team'
    when 'leader' then 'team'
    when 'squad' then 'squad'
    when 'platoon' then 'platoon'
    when 'o1' then 'o1'
    else null
  end;
$$;

create or replace function parent_unit_type_for_role(child_role_type text)
returns text
language sql
immutable
as $$
  select case child_role_type
    when 'member' then 'team'
    when 'leader' then 'squad'
    when 'squad' then 'platoon'
    when 'platoon' then 'o1'
    else null
  end;
$$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_name_ci_idx
  on organizations (lower(name));

drop trigger if exists organizations_set_updated_at on organizations;
create trigger organizations_set_updated_at
before update on organizations
for each row
execute function set_updated_at();

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_team_id uuid references teams(id) on delete set null,
  unit_type text not null check (unit_type in ('team', 'squad', 'platoon', 'o1')),
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_no_self_parent check (parent_team_id is null or parent_team_id <> id)
);

create unique index if not exists teams_org_parent_name_ci_idx
  on teams (organization_id, coalesce(parent_team_id, '00000000-0000-0000-0000-000000000000'::uuid), unit_type, lower(name));

create unique index if not exists teams_code_idx
  on teams (code)
  where code is not null;

create index if not exists teams_parent_team_id_idx on teams(parent_team_id);
create index if not exists teams_organization_id_idx on teams(organization_id);

drop trigger if exists teams_set_updated_at on teams;
create trigger teams_set_updated_at
before update on teams
for each row
execute function set_updated_at();

create table if not exists user_team_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create index if not exists user_team_memberships_user_id_idx on user_team_memberships(user_id);
create index if not exists user_team_memberships_team_id_idx on user_team_memberships(team_id);
create index if not exists user_team_memberships_org_id_idx on user_team_memberships(organization_id);

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role_type text not null check (role_type in ('member', 'leader', 'squad', 'platoon', 'o1')),
  is_admin boolean not null default false,
  is_active boolean not null default true,
  approval_status text not null default 'approved' check (approval_status in ('pending', 'approved', 'rejected')),
  notes text not null default '',
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles add column if not exists is_admin boolean not null default false;
alter table user_profiles add column if not exists is_active boolean not null default true;
alter table user_profiles add column if not exists approval_status text not null default 'approved';
alter table user_profiles add column if not exists approved_at timestamptz;
alter table user_profiles add column if not exists approved_by uuid references auth.users(id) on delete set null;

alter table user_profiles drop constraint if exists user_profiles_approval_status_check;
alter table user_profiles
  add constraint user_profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

create unique index if not exists user_profiles_email_ci_idx
  on user_profiles (lower(email));

create index if not exists user_profiles_role_type_idx
  on user_profiles (role_type);

create index if not exists user_profiles_approval_status_idx
  on user_profiles (approval_status);

create index if not exists user_profiles_is_admin_idx
  on user_profiles (is_admin)
  where is_admin = true;

drop trigger if exists user_profiles_set_updated_at on user_profiles;
create trigger user_profiles_set_updated_at
before update on user_profiles
for each row
execute function set_updated_at();

create table if not exists hierarchy_link_directory (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role_type text not null check (role_type in ('leader', 'squad', 'platoon', 'o1')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hierarchy_link_directory_email_role_idx
  on hierarchy_link_directory (lower(email), role_type);

drop trigger if exists hierarchy_link_directory_set_updated_at on hierarchy_link_directory;
create trigger hierarchy_link_directory_set_updated_at
before update on hierarchy_link_directory
for each row
execute function set_updated_at();

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  parent_plan_id uuid references plans(id) on delete set null,
  owner_role text,
  role_type text not null check (role_type in ('member', 'leader', 'squad', 'platoon', 'o1')),
  full_name text not null,
  start_date date,
  calendar_start_date date,
  target_pi integer not null default 0,
  target_sales numeric(12,2) not null default 0,
  info jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'approved', 'needs_revision')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_no_self_parent check (parent_plan_id is null or parent_plan_id <> id)
);

alter table plans add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table plans add column if not exists parent_plan_id uuid references plans(id) on delete set null;
alter table plans add column if not exists owner_role text;
alter table plans add column if not exists review_notes text;
alter table plans add column if not exists reviewed_at timestamptz;
alter table plans add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plans_no_self_parent'
      and conrelid = 'plans'::regclass
  ) then
    alter table plans
      add constraint plans_no_self_parent
      check (parent_plan_id is null or parent_plan_id <> id);
  end if;
end;
$$;

alter table plans drop constraint if exists plans_status_check;
alter table plans
  add constraint plans_status_check
  check (status in ('draft', 'submitted', 'approved', 'needs_revision'));

create table if not exists plan_week_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 12),
  activity_name text not null,
  activity_date date,
  leads integer not null default 0,
  attendees integer not null default 0,
  pay_ins integer not null default 0,
  sales numeric(12,2) not null default 0,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists plan_consolidation_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  name text not null,
  role_label text not null default '',
  leads integer not null default 0,
  att integer not null default 0,
  pi integer not null default 0,
  sales numeric(12,2) not null default 0,
  evt integer not null default 0,
  pi_target integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists plans_role_type_idx on plans(role_type);
create index if not exists plans_user_id_idx on plans(user_id);
create index if not exists plans_parent_plan_id_idx on plans(parent_plan_id);
create index if not exists plan_week_entries_plan_week_idx on plan_week_entries(plan_id, week_number);
create index if not exists plan_consolidation_entries_plan_idx on plan_consolidation_entries(plan_id);

create table if not exists plan_audit_log (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid,
  plan_owner_user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'deleted')),
  plan_role_type text,
  plan_full_name text,
  status_before text,
  status_after text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists plan_audit_log_plan_id_idx on plan_audit_log(plan_id);
create index if not exists plan_audit_log_actor_user_id_idx on plan_audit_log(actor_user_id);
create index if not exists plan_audit_log_created_at_idx on plan_audit_log(created_at desc);

create table if not exists user_profile_audit_log (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete cascade,
  target_email text,
  target_display_name text,
  target_role_type text,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('account_created', 'profile_updated', 'approval_changed', 'role_changed', 'activation_changed', 'admin_changed')),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists user_profile_audit_log_target_user_id_idx
  on user_profile_audit_log(target_user_id);
create index if not exists user_profile_audit_log_actor_user_id_idx
  on user_profile_audit_log(actor_user_id);
create index if not exists user_profile_audit_log_created_at_idx
  on user_profile_audit_log(created_at desc);

create or replace function is_current_user_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from auth.users
      where id = auth.uid()
        and email_confirmed_at is not null
    );
$$;

create or replace function is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_current_user_verified()
    and exists (
      select 1
      from public.user_profiles
      where user_id = auth.uid()
        and is_admin = true
        and is_active = true
        and approval_status = 'approved'
    );
$$;

create or replace function current_user_has_full_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.is_current_user_verified()
    and exists (
      select 1
      from public.user_profiles
      where user_id = auth.uid()
        and is_active = true
        and approval_status = 'approved'
    );
$$;

create or replace function log_user_profile_audit_event(
  target_user_id uuid,
  target_email text,
  target_display_name text,
  target_role_type text,
  action_name text,
  detail_text text default null,
  actor_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if action_name not in ('account_created', 'profile_updated', 'approval_changed', 'role_changed', 'activation_changed', 'admin_changed') then
    return;
  end if;

  insert into public.user_profile_audit_log (
    target_user_id,
    target_email,
    target_display_name,
    target_role_type,
    actor_user_id,
    action,
    detail
  )
  values (
    target_user_id,
    target_email,
    target_display_name,
    target_role_type,
    actor_id,
    action_name,
    detail_text
  );
end;
$$;

create or replace function create_default_plan_for_user(
  target_user_id uuid,
  target_role_type text,
  target_display_name text,
  target_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_plan_id uuid;
  safe_name text;
begin
  if target_user_id is null or target_role_type not in ('member', 'leader', 'squad', 'platoon', 'o1') then
    return null;
  end if;

  select p.id
  into existing_plan_id
  from public.plans p
  where p.user_id = target_user_id
    and p.role_type = target_role_type
  order by p.updated_at desc, p.created_at desc
  limit 1;

  if existing_plan_id is not null then
    return existing_plan_id;
  end if;

  safe_name := coalesce(
    nullif(trim(target_display_name), ''),
    nullif(split_part(coalesce(target_email, ''), '@', 1), ''),
    '(Draft)'
  );

  insert into public.plans (
    user_id,
    parent_plan_id,
    owner_role,
    role_type,
    full_name,
    start_date,
    calendar_start_date,
    target_pi,
    target_sales,
    info,
    checklist,
    status
  )
  values (
    target_user_id,
    null,
    target_role_type,
    target_role_type,
    safe_name,
    null,
    null,
    0,
    0,
    jsonb_build_object('full_name', safe_name),
    '[]'::jsonb,
    'draft'
  )
  returning id into existing_plan_id;

  return existing_plan_id;
end;
$$;

create or replace function handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_display_name text;
  next_role_type text;
begin
  next_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'displayName'), ''),
    nullif(trim(new.raw_user_meta_data->'data'->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->'data'->>'displayName'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New User'
  );
  next_role_type := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role_type'), ''),
    nullif(trim(new.raw_user_meta_data->>'roleType'), ''),
    nullif(trim(new.raw_user_meta_data->'data'->>'role_type'), ''),
    nullif(trim(new.raw_user_meta_data->'data'->>'roleType'), ''),
    'member'
  );

  if next_role_type not in ('member', 'leader', 'squad', 'platoon', 'o1') then
    next_role_type := 'member';
  end if;

  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    role_type,
    is_admin,
    is_active,
    approval_status,
    notes,
    approved_at,
    approved_by
  )
  values (new.id, coalesce(new.email, ''), next_display_name, next_role_type, false, true, 'pending', '', null, null)
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    role_type = excluded.role_type,
    is_admin = coalesce(public.user_profiles.is_admin, false),
    is_active = true,
    approval_status = coalesce(public.user_profiles.approval_status, 'pending'),
    updated_at = now();

  perform public.create_default_plan_for_user(new.id, next_role_type, next_display_name, new.email);
  perform public.log_user_profile_audit_event(
    new.id,
    coalesce(new.email, ''),
    next_display_name,
    next_role_type,
    'account_created',
    'Signup record created. Waiting for verification and admin approval.',
    new.id
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();

insert into public.user_profiles (user_id, email, display_name, role_type, is_admin, is_active, approval_status, notes, approved_at, approved_by)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Existing User'
  ),
  case
    when coalesce(nullif(trim(u.raw_user_meta_data->>'role_type'), ''), 'member') in ('member', 'leader', 'squad', 'platoon', 'o1')
      then coalesce(nullif(trim(u.raw_user_meta_data->>'role_type'), ''), 'member')
    else 'member'
  end,
  false,
  true,
  'approved',
  '',
  now(),
  null
from auth.users u
on conflict (user_id) do nothing;

select public.create_default_plan_for_user(user_id, role_type, display_name, email)
from public.user_profiles;

create or replace function can_edit_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_full_access()
    and exists (
      select 1
      from public.plans
      where id = target_plan_id
        and user_id = auth.uid()
    );
$$;

create or replace function can_read_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select
      p.id,
      p.parent_plan_id,
      p.user_id,
      array[p.id]::uuid[] as path
    from public.plans p
    where p.id = target_plan_id

    union all

    select
      parent.id,
      parent.parent_plan_id,
      parent.user_id,
      chain.path || parent.id
    from public.plans parent
    join chain on parent.id = chain.parent_plan_id
    where not parent.id = any(chain.path)
  )
  select public.current_user_has_full_access()
    and exists (
      select 1
      from chain
      where user_id = auth.uid()
    );
$$;

create or replace function current_user_can_link_to_parent(parent_user_id uuid, child_role_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_has_full_access()
    and parent_user_id is not null
    and expected_parent_role(child_role_type) is not null;
$$;

create or replace function is_valid_parent_plan(
  candidate_parent_plan_id uuid,
  child_role_type text,
  current_plan_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  required_parent_role text;
  candidate_parent_user_id uuid;
begin
  required_parent_role := expected_parent_role(child_role_type);

  if candidate_parent_plan_id is null then
    return true;
  end if;

  if required_parent_role is null then
    return false;
  end if;

  if current_plan_id is not null and candidate_parent_plan_id = current_plan_id then
    return false;
  end if;

  select p.user_id
  into candidate_parent_user_id
  from public.plans p
  where p.id = candidate_parent_plan_id
    and p.role_type = required_parent_role;

  if candidate_parent_user_id is null then
    return false;
  end if;

  if not current_user_can_link_to_parent(candidate_parent_user_id, child_role_type) then
    return false;
  end if;

  if current_plan_id is null then
    return true;
  end if;

  return not exists (
    with recursive descendants as (
      select
        p.id,
        array[p.id]::uuid[] as path
      from public.plans p
      where p.parent_plan_id = current_plan_id

      union all

      select
        child.id,
        descendants.path || child.id
      from public.plans child
      join descendants on child.parent_plan_id = descendants.id
      where not child.id = any(descendants.path)
    )
    select 1
    from descendants
    where id = candidate_parent_plan_id
  );
end;
$$;

drop function if exists list_potential_parent_plans(text);
create or replace function list_potential_parent_plans(child_role_type text)
returns table (
  id uuid,
  role_type text,
  full_name text,
  status text,
  updated_at timestamptz,
  created_at timestamptz,
  parent_plan_id uuid,
  owner_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    p.id,
    p.role_type,
    coalesce(
      nullif(trim(profile.display_name), ''),
      directory.display_name,
      p.full_name,
      auth_user.email,
      '(No Name)'
    ) as full_name,
    p.status,
    p.updated_at,
    p.created_at,
    p.parent_plan_id,
    p.owner_role
  from public.plans p
  left join auth.users auth_user
    on auth_user.id = p.user_id
  left join public.user_profiles profile
    on profile.user_id = p.user_id
  left join public.hierarchy_link_directory directory
    on lower(directory.email) = lower(auth_user.email)
   and directory.role_type = p.role_type
   and directory.active = true
  where auth.uid() is not null
    and p.role_type = expected_parent_role(child_role_type)
    and current_user_can_link_to_parent(p.user_id, child_role_type)
    and coalesce(profile.is_active, true) = true
    and coalesce(profile.approval_status, 'approved') = 'approved'
    and auth_user.email_confirmed_at is not null
  order by p.updated_at desc;
$$;

create or replace function sync_my_profile(profile_payload jsonb default '{}'::jsonb)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  next_profile public.user_profiles%rowtype;
  previous_profile public.user_profiles%rowtype;
  next_email text;
  next_display_name text;
  next_role_type text;
  existing_role_type text;
begin
  if auth.uid() is null then
    raise exception 'Please sign in before updating your profile.';
  end if;

  select *
  into previous_profile
  from public.user_profiles
  where user_id = auth.uid();

  select email
  into next_email
  from auth.users
  where id = auth.uid();

  next_display_name := coalesce(
    nullif(trim(profile_payload->>'display_name'), ''),
    nullif(trim(profile_payload->>'displayName'), ''),
    (select display_name from public.user_profiles where user_id = auth.uid()),
    nullif(split_part(coalesce(next_email, ''), '@', 1), ''),
    'User'
  );

  select role_type
  into existing_role_type
  from public.user_profiles
  where user_id = auth.uid();

  next_role_type := coalesce(
    nullif(trim(profile_payload->>'role_type'), ''),
    nullif(trim(profile_payload->>'roleType'), ''),
    existing_role_type,
    'member'
  );

  if next_role_type not in ('member', 'leader', 'squad', 'platoon', 'o1') then
    next_role_type := 'member';
  end if;

  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    role_type,
    is_admin,
    is_active,
    approval_status,
    notes,
    approved_at,
    approved_by
  )
  values (
    auth.uid(),
    coalesce(next_email, ''),
    next_display_name,
    next_role_type,
    false,
    true,
    coalesce((select approval_status from public.user_profiles where user_id = auth.uid()), 'pending'),
    coalesce(nullif(profile_payload->>'notes', ''), ''),
    (select approved_at from public.user_profiles where user_id = auth.uid()),
    (select approved_by from public.user_profiles where user_id = auth.uid())
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    role_type = excluded.role_type,
    is_admin = public.user_profiles.is_admin,
    is_active = public.user_profiles.is_active,
    approval_status = public.user_profiles.approval_status,
    notes = coalesce(profile_payload->>'notes', public.user_profiles.notes),
    updated_at = now()
  returning * into next_profile;

  update public.plans
  set
    full_name = next_profile.display_name,
    info = coalesce(info, '{}'::jsonb) || jsonb_build_object('full_name', next_profile.display_name),
    updated_at = now()
  where user_id = next_profile.user_id
    and role_type = next_profile.role_type
    and status = 'draft';

  perform public.create_default_plan_for_user(next_profile.user_id, next_profile.role_type, next_profile.display_name, next_profile.email);
  if previous_profile.user_id is null then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'account_created',
      'Profile synced from the planner.',
      auth.uid()
    );
  elsif coalesce(previous_profile.display_name, '') <> coalesce(next_profile.display_name, '')
     or coalesce(previous_profile.notes, '') <> coalesce(next_profile.notes, '') then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'profile_updated',
      'Display name or notes were updated from the planner.',
      auth.uid()
    );
  end if;
  return next_profile;
end;
$$;

drop function if exists list_user_profiles();
create or replace function list_user_profiles()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role_type text,
  is_admin boolean,
  is_active boolean,
  approval_status text,
  notes text,
  approved_at timestamptz,
  approved_by uuid,
  approved_by_email text,
  approved_by_display_name text,
  created_at timestamptz,
  updated_at timestamptz,
  latest_plan_id uuid,
  latest_plan_status text,
  latest_plan_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.user_id,
    profile.email,
    profile.display_name,
    profile.role_type,
    profile.is_admin,
    profile.is_active,
    profile.approval_status,
    profile.notes,
    profile.approved_at,
    profile.approved_by,
    approver_user.email as approved_by_email,
    approver_profile.display_name as approved_by_display_name,
    profile.created_at,
    profile.updated_at,
    latest_plan.id as latest_plan_id,
    latest_plan.status as latest_plan_status,
    latest_plan.updated_at as latest_plan_updated_at
  from public.user_profiles profile
  left join auth.users approver_user
    on approver_user.id = profile.approved_by
  left join public.user_profiles approver_profile
    on approver_profile.user_id = profile.approved_by
  left join lateral (
    select p.id, p.status, p.updated_at
    from public.plans p
    where p.user_id = profile.user_id
      and p.role_type = profile.role_type
    order by p.updated_at desc, p.created_at desc
    limit 1
  ) latest_plan on true
  where auth.uid() is not null
    and public.is_admin_user()
  order by profile.role_type, lower(profile.display_name), lower(profile.email);
$$;

drop function if exists list_directory_profiles();
create or replace function list_directory_profiles()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role_type text,
  latest_plan_id uuid,
  latest_plan_status text,
  latest_plan_updated_at timestamptz,
  can_link_as_parent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profile.user_id,
    profile.email,
    profile.display_name,
    profile.role_type,
    latest_plan.id as latest_plan_id,
    latest_plan.status as latest_plan_status,
    latest_plan.updated_at as latest_plan_updated_at,
    latest_plan.id is not null as can_link_as_parent
  from public.user_profiles profile
  left join auth.users auth_user
    on auth_user.id = profile.user_id
  left join lateral (
    select p.id, p.status, p.updated_at
    from public.plans p
    where p.user_id = profile.user_id
      and p.role_type = profile.role_type
    order by p.updated_at desc, p.created_at desc
    limit 1
  ) latest_plan on true
  where auth.uid() is not null
    and public.current_user_has_full_access()
    and profile.is_active = true
    and profile.approval_status = 'approved'
    and auth_user.email_confirmed_at is not null
  order by profile.role_type, lower(profile.display_name), lower(profile.email);
$$;

create or replace function admin_update_user_profile(
  target_user_id uuid,
  profile_payload jsonb default '{}'::jsonb
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  next_profile public.user_profiles%rowtype;
  previous_profile public.user_profiles%rowtype;
  next_email text;
  next_display_name text;
  next_role_type text;
  next_is_admin boolean;
  next_is_active boolean;
  next_approval_status text;
  change_reason text;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin access is required.';
  end if;

  select *
  into previous_profile
  from public.user_profiles
  where user_id = target_user_id;

  select email
  into next_email
  from auth.users
  where id = target_user_id;

  if next_email is null then
    raise exception 'Target user was not found.';
  end if;

  next_display_name := coalesce(
    nullif(trim(profile_payload->>'display_name'), ''),
    (select display_name from public.user_profiles where user_id = target_user_id),
    nullif(split_part(next_email, '@', 1), ''),
    'User'
  );
  next_role_type := coalesce(
    nullif(trim(profile_payload->>'role_type'), ''),
    (select role_type from public.user_profiles where user_id = target_user_id),
    'member'
  );
  next_is_admin := coalesce((profile_payload->>'is_admin')::boolean, (select is_admin from public.user_profiles where user_id = target_user_id), false);
  next_is_active := coalesce((profile_payload->>'is_active')::boolean, true);
  next_approval_status := coalesce(
    nullif(trim(profile_payload->>'approval_status'), ''),
    (select approval_status from public.user_profiles where user_id = target_user_id),
    'pending'
  );
  change_reason := nullif(trim(profile_payload->>'change_reason'), '');

  if next_role_type not in ('member', 'leader', 'squad', 'platoon', 'o1') then
    raise exception 'Unsupported role type.';
  end if;

  if next_approval_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Unsupported approval status.';
  end if;

  insert into public.user_profiles (user_id, email, display_name, role_type, is_admin, is_active, approval_status, notes, approved_at, approved_by)
  values (
    target_user_id,
    next_email,
    next_display_name,
    next_role_type,
    next_is_admin,
    next_is_active,
    next_approval_status,
    coalesce(profile_payload->>'notes', ''),
    case when next_approval_status = 'approved' then now() else null end,
    case when next_approval_status = 'approved' then auth.uid() else null end
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    role_type = excluded.role_type,
    is_admin = excluded.is_admin,
    is_active = excluded.is_active,
    approval_status = excluded.approval_status,
    notes = coalesce(profile_payload->>'notes', public.user_profiles.notes),
    approved_at = case
      when excluded.approval_status = 'approved' and public.user_profiles.approval_status <> 'approved' then now()
      when excluded.approval_status = 'approved' and public.user_profiles.approval_status = 'approved' then coalesce(public.user_profiles.approved_at, now())
      else null
    end,
    approved_by = case
      when excluded.approval_status = 'approved' then auth.uid()
      else null
    end,
    updated_at = now()
  returning * into next_profile;

  update public.plans
  set
    full_name = next_profile.display_name,
    updated_at = now()
  where user_id = next_profile.user_id
    and role_type = next_profile.role_type
    and status = 'draft';

  perform public.create_default_plan_for_user(next_profile.user_id, next_profile.role_type, next_profile.display_name, next_profile.email);
  if previous_profile.user_id is null then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'account_created',
      'Account was created or backfilled by an admin update.',
      auth.uid()
    );
  end if;

  if previous_profile.user_id is not null and coalesce(previous_profile.display_name, '') <> coalesce(next_profile.display_name, '') then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'profile_updated',
      'Display name was changed by an admin.' || case when change_reason is not null then ' Reason: ' || change_reason else '' end,
      auth.uid()
    );
  end if;

  if previous_profile.user_id is not null and coalesce(previous_profile.role_type, '') <> coalesce(next_profile.role_type, '') then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'role_changed',
      'Role changed from ' || coalesce(previous_profile.role_type, '(none)') || ' to ' || coalesce(next_profile.role_type, '(none)') || '.' || case when change_reason is not null then ' Reason: ' || change_reason else '' end,
      auth.uid()
    );
  end if;

  if previous_profile.user_id is not null and coalesce(previous_profile.approval_status, '') <> coalesce(next_profile.approval_status, '') then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'approval_changed',
      'Approval changed from ' || coalesce(previous_profile.approval_status, '(none)') || ' to ' || coalesce(next_profile.approval_status, '(none)') || '.' || case when change_reason is not null then ' Reason: ' || change_reason else '' end,
      auth.uid()
    );
  end if;

  if previous_profile.user_id is not null and coalesce(previous_profile.is_active, false) <> coalesce(next_profile.is_active, false) then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'activation_changed',
      (case when next_profile.is_active then 'Account was reactivated.' else 'Account was deactivated.' end) || case when change_reason is not null then ' Reason: ' || change_reason else '' end,
      auth.uid()
    );
  end if;

  if previous_profile.user_id is not null and coalesce(previous_profile.is_admin, false) <> coalesce(next_profile.is_admin, false) then
    perform public.log_user_profile_audit_event(
      next_profile.user_id,
      next_profile.email,
      next_profile.display_name,
      next_profile.role_type,
      'admin_changed',
      (case when next_profile.is_admin then 'Admin access granted.' else 'Admin access removed.' end) || case when change_reason is not null then ' Reason: ' || change_reason else '' end,
      auth.uid()
    );
  end if;
  return next_profile;
end;
$$;

create or replace function get_planner_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_accounts', (select count(*) from public.user_profiles),
    'active_accounts', (select count(*) from public.user_profiles where is_active = true),
    'approved_accounts', (select count(*) from public.user_profiles where approval_status = 'approved'),
    'pending_accounts', (select count(*) from public.user_profiles where approval_status = 'pending'),
    'admin_accounts', (select count(*) from public.user_profiles where is_admin = true),
    'total_plans', (select count(*) from public.plans),
    'submitted_plans', (select count(*) from public.plans where status = 'submitted'),
    'draft_plans', (select count(*) from public.plans where status = 'draft'),
    'missing_parent_links', (
      select count(*)
      from public.plans
      where role_type <> 'o1'
        and parent_plan_id is null
    ),
    'pending_reviews', (
      select count(*)
      from public.plans
      where status in ('submitted', 'needs_revision')
        and user_id <> auth.uid()
        and public.can_read_plan(id)
    ),
    'recent_activity_at', (
      select greatest(
        coalesce((select max(updated_at) from public.plans), to_timestamp(0)),
        coalesce((select max(created_at) from public.plan_audit_log), to_timestamp(0)),
        coalesce((select max(updated_at) from public.user_profiles), to_timestamp(0))
      )
    )
  )
  where auth.uid() is not null
    and public.is_admin_user();
$$;

drop function if exists list_plan_activity(integer);
create or replace function list_plan_activity(limit_count integer default 12)
returns table (
  id uuid,
  created_at timestamptz,
  action text,
  plan_id uuid,
  plan_role_type text,
  plan_full_name text,
  status_before text,
  status_after text,
  actor_name text,
  actor_email text,
  detail text
)
language sql
stable
security definer
set search_path = public
as $$
  with combined_activity as (
    select
      audit.id,
      audit.created_at,
      audit.action,
      audit.plan_id,
      audit.plan_role_type,
      audit.plan_full_name,
      audit.status_before,
      audit.status_after,
      coalesce(actor_profile.display_name, actor_user.email, 'System') as actor_name,
      actor_user.email as actor_email,
      audit.detail
    from public.plan_audit_log audit
    left join auth.users actor_user
      on actor_user.id = audit.actor_user_id
    left join public.user_profiles actor_profile
      on actor_profile.user_id = audit.actor_user_id
    where auth.uid() is not null
      and (
        public.is_admin_user()
        or audit.plan_owner_user_id = auth.uid()
        or public.can_read_plan(audit.plan_id)
      )

    union all

    select
      profile_audit.id,
      profile_audit.created_at,
      profile_audit.action,
      null::uuid as plan_id,
      profile_audit.target_role_type as plan_role_type,
      coalesce(profile_audit.target_display_name, profile_audit.target_email, 'User Profile') as plan_full_name,
      null::text as status_before,
      null::text as status_after,
      coalesce(actor_profile.display_name, actor_user.email, 'System') as actor_name,
      actor_user.email as actor_email,
      profile_audit.detail
    from public.user_profile_audit_log profile_audit
    left join auth.users actor_user
      on actor_user.id = profile_audit.actor_user_id
    left join public.user_profiles actor_profile
      on actor_profile.user_id = profile_audit.actor_user_id
    where auth.uid() is not null
      and (
        public.is_admin_user()
        or profile_audit.target_user_id = auth.uid()
      )
  )
  select *
  from combined_activity
  order by created_at desc
  limit greatest(1, least(coalesce(limit_count, 12), 50));
$$;

create or replace function log_plan_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.plan_audit_log (
      plan_id,
      plan_owner_user_id,
      actor_user_id,
      action,
      plan_role_type,
      plan_full_name,
      status_before,
      status_after,
      detail
    )
    values (
      new.id,
      new.user_id,
      auth.uid(),
      'created',
      new.role_type,
      new.full_name,
      null,
      new.status,
      'Plan created'
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    insert into public.plan_audit_log (
      plan_id,
      plan_owner_user_id,
      actor_user_id,
      action,
      plan_role_type,
      plan_full_name,
      status_before,
      status_after,
      detail
    )
    values (
      new.id,
      new.user_id,
      auth.uid(),
      case
        when coalesce(old.status, '') <> coalesce(new.status, '') then 'status_changed'
        else 'updated'
      end,
      new.role_type,
      new.full_name,
      old.status,
      new.status,
      case
        when coalesce(old.status, '') <> coalesce(new.status, '') then 'Status changed'
        else 'Plan updated'
      end
    );
    return new;
  end if;

  insert into public.plan_audit_log (
    plan_id,
    plan_owner_user_id,
    actor_user_id,
    action,
    plan_role_type,
    plan_full_name,
    status_before,
    status_after,
    detail
  )
  values (
    old.id,
    old.user_id,
    auth.uid(),
    'deleted',
    old.role_type,
    old.full_name,
    old.status,
    null,
    'Plan deleted'
  );
  return old;
end;
$$;

create or replace function save_plan_bundle(plan_payload jsonb)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_plan public.plans%rowtype;
  target_plan_id uuid;
begin
  if not public.current_user_has_full_access() then
    raise exception 'Please sign in before saving plans.';
  end if;

  target_plan_id := nullif(plan_payload->>'id', '')::uuid;

  if target_plan_id is null then
    select p.id
    into target_plan_id
    from public.plans p
    where p.user_id = auth.uid()
      and p.role_type = plan_payload->>'role_type'
      and p.status = 'draft'
      and coalesce(p.target_pi, 0) = 0
      and coalesce(p.target_sales, 0) = 0
      and not exists (
        select 1
        from public.plan_week_entries week_row
        where week_row.plan_id = p.id
      )
      and not exists (
        select 1
        from public.plan_consolidation_entries con_row
        where con_row.plan_id = p.id
      )
    order by p.updated_at desc, p.created_at desc
    limit 1;
  end if;

  if target_plan_id is null then
    insert into public.plans (
      user_id,
      parent_plan_id,
      owner_role,
      role_type,
      full_name,
      start_date,
      calendar_start_date,
      target_pi,
      target_sales,
      info,
      checklist,
      status
    )
    values (
      auth.uid(),
      nullif(plan_payload->>'parent_plan_id', '')::uuid,
      coalesce(nullif(plan_payload->>'owner_role', ''), plan_payload->>'role_type'),
      plan_payload->>'role_type',
      coalesce(nullif(plan_payload->>'full_name', ''), '(Draft)'),
      nullif(plan_payload->>'start_date', '')::date,
      nullif(plan_payload->>'calendar_start_date', '')::date,
      coalesce((plan_payload->>'target_pi')::integer, 0),
      coalesce((plan_payload->>'target_sales')::numeric, 0),
      coalesce(plan_payload->'info_fields', '{}'::jsonb),
      coalesce(plan_payload->'checklist', '[]'::jsonb),
      case
        when coalesce(nullif(plan_payload->>'status', ''), 'submitted') = 'draft' then 'draft'
        else 'submitted'
      end
    )
    returning * into saved_plan;
  else
    update public.plans
    set
      parent_plan_id = nullif(plan_payload->>'parent_plan_id', '')::uuid,
      owner_role = coalesce(nullif(plan_payload->>'owner_role', ''), plan_payload->>'role_type'),
      role_type = plan_payload->>'role_type',
      full_name = coalesce(nullif(plan_payload->>'full_name', ''), '(Draft)'),
      start_date = nullif(plan_payload->>'start_date', '')::date,
      calendar_start_date = nullif(plan_payload->>'calendar_start_date', '')::date,
      target_pi = coalesce((plan_payload->>'target_pi')::integer, 0),
      target_sales = coalesce((plan_payload->>'target_sales')::numeric, 0),
      info = coalesce(plan_payload->'info_fields', '{}'::jsonb),
      checklist = coalesce(plan_payload->'checklist', '[]'::jsonb),
      status = case
        when coalesce(nullif(plan_payload->>'status', ''), 'submitted') = 'draft' then 'draft'
        else 'submitted'
      end,
      reviewed_at = null,
      reviewed_by = null,
      updated_at = now()
    where id = target_plan_id
      and user_id = auth.uid()
    returning * into saved_plan;

    if saved_plan.id is null then
      raise exception 'Plan not found or not editable.';
    end if;
  end if;

  delete from public.plan_week_entries
  where plan_id = saved_plan.id;

  delete from public.plan_consolidation_entries
  where plan_id = saved_plan.id;

  insert into public.plan_week_entries (
    plan_id,
    week_number,
    activity_name,
    activity_date,
    leads,
    attendees,
    pay_ins,
    sales,
    extra
  )
  select
    saved_plan.id,
    (entry->>'week_number')::integer,
    entry->>'activity_name',
    nullif(entry->>'activity_date', '')::date,
    coalesce((entry->>'leads')::integer, 0),
    coalesce((entry->>'attendees')::integer, 0),
    coalesce((entry->>'pay_ins')::integer, 0),
    coalesce((entry->>'sales')::numeric, 0),
    coalesce(entry->'extra', '{}'::jsonb)
  from jsonb_array_elements(coalesce(plan_payload->'week_entries', '[]'::jsonb)) entry;

  insert into public.plan_consolidation_entries (
    plan_id,
    name,
    role_label,
    leads,
    att,
    pi,
    sales,
    evt,
    pi_target
  )
  select
    saved_plan.id,
    coalesce(entry->>'name', ''),
    coalesce(entry->>'role_label', ''),
    coalesce((entry->>'leads')::integer, 0),
    coalesce((entry->>'att')::integer, 0),
    coalesce((entry->>'pi')::integer, 0),
    coalesce((entry->>'sales')::numeric, 0),
    coalesce((entry->>'evt')::integer, 0),
    coalesce((entry->>'pi_target')::integer, 0)
  from jsonb_array_elements(coalesce(plan_payload->'consolidation_entries', '[]'::jsonb)) entry
  where coalesce(entry->>'name', '') <> '';

  return saved_plan;
end;
$$;

create or replace function review_plan(
  target_plan_id uuid,
  next_status text,
  review_note text default null
)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  reviewed_plan public.plans%rowtype;
begin
  if not public.current_user_has_full_access() then
    raise exception 'Verified and approved access is required before reviewing plans.';
  end if;

  if next_status not in ('approved', 'needs_revision') then
    raise exception 'Unsupported review status.';
  end if;

  update public.plans
  set
    status = next_status,
    review_notes = nullif(review_note, ''),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = target_plan_id
    and user_id <> auth.uid()
    and can_read_plan(id)
    and status <> 'draft'
  returning * into reviewed_plan;

  if reviewed_plan.id is null then
    raise exception 'Plan not found or not reviewable.';
  end if;

  return reviewed_plan;
end;
$$;

grant execute on function list_potential_parent_plans(text) to authenticated;
grant execute on function save_plan_bundle(jsonb) to authenticated;
grant execute on function review_plan(uuid, text, text) to authenticated;
grant execute on function sync_my_profile(jsonb) to authenticated;
grant execute on function list_user_profiles() to authenticated;
grant execute on function list_directory_profiles() to authenticated;
grant execute on function admin_update_user_profile(uuid, jsonb) to authenticated;
grant execute on function get_planner_dashboard() to authenticated;
grant execute on function list_plan_activity(integer) to authenticated;
grant execute on function is_current_user_verified() to authenticated;
grant execute on function current_user_has_full_access() to authenticated;

drop trigger if exists plans_set_updated_at on plans;
create trigger plans_set_updated_at
before update on plans
for each row
execute function set_updated_at();

drop trigger if exists plans_audit_log_trigger on plans;
create trigger plans_audit_log_trigger
after insert or update or delete on plans
for each row
execute function log_plan_audit_event();

alter table organizations enable row level security;
alter table teams enable row level security;
alter table user_team_memberships enable row level security;
alter table user_profiles enable row level security;
alter table hierarchy_link_directory enable row level security;
alter table plans enable row level security;
alter table plan_week_entries enable row level security;
alter table plan_consolidation_entries enable row level security;
alter table plan_audit_log enable row level security;
alter table user_profile_audit_log enable row level security;

drop policy if exists users_select_own_orgs on organizations;
drop policy if exists users_select_relevant_teams on teams;
drop policy if exists users_select_own_team_memberships on user_team_memberships;
drop policy if exists users_select_profiles on user_profiles;
drop policy if exists users_insert_profiles on user_profiles;
drop policy if exists users_update_profiles on user_profiles;
drop policy if exists users_select_hierarchy_link_directory on hierarchy_link_directory;
drop policy if exists users_select_plan_audit_log on plan_audit_log;
drop policy if exists users_select_user_profile_audit_log on user_profile_audit_log;

create policy users_select_own_orgs
on organizations
for select
using (
  exists (
    select 1
    from public.user_team_memberships membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
  )
);

create policy users_select_relevant_teams
on teams
for select
using (
  exists (
    select 1
    from public.user_team_memberships membership
    join public.teams own_team on own_team.id = membership.team_id
    where membership.user_id = auth.uid()
      and (
        membership.team_id = teams.id
        or own_team.parent_team_id = teams.id
      )
  )
);

create policy users_select_own_team_memberships
on user_team_memberships
for select
using (user_id = auth.uid());

create policy users_select_profiles
on user_profiles
for select
using (user_id = auth.uid() or public.is_admin_user());

create policy users_insert_profiles
on user_profiles
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

create policy users_update_profiles
on user_profiles
for update
using (user_id = auth.uid() or public.is_admin_user() or auth.role() = 'service_role')
with check (user_id = auth.uid() or public.is_admin_user() or auth.role() = 'service_role');

create policy users_select_hierarchy_link_directory
on hierarchy_link_directory
for select
using (public.is_admin_user());

drop policy if exists users_manage_own_plans on plans;
drop policy if exists users_select_visible_plans on plans;
drop policy if exists users_insert_own_plans on plans;
drop policy if exists users_update_own_plans on plans;
drop policy if exists users_delete_own_plans on plans;

create policy users_select_visible_plans
on plans
for select
using (can_read_plan(id));

create policy users_insert_own_plans
on plans
for insert
with check (
  auth.uid() = user_id
  and is_valid_parent_plan(parent_plan_id, role_type, null)
);

create policy users_update_own_plans
on plans
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and is_valid_parent_plan(parent_plan_id, role_type, id)
);

create policy users_delete_own_plans
on plans
for delete
using (auth.uid() = user_id);

drop policy if exists users_manage_own_plan_week_entries on plan_week_entries;
drop policy if exists users_select_visible_plan_week_entries on plan_week_entries;
drop policy if exists users_insert_own_plan_week_entries on plan_week_entries;
drop policy if exists users_update_own_plan_week_entries on plan_week_entries;
drop policy if exists users_delete_own_plan_week_entries on plan_week_entries;

create policy users_select_visible_plan_week_entries
on plan_week_entries
for select
using (can_read_plan(plan_id));

create policy users_insert_own_plan_week_entries
on plan_week_entries
for insert
with check (can_edit_plan(plan_id));

create policy users_update_own_plan_week_entries
on plan_week_entries
for update
using (can_edit_plan(plan_id))
with check (can_edit_plan(plan_id));

create policy users_delete_own_plan_week_entries
on plan_week_entries
for delete
using (can_edit_plan(plan_id));

drop policy if exists users_manage_own_plan_consolidation_entries on plan_consolidation_entries;
drop policy if exists users_select_visible_plan_consolidation_entries on plan_consolidation_entries;
drop policy if exists users_insert_own_plan_consolidation_entries on plan_consolidation_entries;
drop policy if exists users_update_own_plan_consolidation_entries on plan_consolidation_entries;
drop policy if exists users_delete_own_plan_consolidation_entries on plan_consolidation_entries;

create policy users_select_visible_plan_consolidation_entries
on plan_consolidation_entries
for select
using (can_read_plan(plan_id));

create policy users_insert_own_plan_consolidation_entries
on plan_consolidation_entries
for insert
with check (can_edit_plan(plan_id));

create policy users_update_own_plan_consolidation_entries
on plan_consolidation_entries
for update
using (can_edit_plan(plan_id))
with check (can_edit_plan(plan_id));

create policy users_delete_own_plan_consolidation_entries
on plan_consolidation_entries
for delete
using (can_edit_plan(plan_id));

create policy users_select_plan_audit_log
on plan_audit_log
for select
using (
  public.is_admin_user()
  or plan_owner_user_id = auth.uid()
  or public.can_read_plan(plan_id)
);

create policy users_select_user_profile_audit_log
on user_profile_audit_log
for select
using (
  public.is_admin_user()
  or target_user_id = auth.uid()
);

grant usage on schema public to anon, authenticated;

grant select on public.organizations to authenticated;
grant select on public.teams to authenticated;
grant select on public.user_team_memberships to authenticated;
grant select on public.user_profiles to authenticated;
grant select on public.plan_audit_log to authenticated;
grant select on public.user_profile_audit_log to authenticated;

grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.plan_week_entries to authenticated;
grant select, insert, update, delete on public.plan_consolidation_entries to authenticated;
