-- Backfill older user profile records so the admin directory can show consistent approval metadata.

update public.user_profiles
set approved_at = coalesce(approved_at, updated_at, created_at, now())
where approval_status = 'approved'
  and approved_at is null;

update public.user_profiles target
set approved_by = coalesce(target.approved_by, admin.user_id)
from public.user_profiles admin
where lower(admin.email) = lower('your-admin@email.com')
  and target.approval_status = 'approved'
  and target.approved_by is null;

update public.user_profiles
set is_active = true
where approval_status = 'approved'
  and is_active is null;
