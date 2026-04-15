-- Directory and hierarchy seed for the team-chain logic introduced in supabase-schema.sql.
--
-- What this does:
-- 1. Creates one organization and one full O1 -> Platoon -> Squad -> Team chain.
-- 2. Resolves users by email from auth.users instead of requiring manual UUID lookup.
-- 3. Assigns each user to the correct team in user_team_memberships.
-- 4. Bootstraps one draft plan for leader / squad / platoon / o1 when missing so child dropdowns can populate.
--
-- How to use:
-- 1. Replace the email values in the set_config(...) block below.
-- 2. Run the whole file in the Supabase SQL editor after supabase-schema.sql.
-- 3. Sign in again in the app and reopen the relevant role form.
--
-- Important:
-- - Each email must already exist in auth.users.
-- - The member and leader should usually belong to the same team.
-- - The leader, squad, platoon, and o1 users get bootstrap draft plans if they do not already have one.

select
  set_config('gutguard.member_email', 'erikajayme0330@gmail.com', false),
  set_config('gutguard.leader_email', 'erikajay0330@yahoo.com', false),
  set_config('gutguard.squad_email', 'squad@example.com', false),
  set_config('gutguard.platoon_email', 'platoon@example.com', false),
  set_config('gutguard.o1_email', 'o1@example.com', false);

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
      raise exception 'Missing email for config key % in supabase-directory-seed.sql.', email_key;
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
    'Gutguard'::text as organization_name,
    'gutguard-main'::text as organization_code,
    'Davao O1'::text as o1_name,
    'dvo-o1'::text as o1_code,
    'Platoon Alpha'::text as platoon_name,
    'platoon-alpha'::text as platoon_code,
    'Squad One'::text as squad_name,
    'squad-one'::text as squad_code,
    'Team Spark'::text as team_name,
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
  select ofn.id, null, 'o1', s.o1_name, s.o1_code
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
  select o1.organization_id, o1.id, 'platoon', s.platoon_name, s.platoon_code
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
  select p.organization_id, p.id, 'squad', s.squad_name, s.squad_code
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
  select sq.organization_id, sq.id, 'team', s.team_name, s.team_code
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
),
leader_plan as (
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
    coalesce(nullif(split_part(lu.email, '@', 1), ''), 'Team Leader'),
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from leader_user lu
  where not exists (
    select 1
    from public.plans p
    where p.user_id = lu.id
      and p.role_type = 'leader'
  )
  returning id, user_id
),
squad_plan as (
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
    coalesce(nullif(split_part(su.email, '@', 1), ''), 'Squad Leader'),
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from squad_user su
  where not exists (
    select 1
    from public.plans p
    where p.user_id = su.id
      and p.role_type = 'squad'
  )
  returning id, user_id
),
platoon_plan as (
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
    coalesce(nullif(split_part(pu.email, '@', 1), ''), 'Platoon Leader'),
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from platoon_user pu
  where not exists (
    select 1
    from public.plans p
    where p.user_id = pu.id
      and p.role_type = 'platoon'
  )
  returning id, user_id
),
o1_plan as (
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
    coalesce(nullif(split_part(ou.email, '@', 1), ''), 'O1 Leader'),
    0,
    0,
    '{}'::jsonb,
    '[]'::jsonb,
    'draft'
  from o1_user ou
  where not exists (
    select 1
    from public.plans p
    where p.user_id = ou.id
      and p.role_type = 'o1'
  )
  returning id, user_id
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
  ofn.code as o1_team_code,
  (
    select p.id
    from public.plans p
    where p.user_id = lu.id
      and p.role_type = 'leader'
    order by p.updated_at desc
    limit 1
  ) as leader_plan_id,
  (
    select p.id
    from public.plans p
    where p.user_id = su.id
      and p.role_type = 'squad'
    order by p.updated_at desc
    limit 1
  ) as squad_plan_id,
  (
    select p.id
    from public.plans p
    where p.user_id = pu.id
      and p.role_type = 'platoon'
    order by p.updated_at desc
    limit 1
  ) as platoon_plan_id,
  (
    select p.id
    from public.plans p
    where p.user_id = ou.id
      and p.role_type = 'o1'
    order by p.updated_at desc
    limit 1
  ) as o1_plan_id
from member_user mu
cross join leader_user lu
cross join squad_user su
cross join platoon_user pu
cross join o1_user ou
cross join team_final tf
cross join squad_final sf
cross join platoon_final pf
cross join o1_final ofn;

-- If the final SELECT returns no rows:
-- - Check the emails above.
-- - Make sure all users already exist in auth.users.
