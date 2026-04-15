-- Parent dropdown troubleshooting for "No parent selected" / no parent plans found.
--
-- Replace the values in the input CTE, then run each SELECT in Supabase SQL editor.
-- This does not change data. It only helps you find what is missing.
--
-- Most common causes:
-- 1. The latest supabase-schema.sql was not rerun.
-- 2. The child user is not in user_team_memberships.
-- 3. The parent user is not in the correct parent team in the same chain.
-- 4. The parent user has no saved parent plan yet.

with input as (
  select
    '3c89a9e8-4a47-4d72-ad6b-8e81ca634e91'::uuid as child_user_id,
    'member'::text as child_role_type
),
params as (
  select
    child_user_id,
    child_role_type,
    public.expected_parent_role(child_role_type) as expected_parent_role,
    public.current_unit_type_for_role(child_role_type) as child_unit_type,
    public.parent_unit_type_for_role(child_role_type) as parent_unit_type
  from input
),
child_membership as (
  select
    m.user_id,
    m.organization_id,
    m.team_id,
    t.name as team_name,
    t.unit_type as team_unit_type,
    t.parent_team_id
  from public.user_team_memberships m
  join public.teams t on t.id = m.team_id
  join params p on p.child_user_id = m.user_id
),
candidate_parent_users as (
  select distinct
    pm.user_id as parent_user_id,
    pt.id as parent_team_id,
    pt.name as parent_team_name,
    pt.unit_type as parent_team_unit_type,
    p.expected_parent_role
  from params p
  join child_membership cm on cm.team_unit_type = p.child_unit_type
  join public.user_team_memberships pm on pm.organization_id = cm.organization_id
  join public.teams pt on pt.id = pm.team_id
  where pt.unit_type = p.parent_unit_type
    and (
      (p.child_role_type = 'member' and pm.team_id = cm.team_id)
      or
      (p.child_role_type in ('leader', 'squad', 'platoon') and pm.team_id = cm.parent_team_id)
    )
),
candidate_parent_plans as (
  select
    cpu.parent_user_id,
    cpu.parent_team_name,
    cpu.parent_team_unit_type,
    pl.id as parent_plan_id,
    pl.full_name,
    pl.role_type,
    pl.status,
    pl.updated_at
  from candidate_parent_users cpu
  left join public.plans pl
    on pl.user_id = cpu.parent_user_id
   and pl.role_type = cpu.expected_parent_role
)
select
  'params' as section,
  row_to_json(params)::text as details
from params;

with input as (
  select
    '3c89a9e8-4a47-4d72-ad6b-8e81ca634e91'::uuid as child_user_id,
    'member'::text as child_role_type
)
select
  'child_membership' as section,
  m.user_id,
  m.organization_id,
  t.id as team_id,
  t.name as team_name,
  t.unit_type,
  t.parent_team_id
from public.user_team_memberships m
join public.teams t on t.id = m.team_id
join input i on i.child_user_id = m.user_id;

with input as (
  select
    '3c89a9e8-4a47-4d72-ad6b-8e81ca634e91'::uuid as child_user_id,
    'member'::text as child_role_type
),
params as (
  select
    child_user_id,
    child_role_type,
    public.expected_parent_role(child_role_type) as expected_parent_role,
    public.current_unit_type_for_role(child_role_type) as child_unit_type,
    public.parent_unit_type_for_role(child_role_type) as parent_unit_type
  from input
),
child_membership as (
  select
    m.user_id,
    m.organization_id,
    m.team_id,
    t.name as team_name,
    t.unit_type as team_unit_type,
    t.parent_team_id
  from public.user_team_memberships m
  join public.teams t on t.id = m.team_id
  join params p on p.child_user_id = m.user_id
),
candidate_parent_users as (
  select distinct
    pm.user_id as parent_user_id,
    pt.id as parent_team_id,
    pt.name as parent_team_name,
    pt.unit_type as parent_team_unit_type,
    p.expected_parent_role
  from params p
  join child_membership cm on cm.team_unit_type = p.child_unit_type
  join public.user_team_memberships pm on pm.organization_id = cm.organization_id
  join public.teams pt on pt.id = pm.team_id
  where pt.unit_type = p.parent_unit_type
    and (
      (p.child_role_type = 'member' and pm.team_id = cm.team_id)
      or
      (p.child_role_type in ('leader', 'squad', 'platoon') and pm.team_id = cm.parent_team_id)
    )
)
select
  parent_user_id,
  parent_team_name,
  parent_team_unit_type,
  expected_parent_role
from candidate_parent_users
order by parent_team_name, parent_user_id;

with input as (
  select
    '3c89a9e8-4a47-4d72-ad6b-8e81ca634e91'::uuid as child_user_id,
    'member'::text as child_role_type
),
params as (
  select
    child_user_id,
    child_role_type,
    public.expected_parent_role(child_role_type) as expected_parent_role,
    public.current_unit_type_for_role(child_role_type) as child_unit_type,
    public.parent_unit_type_for_role(child_role_type) as parent_unit_type
  from input
),
child_membership as (
  select
    m.user_id,
    m.organization_id,
    m.team_id,
    t.name as team_name,
    t.unit_type as team_unit_type,
    t.parent_team_id
  from public.user_team_memberships m
  join public.teams t on t.id = m.team_id
  join params p on p.child_user_id = m.user_id
),
candidate_parent_users as (
  select distinct
    pm.user_id as parent_user_id,
    pt.id as parent_team_id,
    pt.name as parent_team_name,
    pt.unit_type as parent_team_unit_type,
    p.expected_parent_role
  from params p
  join child_membership cm on cm.team_unit_type = p.child_unit_type
  join public.user_team_memberships pm on pm.organization_id = cm.organization_id
  join public.teams pt on pt.id = pm.team_id
  where pt.unit_type = p.parent_unit_type
    and (
      (p.child_role_type = 'member' and pm.team_id = cm.team_id)
      or
      (p.child_role_type in ('leader', 'squad', 'platoon') and pm.team_id = cm.parent_team_id)
    )
)
select
  cpu.parent_user_id,
  cpu.parent_team_name,
  cpu.parent_team_unit_type,
  pl.id as parent_plan_id,
  pl.full_name,
  pl.role_type,
  pl.status,
  pl.updated_at
from candidate_parent_users cpu
left join public.plans pl
  on pl.user_id = cpu.parent_user_id
 and pl.role_type = cpu.expected_parent_role
order by cpu.parent_team_name, pl.updated_at desc nulls last;

-- Explicit validity check for the selected child, parent, and parent plan.
-- Replace child_user_id, parent_user_id, and parent_plan_id as needed.
with input as (
  select
    '3c89a9e8-4a47-4d72-ad6b-8e81ca634e91'::uuid as child_user_id,
    'member'::text as child_role_type,
    'fbf73cc4-6ec9-4f63-bcf6-23862fb3a0a4'::uuid as parent_user_id,
    'e4cd3163-02e2-41d8-bb93-e22d51af5f3c'::uuid as parent_plan_id
),
params as (
  select
    child_user_id,
    child_role_type,
    public.expected_parent_role(child_role_type) as expected_parent_role,
    public.current_unit_type_for_role(child_role_type) as child_unit_type,
    public.parent_unit_type_for_role(child_role_type) as parent_unit_type,
    parent_user_id,
    parent_plan_id
  from input
),
child_membership as (
  select
    m.user_id as child_user_id,
    m.organization_id as child_organization_id,
    m.team_id as child_team_id,
    t.name as child_team_name,
    t.unit_type as child_team_unit_type,
    t.parent_team_id as child_parent_team_id
  from public.user_team_memberships m
  join public.teams t on t.id = m.team_id
  join params p on p.child_user_id = m.user_id
),
parent_membership as (
  select
    m.user_id as parent_user_id,
    m.organization_id as parent_organization_id,
    m.team_id as parent_team_id,
    t.name as parent_team_name,
    t.unit_type as parent_team_unit_type,
    t.parent_team_id as parent_parent_team_id
  from public.user_team_memberships m
  join public.teams t on t.id = m.team_id
  join params p on p.parent_user_id = m.user_id
),
parent_plan as (
  select
    p.id as parent_plan_id,
    p.user_id as parent_plan_user_id,
    p.role_type as parent_plan_role_type,
    p.status as parent_plan_status,
    p.full_name as parent_plan_full_name,
    p.parent_plan_id as parent_plan_parent_plan_id
  from public.plans p
  join params on p.id = params.parent_plan_id
),
validity as (
  select
    p.child_user_id,
    p.child_role_type,
    p.expected_parent_role,
    cp.child_team_id,
    cp.child_team_unit_type,
    cp.child_parent_team_id,
    pp.parent_user_id,
    pp.parent_team_id,
    pp.parent_team_unit_type,
    p.parent_plan_id,
    pl.parent_plan_role_type,
    pl.parent_plan_status,
    case
      when pl.parent_plan_role_type = p.expected_parent_role then true
      else false
    end as parent_plan_role_matches,
    case
      when p.child_role_type = 'member'
        and pp.parent_team_id = cp.child_team_id then true
      when p.child_role_type in ('leader','squad','platoon')
        and pp.parent_team_id = cp.child_parent_team_id then true
      else false
    end as parent_team_link_matches,
    case
      when pl.parent_plan_role_type = p.expected_parent_role
        and (
          (p.child_role_type = 'member' and pp.parent_team_id = cp.child_team_id)
          or (p.child_role_type in ('leader','squad','platoon') and pp.parent_team_id = cp.child_parent_team_id)
        ) then true
      else false
    end as explicit_link_valid
  from params p
  left join child_membership cp on cp.child_user_id = p.child_user_id
  left join parent_membership pp on pp.parent_user_id = p.parent_user_id
  left join parent_plan pl on pl.parent_plan_id = p.parent_plan_id
)
select * from validity;

-- Optional helper: list auth users so you can find the real UUIDs to use above.
-- select id, email, created_at from auth.users order by created_at desc;
