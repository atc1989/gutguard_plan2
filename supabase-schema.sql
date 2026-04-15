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

create or replace function can_edit_plan(target_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
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
  select auth.uid() is not null
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
  with params as (
    select
      expected_parent_role(child_role_type) as expected_parent_role,
      current_unit_type_for_role(child_role_type) as child_unit_type,
      parent_unit_type_for_role(child_role_type) as parent_unit_type
  )
  select auth.uid() is not null
    and parent_user_id is not null
    and exists (
      select 1
      from params
      join public.user_team_memberships my_membership
        on my_membership.user_id = auth.uid()
      join public.teams my_team
        on my_team.id = my_membership.team_id
      join public.user_team_memberships parent_membership
        on parent_membership.user_id = parent_user_id
      join public.teams parent_team
        on parent_team.id = parent_membership.team_id
      where params.expected_parent_role is not null
        and my_team.unit_type = params.child_unit_type
        and parent_team.unit_type = params.parent_unit_type
        and (
          (
            child_role_type = 'member'
            and parent_membership.team_id = my_membership.team_id
          )
          or
          (
            child_role_type in ('leader', 'squad', 'platoon')
            and parent_membership.team_id = my_team.parent_team_id
          )
        )
    );
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
    p.full_name,
    p.status,
    p.updated_at,
    p.created_at,
    p.parent_plan_id,
    p.owner_role
  from public.plans p
  where auth.uid() is not null
    and p.role_type = expected_parent_role(child_role_type)
    and current_user_can_link_to_parent(p.user_id, child_role_type)
  order by p.updated_at desc;
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
  if auth.uid() is null then
    raise exception 'Please sign in before saving plans.';
  end if;

  target_plan_id := nullif(plan_payload->>'id', '')::uuid;

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
  if auth.uid() is null then
    raise exception 'Please sign in before reviewing plans.';
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

drop trigger if exists plans_set_updated_at on plans;
create trigger plans_set_updated_at
before update on plans
for each row
execute function set_updated_at();

alter table organizations enable row level security;
alter table teams enable row level security;
alter table user_team_memberships enable row level security;
alter table plans enable row level security;
alter table plan_week_entries enable row level security;
alter table plan_consolidation_entries enable row level security;

drop policy if exists users_select_own_orgs on organizations;
drop policy if exists users_select_relevant_teams on teams;
drop policy if exists users_select_own_team_memberships on user_team_memberships;

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

grant usage on schema public to anon, authenticated;

grant select on public.organizations to authenticated;
grant select on public.teams to authenticated;
grant select on public.user_team_memberships to authenticated;

grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.plan_week_entries to authenticated;
grant select, insert, update, delete on public.plan_consolidation_entries to authenticated;
