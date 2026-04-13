1. Create a Supabase project.
2. Open the SQL editor and run [supabase-schema.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-schema.sql).
3. In Supabase Dashboard, enable `Authentication > Providers > Email`.
4. Open [supabase-config.js](/c:/Users/asiapac1/Downloads/gutguard/supabase-config.js) and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Open [gutguard_90day_plan (4).html](/c:/Users/asiapac1/Downloads/gutguard/gutguard_90day_plan (4).html) in the browser.
6. Sign up or sign in from the `Account Access` section on the home screen.
7. Save a plan. The page will store the last saved `plan_id` per role in `localStorage` so `Load Saved Plan` can rehydrate it.

Notes:
- This implementation now expects Supabase Auth and row-level security.
- If you already created the old schema, rerun [supabase-schema.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-schema.sql) so the hierarchy-aware helper functions, directory tables, `save_plan_bundle(...)` RPC, and updated RLS policies are installed.
- Saved-plan browsing on the home screen now returns only the signed-in user's own plans.
- Parent-plan dropdowns now come from the `list_potential_parent_plans` RPC, while linked parent users can read descendant plans through the new hierarchy RLS rules.
- Draft saves and submit actions now use the `save_plan_bundle(...)` RPC for atomic saves instead of client-side delete/reinsert sequences.
- Local autosave is device-only and stored in `localStorage`; it restores unsaved in-progress changes for the active role on the same device/browser.
- The narrowed parent dropdown depends on the new directory tables: `organizations`, `teams`, and `user_team_memberships`.
- You need to seed those directory tables so users are assigned to the correct team/squad/platoon/o1 chain; otherwise the parent dropdown will be empty even though saving and direct plan ownership still work.
- Use [supabase-directory-seed.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-directory-seed.sql) as a starting template for populating the directory tables.
- For the common `Member -> Team Leader` empty-parent case, use [supabase-fix-member-parent.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-fix-member-parent.sql) and replace the two email addresses before running it.
- If the parent dropdown stays empty or only shows the placeholder, run [supabase-parent-diagnostic.sql](/c:/Users/asiapac1/Downloads/gutguard/supabase-parent-diagnostic.sql) after replacing the sample user UUID and child role.
