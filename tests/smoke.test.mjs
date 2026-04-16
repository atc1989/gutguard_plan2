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

  assert.match(source, /window\.__GUTGUARD_ENV/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("Home screen exposes separated overview, workspace, and operations panels", () => {
  const source = read("src/components/gutguard/HomeScreen.tsx");

  assert.match(source, /Overview/);
  assert.match(source, /Workspace/);
  assert.match(source, /Operations/);
  assert.match(source, /user-directory-list/);
  assert.match(source, /activity-feed-action/);
  assert.match(source, /admin-profiles-sort/);
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
});
