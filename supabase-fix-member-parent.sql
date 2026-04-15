-- One-shot fix for the Member -> Team Leader parent dropdown.
--
-- What this does:
-- 1. Creates the organization/team chain if missing.
-- 2. Assigns one member user and one leader user to the same team by email.
-- 3. Ensures the leader has at least one leader plan so the member dropdown can populate.
--
-- How to use:
-- 1. Replace the two email addresses in the set_config(...) block below.
-- 2. Run this whole file in the Supabase SQL editor.
-- 3. Sign in as the member user and reopen the Member form.
--
-- Notes:
-- - This assumes you already ran the latest supabase-schema.sql.
-- - The leader draft plan created here is only a bootstrap record. The leader can later open it in the app and complete it properly.

select
  set_config('gutguard.member_email', 'erikajayme0330@gmail.com', false),
  set_config('gutguard.leader_email', 'erikajay0330@yahoo.com', false);

do $$
declare
  member_email_value text := current_setting('gutguard.member_email', true);
  leader_email_value text := current_setting('gutguard.leader_email', true);
begin
  if member_email_value is null or trim(member_email_value) = '' then
    raise exception 'Member email is blank in supabase-fix-member-parent.sql.';
  end if;

  if leader_email_value is null or trim(leader_email_value) = '' then
    raise exception 'Leader email is blank in supabase-fix-member-parent.sql.';
  end if;

  if lower(member_email_value) = lower(leader_email_value) then
    raise exception 'Member and leader emails must be different. Current value: %', member_email_value;
  end if;

  if not exists (
    select 1
    from auth.users
    where lower(email) = lower(member_email_value)
  ) then
    raise exception 'Member user % does not exist in auth.users.', member_email_value;
  end if;

  if not exists (
    select 1
    from auth.users
    where lower(email) = lower(leader_email_value)
  ) then
    raise exception 'Leader user % does not exist in auth.users.', leader_email_value;
  end if;
end $$;

with settings as (
  select
    current_setting('gutguard.member_email')::text as member_email,
    current_setting('gutguard.leader_email')::text as leader_email,
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
)
select
  mu.email as member_email,
  lu.email as leader_email,
  tf.id as team_id,
  tf.code as team_code,
  (
    select p.id
    from public.plans p
    where p.user_id = lu.id
      and p.role_type = 'leader'
    order by p.updated_at desc
    limit 1
  ) as leader_plan_id
from member_user mu
cross join leader_user lu
cross join team_final tf;

-- If the final SELECT returns no rows:
-- - Check the emails above.
-- - Make sure both users already exist in auth.users.
