-- Full hierarchy-chain bootstrap and fix.
--
-- What this does:
-- 1. Creates the organization and O1 -> Platoon -> Squad -> Team chain if missing.
-- 2. Assigns the member, leader, squad, platoon, and o1 users to the correct units by email.
-- 3. Creates or refreshes hierarchy_link_directory rows for leader/squad/platoon/o1.
-- 4. Ensures leader, squad, platoon, and o1 plans exist.
-- 5. Links the parent plan chain:
--      leader.parent_plan_id  -> squad plan
--      squad.parent_plan_id   -> platoon plan
--      platoon.parent_plan_id -> o1 plan
--      o1.parent_plan_id      -> null
--
-- Run this AFTER:
-- - supabase-schema.sql
-- - supabase-hierarchy-link-directory.sql
--
-- How to use:
-- 1. Replace the placeholder emails for squad/platoon/o1 below.
-- 2. Optionally replace the display names.
-- 3. Run the whole file in Supabase SQL editor.
-- 4. Sign out and sign back in in the app, then reopen the form for each role.

select
  set_config('gutguard.member_email', 'erikajayme0330@gmail.com', false),
  set_config('gutguard.leader_email', 'erikajay0330@yahoo.com', false),
  set_config('gutguard.squad_email', 'squadleader@gmail.com', false),
  set_config('gutguard.platoon_email', 'platoonleader@gmail.com', false),
  set_config('gutguard.o1_email', '01productcenter@gmail.com', false),
  set_config('gutguard.leader_name', 'Japson', false),
  set_config('gutguard.squad_name', 'Patrick', false),
  set_config('gutguard.platoon_name', 'Ryan', false),
  set_config('gutguard.o1_name', 'Bruce', false);

do $$
declare
  email_value text;
  email_key text;
begin
  foreach email_key in array array[
    'gutguard.member_email',
    'gutguard.leader_email',
    'gutguard.squad_email',
    'gutguard.platoon_email',
    'gutguard.o1_email'
  ]
  loop
    email_value := current_setting(email_key, true);

    if email_value is null or trim(email_value) = '' then
      raise exception 'Missing email for config key % in supabase-fix-full-hierarchy-chain.sql.', email_key;
    end if;

    if not exists (
      select 1
      from auth.users
      where lower(email) = lower(email_value)
    ) then
      raise exception 'User % does not exist in auth.users.', email_value;
    end if;
  end loop;
end $$;

with settings as (
  select
    current_setting('gutguard.member_email')::text as member_email,
    current_setting('gutguard.leader_email')::text as leader_email,
    current_setting('gutguard.squad_email')::text as squad_email,
    current_setting('gutguard.platoon_email')::text as platoon_email,
    current_setting('gutguard.o1_email')::text as o1_email,
    current_setting('gutguard.leader_name')::text as leader_name,
    current_setting('gutguard.squad_name')::text as squad_name,
    current_setting('gutguard.platoon_name')::text as platoon_name,
    current_setting('gutguard.o1_name')::text as o1_name,
    'Gutguard'::text as organization_name,
    'gutguard-main'::text as organization_code,
    'Davao O1'::text as o1_unit_name,
    'dvo-o1'::text as o1_code,
    'Platoon Alpha'::text as platoon_unit_name,
    'platoon-alpha'::text as platoon_code,
    'Squad One'::text as squad_unit_name,
    'squad-one'::text as squad_code,
    'Team Spark'::text as team_unit_name,
    'team-spark'::text as team_code
),
org_upsert as (
  insert into public.organizations (name, code)
  select organization_name, organization_code
  from settings
  on conflict (code) do update
  set name = excluded.name
  returning id, code
),
org_final as (
  select id, code from org_upsert
  union all
  select o.id, o.code
  from public.organizations o
  join settings s on s.organization_code = o.code
  limit 1
),
o1_insert as (
  insert into public.teams (organization_id, parent_team_id, unit_type, name, code)
  select ofn.id, null, 'o1', s.o1_unit_name, s.o1_code
  from org_final ofn
  cross join settings s
  on conflict do nothing
  returning id, organization_id, code
),
o1_final as (
  select id, organization_id, code from o1_insert
  union all
  select t.id, t.organization_id, t.code
  from public.teams t
  join settings s on s.o1_code = t.code
  limit 1
),
platoon_insert as (
  insert into public.teams (organization_id, parent_team_id, unit_type, name, code)
  select o1.organization_id, o1.id, 'platoon', s.platoon_unit_name, s.platoon_code
  from o1_final o1
  cross join settings s
  on conflict do nothing
  returning id, organization_id, code
),
platoon_final as (
  select id, organization_id, code from platoon_insert
  union all
  select t.id, t.organization_id, t.code
  from public.teams t
  join settings s on s.platoon_code = t.code
  limit 1
),
squad_insert as (
  insert into public.teams (organization_id, parent_team_id, unit_type, name, code)
  select p.organization_id, p.id, 'squad', s.squad_unit_name, s.squad_code
  from platoon_final p
  cross join settings s
  on conflict do nothing
  returning id, organization_id, code
),
squad_final as (
  select id, organization_id, code from squad_insert
  union all
  select t.id, t.organization_id, t.code
  from public.teams t
  join settings s on s.squad_code = t.code
  limit 1
),
team_insert as (
  insert into public.teams (organization_id, parent_team_id, unit_type, name, code)
  select sq.organization_id, sq.id, 'team', s.team_unit_name, s.team_code
  from squad_final sq
  cross join settings s
  on conflict do nothing
  returning id, organization_id, code
),
team_final as (
  select id, organization_id, code from team_insert
  union all
  select t.id, t.organization_id, t.code
  from public.teams t
  join settings s on s.team_code = t.code
  limit 1
),
member_user as (
  select u.id, u.email
  from auth.users u
  join settings s on lower(u.email) = lower(s.member_email)
),
leader_user as (
  select u.id, u.email
  from auth.users u
  join settings s on lower(u.email) = lower(s.leader_email)
),
squad_user as (
  select u.id, u.email
  from auth.users u
  join settings s on lower(u.email) = lower(s.squad_email)
),
platoon_user as (
  select u.id, u.email
  from auth.users u
  join settings s on lower(u.email) = lower(s.platoon_email)
),
o1_user as (
  select u.id, u.email
  from auth.users u
  join settings s on lower(u.email) = lower(s.o1_email)
),
member_membership as (
  insert into public.user_team_memberships (user_id, organization_id, team_id)
  select mu.id, tf.organization_id, tf.id
  from member_user mu
  cross join team_final tf
  on conflict (user_id, team_id) do nothing
  returning user_id
),
leader_membership as (
  insert into public.user_team_memberships (user_id, organization_id, team_id)
  select lu.id, tf.organization_id, tf.id
  from leader_user lu
  cross join team_final tf
  on conflict (user_id, team_id) do nothing
  returning user_id
),
squad_membership as (
  insert into public.user_team_memberships (user_id, organization_id, team_id)
  select su.id, sf.organization_id, sf.id
  from squad_user su
  cross join squad_final sf
  on conflict (user_id, team_id) do nothing
  returning user_id
),
platoon_membership as (
  insert into public.user_team_memberships (user_id, organization_id, team_id)
  select pu.id, pf.organization_id, pf.id
  from platoon_user pu
  cross join platoon_final pf
  on conflict (user_id, team_id) do nothing
  returning user_id
),
o1_membership as (
  insert into public.user_team_memberships (user_id, organization_id, team_id)
  select ou.id, ofn.organization_id, ofn.id
  from o1_user ou
  cross join o1_final ofn
  on conflict (user_id, team_id) do nothing
  returning user_id
)
select
  mu.email as member_email,
  lu.email as leader_email,
  su.email as squad_email,
  pu.email as platoon_email,
  ou.email as o1_email,
  tf.code as member_team_code,
  sf.code as squad_team_code,
  pf.code as platoon_team_code,
  ofn.code as o1_team_code
from member_user mu
cross join leader_user lu
cross join squad_user su
cross join platoon_user pu
cross join o1_user ou
cross join team_final tf
cross join squad_final sf
cross join platoon_final pf
cross join o1_final ofn;

with settings as (
  select
    current_setting('gutguard.leader_email')::text as leader_email,
    current_setting('gutguard.squad_email')::text as squad_email,
    current_setting('gutguard.platoon_email')::text as platoon_email,
    current_setting('gutguard.o1_email')::text as o1_email,
    current_setting('gutguard.leader_name')::text as leader_name,
    current_setting('gutguard.squad_name')::text as squad_name,
    current_setting('gutguard.platoon_name')::text as platoon_name,
    current_setting('gutguard.o1_name')::text as o1_name
),
directory_rows as (
  select leader_email as email, leader_name as display_name, 'leader'::text as role_type, 'Full-chain hierarchy directory'::text as notes from settings
  union all
  select squad_email, squad_name, 'squad'::text, 'Full-chain hierarchy directory'::text from settings
  union all
  select platoon_email, platoon_name, 'platoon'::text, 'Full-chain hierarchy directory'::text from settings
  union all
  select o1_email, o1_name, 'o1'::text, 'Full-chain hierarchy directory'::text from settings
),
updated as (
  update public.hierarchy_link_directory directory
  set
    display_name = rows.display_name,
    active = true,
    notes = rows.notes,
    updated_at = now()
  from directory_rows rows
  where lower(directory.email) = lower(rows.email)
    and directory.role_type = rows.role_type
  returning directory.id
)
insert into public.hierarchy_link_directory (email, display_name, role_type, active, notes)
select rows.email, rows.display_name, rows.role_type, true, rows.notes
from directory_rows rows
where not exists (
  select 1
  from public.hierarchy_link_directory directory
  where lower(directory.email) = lower(rows.email)
    and directory.role_type = rows.role_type
);

with settings as (
  select
    current_setting('gutguard.leader_email')::text as leader_email,
    current_setting('gutguard.squad_email')::text as squad_email,
    current_setting('gutguard.platoon_email')::text as platoon_email,
    current_setting('gutguard.o1_email')::text as o1_email,
    current_setting('gutguard.leader_name')::text as leader_name,
    current_setting('gutguard.squad_name')::text as squad_name,
    current_setting('gutguard.platoon_name')::text as platoon_name,
    current_setting('gutguard.o1_name')::text as o1_name
),
leader_user as (
  select id, email from auth.users u join settings s on lower(u.email) = lower(s.leader_email)
),
squad_user as (
  select id, email from auth.users u join settings s on lower(u.email) = lower(s.squad_email)
),
platoon_user as (
  select id, email from auth.users u join settings s on lower(u.email) = lower(s.platoon_email)
),
o1_user as (
  select id, email from auth.users u join settings s on lower(u.email) = lower(s.o1_email)
),
o1_plan_insert as (
  insert into public.plans (
    user_id,
    parent_plan_id,
    owner_role,
    role_type,
    full_name,
    target_pi,
    target_sales,
    info,
    checklist,
    status
  )
  select
    ou.id,
    null,
    'o1',
    'o1',
    s.o1_name,
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from o1_user ou
  cross join settings s
  where not exists (
    select 1 from public.plans p
    where p.user_id = ou.id and p.role_type = 'o1'
  )
  returning id
),
platoon_plan_insert as (
  insert into public.plans (
    user_id,
    parent_plan_id,
    owner_role,
    role_type,
    full_name,
    target_pi,
    target_sales,
    info,
    checklist,
    status
  )
  select
    pu.id,
    null,
    'platoon',
    'platoon',
    s.platoon_name,
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from platoon_user pu
  cross join settings s
  where not exists (
    select 1 from public.plans p
    where p.user_id = pu.id and p.role_type = 'platoon'
  )
  returning id
),
squad_plan_insert as (
  insert into public.plans (
    user_id,
    parent_plan_id,
    owner_role,
    role_type,
    full_name,
    target_pi,
    target_sales,
    info,
    checklist,
    status
  )
  select
    su.id,
    null,
    'squad',
    'squad',
    s.squad_name,
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from squad_user su
  cross join settings s
  where not exists (
    select 1 from public.plans p
    where p.user_id = su.id and p.role_type = 'squad'
  )
  returning id
),
leader_plan_insert as (
  insert into public.plans (
    user_id,
    parent_plan_id,
    owner_role,
    role_type,
    full_name,
    target_pi,
    target_sales,
    info,
    checklist,
    status
  )
  select
    lu.id,
    null,
    'leader',
    'leader',
    s.leader_name,
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from leader_user lu
  cross join settings s
  where not exists (
    select 1 from public.plans p
    where p.user_id = lu.id and p.role_type = 'leader'
  )
  returning id
)
select 1;

with settings as (
  select
    current_setting('gutguard.leader_email')::text as leader_email,
    current_setting('gutguard.squad_email')::text as squad_email,
    current_setting('gutguard.platoon_email')::text as platoon_email,
    current_setting('gutguard.o1_email')::text as o1_email
),
leader_plan as (
  select p.id
  from public.plans p
  join auth.users u on u.id = p.user_id
  join settings s on lower(u.email) = lower(s.leader_email)
  where p.role_type = 'leader'
  order by p.updated_at desc, p.created_at desc
  limit 1
),
squad_plan as (
  select p.id
  from public.plans p
  join auth.users u on u.id = p.user_id
  join settings s on lower(u.email) = lower(s.squad_email)
  where p.role_type = 'squad'
  order by p.updated_at desc, p.created_at desc
  limit 1
),
platoon_plan as (
  select p.id
  from public.plans p
  join auth.users u on u.id = p.user_id
  join settings s on lower(u.email) = lower(s.platoon_email)
  where p.role_type = 'platoon'
  order by p.updated_at desc, p.created_at desc
  limit 1
),
o1_plan as (
  select p.id
  from public.plans p
  join auth.users u on u.id = p.user_id
  join settings s on lower(u.email) = lower(s.o1_email)
  where p.role_type = 'o1'
  order by p.updated_at desc, p.created_at desc
  limit 1
)
update public.plans plan_row
set
  parent_plan_id = case
    when plan_row.role_type = 'leader' then (select id from squad_plan)
    when plan_row.role_type = 'squad' then (select id from platoon_plan)
    when plan_row.role_type = 'platoon' then (select id from o1_plan)
    when plan_row.role_type = 'o1' then null
    else plan_row.parent_plan_id
  end,
  updated_at = now()
where plan_row.id in (
  select id from leader_plan
  union all
  select id from squad_plan
  union all
  select id from platoon_plan
  union all
  select id from o1_plan
);

with settings as (
  select
    current_setting('gutguard.member_email')::text as member_email,
    current_setting('gutguard.leader_email')::text as leader_email,
    current_setting('gutguard.squad_email')::text as squad_email,
    current_setting('gutguard.platoon_email')::text as platoon_email,
    current_setting('gutguard.o1_email')::text as o1_email
)
select
  (select id from auth.users where lower(email) = lower(settings.member_email) limit 1) as member_user_id,
  (select id from auth.users where lower(email) = lower(settings.leader_email) limit 1) as leader_user_id,
  (select id from auth.users where lower(email) = lower(settings.squad_email) limit 1) as squad_user_id,
  (select id from auth.users where lower(email) = lower(settings.platoon_email) limit 1) as platoon_user_id,
  (select id from auth.users where lower(email) = lower(settings.o1_email) limit 1) as o1_user_id,
  (select p.id from public.plans p join auth.users u on u.id = p.user_id where lower(u.email) = lower(settings.leader_email) and p.role_type = 'leader' order by p.updated_at desc limit 1) as leader_plan_id,
  (select p.id from public.plans p join auth.users u on u.id = p.user_id where lower(u.email) = lower(settings.squad_email) and p.role_type = 'squad' order by p.updated_at desc limit 1) as squad_plan_id,
  (select p.id from public.plans p join auth.users u on u.id = p.user_id where lower(u.email) = lower(settings.platoon_email) and p.role_type = 'platoon' order by p.updated_at desc limit 1) as platoon_plan_id,
  (select p.id from public.plans p join auth.users u on u.id = p.user_id where lower(u.email) = lower(settings.o1_email) and p.role_type = 'o1' order by p.updated_at desc limit 1) as o1_plan_id
from settings;

-- Expected result after this script:
-- - Member can link to Team Leader
-- - Team Leader can link to Squad Leader
-- - Squad Leader can link to Platoon Leader
-- - Platoon Leader can link to O1 / Product Center
-- - O1 remains the top-most level with no parent link
