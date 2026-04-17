import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(projectRoot, filePath), "utf8");
}

test("Gutguard planner injects runtime Supabase env before legacy scripts", () => {
  const source = read("src/components/gutguard/GutguardPlanner.tsx");
  const dataSource = read("src/lib/gutguard-data.ts");

  assert.match(source, /window\.__GUTGUARD_ENV/);
  assert.match(source, /window\.__GUTGUARD_SITE_CONFIG/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(dataSource, /gutguard-admin\.js/);
});

test("Site config centralizes operational copy instead of hardcoded dates", () => {
  const headerSource = read("src/components/gutguard/Header.tsx");
  const homeSource = read("src/components/gutguard/HomeScreen.tsx");
  const configSource = read("src/lib/gutguard-site-config.ts");
  const legacySource = read("gutguard-app.js");

  assert.match(configSource, /deadlineLabel/);
  assert.match(configSource, /executionWindow/);
  assert.match(configSource, /calendarWindowNote/);
  assert.doesNotMatch(headerSource, /Apr 1, 2026|March 23, 2026|April 5 - July 5, 2026/);
  assert.doesNotMatch(homeSource, /Apr 1, 2026/);
  assert.doesNotMatch(legacySource, /April 5 - July 5, 2026/);
});

test("Home screen exposes separated overview, workspace, and operations panels", () => {
  const source = read("src/components/gutguard/HomeScreen.tsx");

  assert.match(source, /Overview/);
  assert.match(source, /Workspace/);
  assert.match(source, /Operations/);
  assert.match(source, /user-directory-list/);
  assert.match(source, /activity-feed-action/);
  assert.match(source, /admin-profiles-sort/);
  assert.match(source, /scheduleRefresh\(/);
  assert.doesNotMatch(source, /window\./);
});

test("Home screen uses accessible tabs and button controls for major interactions", () => {
  const source = read("src/components/gutguard/HomeScreen.tsx");

  assert.match(source, /role="tablist"/);
  assert.match(source, /role: "tab"/);
  assert.match(source, /role: "tabpanel"/);
  assert.match(source, /aria-controls": `home-panel-\$\{panel\}`/);
  assert.match(source, /className=\{`fc-badge \$\{item\.className\}`\}/);
  assert.match(source, /className=\{`tc \$\{card\.tileClass\}`\}/);
  assert.doesNotMatch(source, /<div\s+key=\{card\.role\}\s+className=\{`tc/);
  assert.doesNotMatch(source, /<div[^>]*onClick=/);
  assert.doesNotMatch(source, /<span[^>]*onClick=/);
});

test("React shell routes planner actions through the action context bridge", () => {
  const plannerSource = read("src/components/gutguard/GutguardPlanner.tsx");
  const contextSource = read("src/components/gutguard/GutguardActionContext.tsx");
  const legacySource = read("gutguard-app.js");

  assert.match(plannerSource, /GutguardActionProvider/);
  assert.match(contextSource, /CustomEvent\("gutguard:action"/);
  assert.match(legacySource, /document\.addEventListener\('gutguard:action'/);
});

test("React shell replaces injected legacy planner markup with JSX shells", () => {
  const plannerSource = read("src/components/gutguard/GutguardPlanner.tsx");
  const formSource = read("src/components/gutguard/FormScreen.tsx");
  const modalSource = read("src/components/gutguard/AddMemberModal.tsx");
  const footerSource = read("src/components/gutguard/Footer.tsx");
  const legacySource = read("gutguard-app.js");

  assert.doesNotMatch(plannerSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(formSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(modalSource, /dangerouslySetInnerHTML/);
  assert.match(formSource, /id="forminner"/);
  assert.match(modalSource, /id="modal-title"/);
  assert.match(footerSource, /id="toast"/);
  assert.match(legacySource, /document\.addEventListener\('gutguard:modal-action'/);
});

test("legacy planner renders admin feedback and setup messaging without supabase-config.js guidance", () => {
  const legacySource = read("gutguard-app.js");
  const adminSource = read("gutguard-admin.js");

  assert.match(legacySource, /adminProfileFeedback/);
  assert.match(legacySource, /getSupabaseSetupMessage/);
  assert.match(legacySource, /invalidateOperationsCaches/);
  assert.match(legacySource, /refreshOperationsPanels/);
  assert.match(legacySource, /Approved status set, timestamp missing/);
  assert.match(adminSource, /Change Summary/);
  assert.match(adminSource, /Approved By/);
  assert.equal((adminSource.match(/Approved At/g) || []).length, 1);
  assert.doesNotMatch(adminSource, /latestLabel\.textContent='Latest Plan'/);
  assert.doesNotMatch(legacySource, /supabase-config\.js/);
});

test("Supabase config prefers runtime env and still keeps a local fallback", () => {
  const source = read("supabase-config.js");

  assert.match(source, /window\.__GUTGUARD_ENV/);
  assert.match(source, /fallbackConfig/);
  assert.match(source, /runtimeConfig\.supabaseUrl \|\| fallbackConfig\.supabaseUrl/);
});

test("Schema contains directory and profile-audit support", () => {
  const source = read("supabase-schema.sql");

  assert.match(source, /create table if not exists hierarchy_link_directory/i);
  assert.match(source, /create table if not exists user_profile_audit_log/i);
  assert.match(source, /create or replace function list_directory_profiles/i);
  assert.match(source, /grant execute on function list_directory_profiles\(\) to authenticated/i);
  assert.match(source, /approved_by_email/i);
  assert.match(source, /change_reason/i);
});
