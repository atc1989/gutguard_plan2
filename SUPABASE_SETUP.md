1. Create or open your Supabase project.
2. In Supabase SQL Editor, run [supabase-schema.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-schema.sql).
3. Then run [supabase-hierarchy-link-directory.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-hierarchy-link-directory.sql).
4. In `Authentication -> Providers -> Email`, keep email/password enabled.
5. In `Authentication -> URL Configuration`, set your site URL and any local redirect URLs you use.
6. In `Authentication -> Users`, verify the first admin account’s email if email confirmation is enabled.
7. Promote your first admin in SQL:
```sql
update public.user_profiles
set
  is_admin = true,
  is_active = true,
  approval_status = 'approved',
  approved_at = coalesce(approved_at, now())
where lower(email) = lower('your-admin-email@example.com');
```
8. Create `.env.local` from [.env.example](/c:/Users/asiapac1/Downloads/gutguard/.env.example) and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
9. Start the site with `npm run dev`.
10. Sign up from the home screen, verify the email, and approve the account from the admin directory.

Notes:
- `supabase-schema.sql` is now the canonical source for hierarchy lookup, directory lookup, profile audit logging, and access rules.
- `supabase-hierarchy-link-directory.sql` only keeps the optional display-name directory table and seed rows aligned; it no longer overrides core RPCs.
- Parent dropdowns still show saved parent plans, not raw accounts. The new user directory shows who is approved and whether they already have a plan.
- Recent Activity now includes both plan events and account/admin changes.
- The app prefers `NEXT_PUBLIC_*` env vars, but `supabase-config.js` still has a fallback for local recovery.
- Local autosave is still device-only and stored in `localStorage`.
- If the parent dropdown stays empty, first confirm the parent account is verified, approved, active, and has already saved a plan for the required parent role.
