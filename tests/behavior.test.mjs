import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const projectRoot = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(projectRoot, filePath), "utf8");
}

function loadPlanApiWithClient(client, user = { id: "user-1", email_confirmed_at: "2026-04-17T00:00:00Z" }) {
  const source = read("plan-api.js");
  const window = {
    GutguardSupabase: {
      isConfigured: () => true,
      getClient: () => client,
      getUser: async () => user
    }
  };

  vm.runInNewContext(source, { window, console });
  return window.GutguardPlanApi;
}

function makeTableQuery(result) {
  return {
    data: result.data,
    error: result.error || null,
    select() {
      return this;
    },
    eq() {
      return this;
    },
    neq() {
      return this;
    },
    in() {
      return this;
    },
    delete() {
      return this;
    },
    order() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve(result);
    }
  };
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, `Expected to find ${name} in gutguard-app.js`);

  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unable to extract ${name}`);
}

test("plan API normalizes admin profile updates from the RPC layer", async () => {
  const rpcCalls = [];
  const api = loadPlanApiWithClient({
    rpc(name, args) {
      rpcCalls.push({ name, args });
      return {
        single: async () => ({
          data: {
            user_id: "user-42",
            email: "admin@example.com",
            display_name: "Admin User",
            role_type: "o1",
            is_admin: true,
            is_active: true,
            approval_status: "approved",
            notes: "Promoted",
            approved_at: "2026-04-17T08:00:00Z",
            approved_by: "user-admin",
            approved_by_email: "approver@example.com",
            approved_by_display_name: "Approver",
            created_at: "2026-04-16T08:00:00Z",
            updated_at: "2026-04-17T08:00:00Z",
            latest_plan_id: "plan-42",
            latest_plan_status: "draft",
            latest_plan_updated_at: "2026-04-17T08:05:00Z"
          },
          error: null
        })
      };
    }
  });

  const updated = await api.adminUpdateUserProfile("user-42", {
    approval_status: "approved",
    is_admin: true
  });

  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "admin_update_user_profile");
  assert.equal(rpcCalls[0].args.target_user_id, "user-42");
  assert.equal(updated.user_id, "user-42");
  assert.equal(updated.approval_status, "approved");
  assert.equal(updated.is_admin, true);
  assert.equal(updated.approved_by, "user-admin");
  assert.equal(updated.approved_by_email, "approver@example.com");
  assert.equal(updated.approved_by_display_name, "Approver");
  assert.equal(updated.latest_plan_status, "draft");
});

test("plan API retries save_plan_bundle as a new draft when the stored plan id is stale", async () => {
  const payloads = [];
  let callCount = 0;
  const api = loadPlanApiWithClient({
    rpc(name, args) {
      assert.equal(name, "save_plan_bundle");
      payloads.push(JSON.parse(JSON.stringify(args.plan_payload)));
      callCount += 1;
      return {
        single: async () =>
          callCount === 1
            ? { data: null, error: { message: "Plan not found or not editable." } }
            : {
                data: {
                  id: "new-plan-id",
                  user_id: "user-1",
                  role_type: "leader",
                  status: "draft",
                  full_name: "Recovered Draft",
                  target_pi: 12,
                  target_sales: 4000,
                  info: {},
                  checklist: [],
                  review_notes: "",
                  reviewed_at: null,
                  reviewed_by: null,
                  created_at: "2026-04-17T09:00:00Z",
                  updated_at: "2026-04-17T09:01:00Z"
                },
                error: null
              }
      };
    }
  });

  const saved = await api.savePlanToSupabase({
    id: "stale-plan-id",
    role_type: "leader",
    full_name: "Recovered Draft",
    status: "draft",
    target_pi: 12,
    target_sales: 4000,
    info_fields: {},
    checklist: [],
    week_entries: [],
    consolidation_entries: []
  });

  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].id, "stale-plan-id");
  assert.equal(payloads[1].id, null);
  assert.equal(saved.id, "new-plan-id");
  assert.equal(saved.status, "draft");
});

test("plan API loads a saved plan with normalized week and consolidation entries", async () => {
  const api = loadPlanApiWithClient({
    from(tableName) {
      if (tableName === "plans") {
        return makeTableQuery({
          data: {
            id: "plan-7",
            user_id: "user-1",
            parent_plan_id: null,
            owner_role: "leader",
            role_type: "leader",
            status: "submitted",
            full_name: "Leader Plan",
            start_date: "2026-04-05",
            calendar_start_date: "2026-04-05",
            target_pi: 14,
            target_sales: 12000,
            info: { full_name: "Leader Plan" },
            checklist: ["invite_daily"],
            review_notes: "",
            reviewed_at: null,
            reviewed_by: null,
            created_at: "2026-04-17T07:00:00Z",
            updated_at: "2026-04-17T08:00:00Z"
          },
          error: null
        });
      }

      if (tableName === "plan_week_entries") {
        return makeTableQuery({
          data: [
            {
              week_number: 1,
              activity_name: "Presentation",
              activity_date: "2026-04-06",
              leads: "3",
              attendees: "2",
              pay_ins: "1",
              sales: "1500",
              extra: { venue: "HQ" }
            }
          ],
          error: null
        });
      }

      if (tableName === "plan_consolidation_entries") {
        return makeTableQuery({
          data: [
            {
              name: "Member A",
              role_label: "Member",
              leads: "8",
              att: "4",
              pi: "2",
              sales: "3000",
              evt: "1",
              pi_target: "3"
            }
          ],
          error: null
        });
      }

      throw new Error(`Unexpected table ${tableName}`);
    }
  });

  const loaded = await api.loadPlanFromSupabase("plan-7");

  assert.equal(loaded.id, "plan-7");
  assert.equal(loaded.week_entries.length, 1);
  assert.equal(loaded.week_entries[0].leads, 3);
  assert.equal(loaded.week_entries[0].sales, 1500);
  assert.deepEqual(loaded.week_entries[0].extra, { venue: "HQ" });
  assert.equal(loaded.consolidation_entries.length, 1);
  assert.equal(loaded.consolidation_entries[0].pi_target, 3);
});

test("access gating helper returns the expected pending, rejected, and verification messages", () => {
  const source = read("gutguard-app.js");
  const extracted = [
    "isCurrentUserVerified",
    "isCurrentUserActive",
    "getCurrentUserApprovalStatus",
    "getCurrentUserAccessMessage"
  ]
    .map((name) => extractFunction(source, name))
    .join("\n");

  const context = {
    currentUser: null,
    currentUserProfile: null
  };

  vm.runInNewContext(extracted, context);

  context.currentUser = { email_confirmed_at: null };
  context.currentUserProfile = { is_active: true, approval_status: "approved" };
  assert.match(
    context.getCurrentUserAccessMessage("browse saved plans"),
    /Verify your email first/
  );

  context.currentUser = { email_confirmed_at: "2026-04-17T00:00:00Z" };
  context.currentUserProfile = { is_active: true, approval_status: "pending" };
  assert.match(
    context.getCurrentUserAccessMessage("browse saved plans"),
    /waiting for admin approval/
  );

  context.currentUserProfile = { is_active: true, approval_status: "rejected" };
  assert.match(
    context.getCurrentUserAccessMessage("browse saved plans"),
    /has been rejected/
  );
});

test("admin approval timestamp helper explains approved records with missing timestamps", () => {
  const source = read("gutguard-app.js");
  const extracted = extractFunction(source, "formatSavedAt") + "\n" + extractFunction(source, "getApprovedAtDisplay");
  const context = {};

  vm.runInNewContext(extracted, context);

  assert.equal(
    context.getApprovedAtDisplay({
      approval_status: "approved",
      approved_at: null
    }),
    "Approved status set, timestamp missing"
  );
  assert.equal(
    context.getApprovedAtDisplay({
      approval_status: "pending",
      approved_at: null
    }),
    "Not approved yet"
  );
});
