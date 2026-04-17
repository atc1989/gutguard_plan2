(function () {
  function getClientOrThrow() {
    if (!window.GutguardSupabase || !window.GutguardSupabase.isConfigured()) {
      throw new Error("Supabase is not configured.");
    }

    var client = window.GutguardSupabase.getClient();
    if (!client) {
      throw new Error("Supabase client is unavailable.");
    }

    return client;
  }

  async function getUserOrThrow() {
    if (!window.GutguardSupabase || !window.GutguardSupabase.getUser) {
      throw new Error("Supabase auth helpers are unavailable.");
    }

    var user = await window.GutguardSupabase.getUser();
    if (!user) {
      throw new Error("Please sign in before loading or saving plans.");
    }

    return user;
  }

  function normalizePlanRow(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      parent_plan_id: row.parent_plan_id,
      owner_role: row.owner_role,
      role_type: row.role_type,
      status: row.status,
      full_name: row.full_name,
      start_date: row.start_date,
      calendar_start_date: row.calendar_start_date,
      target_pi: Number(row.target_pi || 0),
      target_sales: Number(row.target_sales || 0),
      info_fields: row.info || {},
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      review_notes: row.review_notes || "",
      reviewed_at: row.reviewed_at || null,
      reviewed_by: row.reviewed_by || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function normalizeProfileRow(row) {
    if (!row) {
      return null;
    }

    return {
      user_id: row.user_id,
      email: row.email || "",
      display_name: row.display_name || "",
      role_type: row.role_type || "member",
      is_admin: row.is_admin === true,
      is_active: row.is_active !== false,
      approval_status: row.approval_status || "approved",
      notes: row.notes || "",
      approved_at: row.approved_at || null,
      approved_by: row.approved_by || null,
      approved_by_email: row.approved_by_email || "",
      approved_by_display_name: row.approved_by_display_name || "",
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      latest_plan_id: row.latest_plan_id || null,
      latest_plan_status: row.latest_plan_status || null,
      latest_plan_updated_at: row.latest_plan_updated_at || null
    };
  }

  function normalizeDirectoryRow(row) {
    if (!row) {
      return null;
    }

    return {
      user_id: row.user_id,
      email: row.email || "",
      display_name: row.display_name || "",
      role_type: row.role_type || "member",
      latest_plan_id: row.latest_plan_id || null,
      latest_plan_status: row.latest_plan_status || null,
      latest_plan_updated_at: row.latest_plan_updated_at || null,
      can_link_as_parent: row.can_link_as_parent === true
    };
  }

  function getRolePriority(roleType) {
    return {
      member: 1,
      leader: 2,
      squad: 3,
      platoon: 4,
      o1: 5
    }[roleType] || 0;
  }

  function summarizeChildPlan(plan, weekRows) {
    var totals = { leads: 0, attendees: 0, pay_ins: 0, sales: 0 };
    (weekRows || []).forEach(function (row) {
      totals.leads += Number(row.leads || 0);
      totals.attendees += Number(row.attendees || 0);
      totals.pay_ins += Number(row.pay_ins || 0);
      totals.sales += Number(row.sales || 0);
    });

    return {
      id: plan.id,
      parent_plan_id: plan.parent_plan_id,
      role_type: plan.role_type,
      full_name: plan.full_name,
      target_pi: Number(plan.target_pi || 0),
      target_sales: Number(plan.target_sales || 0),
      totals: totals,
      updated_at: plan.updated_at,
      created_at: plan.created_at
    };
  }

  async function listPlans(roleType) {
    var client = getClientOrThrow();
    var user = await getUserOrThrow();

    var query = client
      .from("plans")
      .select("id, role_type, full_name, status, updated_at, created_at, parent_plan_id, owner_role, review_notes, reviewed_at, reviewed_by")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (roleType) {
      query = query.eq("role_type", roleType);
    }

    var result = await query;
    if (result.error && result.error.message && result.error.message.indexOf("parent_plan_id") !== -1) {
      var retryQuery = client
        .from("plans")
        .select("id, role_type, full_name, status, updated_at, created_at, owner_role, review_notes, reviewed_at, reviewed_by")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (roleType) {
        retryQuery = retryQuery.eq("role_type", roleType);
      }
      result = await retryQuery;
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data || []).map(function (row) {
      return {
        id: row.id,
        role_type: row.role_type,
        full_name: row.full_name,
        status: row.status,
        updated_at: row.updated_at,
        created_at: row.created_at,
        parent_plan_id: row.parent_plan_id,
        owner_role: row.owner_role,
        review_notes: row.review_notes || "",
        reviewed_at: row.reviewed_at || null,
        reviewed_by: row.reviewed_by || null
      };
    });
  }

  async function listReviewQueue() {
    var client = getClientOrThrow();
    var user = await getUserOrThrow();

    var result = await client
      .from("plans")
      .select("id, user_id, role_type, full_name, status, updated_at, created_at, parent_plan_id, owner_role, review_notes, reviewed_at, reviewed_by")
      .neq("user_id", user.id)
      .in("status", ["submitted", "needs_revision"])
      .order("updated_at", { ascending: false });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data || []).map(normalizePlanRow);
  }

  async function getMyProfile() {
    var client = getClientOrThrow();
    var user = await getUserOrThrow();

    var result = await client
      .from("user_profiles")
      .select("user_id, email, display_name, role_type, is_admin, is_active, approval_status, notes, approved_at, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return normalizeProfileRow(result.data);
  }

  async function inferMyRoleHint() {
    var client = getClientOrThrow();
    var user = await getUserOrThrow();
    var candidates = [];

    try {
      var planResult = await client
        .from("plans")
        .select("role_type")
        .eq("user_id", user.id);

      if (!planResult.error) {
        (planResult.data || []).forEach(function (row) {
          if (row && row.role_type) {
            candidates.push(String(row.role_type));
          }
        });
      }
    } catch (error) {}

    if (user.email) {
      try {
        var directoryResult = await client
          .from("hierarchy_link_directory")
          .select("role_type")
          .eq("active", true)
          .ilike("email", user.email);

        if (!directoryResult.error) {
          (directoryResult.data || []).forEach(function (row) {
            if (row && row.role_type) {
              candidates.push(String(row.role_type));
            }
          });
        }
      } catch (error) {}
    }

    return candidates.reduce(function (bestRole, roleType) {
      if (getRolePriority(roleType) > getRolePriority(bestRole)) {
        return roleType;
      }
      return bestRole;
    }, "");
  }

  async function syncMyProfile(profile) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client
      .rpc("sync_my_profile", {
        profile_payload: profile || {}
      })
      .single();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return normalizeProfileRow(result.data);
  }

  async function listPotentialParents(roleType) {
    var parentRoleMap = {
      member: "leader",
      leader: "squad",
      squad: "platoon",
      platoon: "o1"
    };
    var parentRole = parentRoleMap[roleType];
    if (!parentRole) {
      return [];
    }

    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client.rpc("list_potential_parent_plans", {
      child_role_type: roleType
    });

    if (result.error) {
      if (result.error.message && result.error.message.indexOf("parent_plan_id") !== -1) {
        return [];
      }
      throw new Error(result.error.message);
    }

    return (result.data || []).map(function (row) {
      return {
        id: row.id,
        role_type: row.role_type,
        full_name: row.full_name,
        status: row.status,
        updated_at: row.updated_at,
        created_at: row.created_at,
        parent_plan_id: row.parent_plan_id,
        owner_role: row.owner_role
      };
    });
  }

  async function listChildPlans(parentPlanId) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var plansResult = await client
      .from("plans")
      .select("id, parent_plan_id, role_type, full_name, target_pi, target_sales, updated_at, created_at")
      .eq("parent_plan_id", parentPlanId)
      .order("updated_at", { ascending: false });

    if (plansResult.error) {
      if (plansResult.error.message && plansResult.error.message.indexOf("parent_plan_id") !== -1) {
        return [];
      }
      throw new Error(plansResult.error.message);
    }

    var childPlans = plansResult.data || [];
    if (!childPlans.length) {
      return [];
    }

    var ids = childPlans.map(function (plan) { return plan.id; });
    var weekResult = await client
      .from("plan_week_entries")
      .select("plan_id, leads, attendees, pay_ins, sales")
      .in("plan_id", ids);

    if (weekResult.error) {
      throw new Error(weekResult.error.message);
    }

    var weeksByPlan = {};
    (weekResult.data || []).forEach(function (row) {
      if (!weeksByPlan[row.plan_id]) {
        weeksByPlan[row.plan_id] = [];
      }
      weeksByPlan[row.plan_id].push(row);
    });

    return childPlans.map(function (plan) {
      return summarizeChildPlan(plan, weeksByPlan[plan.id] || []);
    });
  }

  async function getDashboardSummary() {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client.rpc("get_planner_dashboard");
    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.data || {};
  }

  async function listPlanActivity(limitCount) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client.rpc("list_plan_activity", {
      limit_count: limitCount || 12
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data || []).map(function (row) {
      return {
        id: row.id,
        created_at: row.created_at,
        action: row.action,
        plan_id: row.plan_id,
        plan_role_type: row.plan_role_type,
        plan_full_name: row.plan_full_name,
        status_before: row.status_before,
        status_after: row.status_after,
        actor_name: row.actor_name,
        actor_email: row.actor_email,
        detail: row.detail
      };
    });
  }

  async function listUserProfiles() {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client.rpc("list_user_profiles");
    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data || []).map(normalizeProfileRow);
  }

  async function listDirectoryProfiles() {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client.rpc("list_directory_profiles");
    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data || []).map(normalizeDirectoryRow);
  }

  async function adminUpdateUserProfile(userId, profile) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client
      .rpc("admin_update_user_profile", {
        target_user_id: userId,
        profile_payload: profile || {}
      })
      .single();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return normalizeProfileRow(result.data);
  }

  async function savePlanToSupabase(plan) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    async function runSave(payload) {
      return client
        .rpc("save_plan_bundle", {
          plan_payload: payload
        })
        .single();
    }

    var payload = {
      id: plan.id || null,
      parent_plan_id: plan.parent_plan_id || null,
      owner_role: plan.owner_role || plan.role_type,
      role_type: plan.role_type,
      full_name: plan.full_name || "",
      start_date: plan.start_date || null,
      calendar_start_date: plan.calendar_start_date || null,
      target_pi: plan.target_pi || 0,
      target_sales: plan.target_sales || 0,
      info_fields: plan.info_fields || {},
      checklist: plan.checklist || [],
      status: plan.status || "submitted",
      week_entries: plan.week_entries || [],
      consolidation_entries: plan.consolidation_entries || []
    };

    var result = await runSave(payload);

    if (result.error && payload.id && /Plan not found or not editable/i.test(result.error.message || "")) {
      payload.id = null;
      result = await runSave(payload);
    }

    if (result.error) {
      throw new Error(result.error.message);
    }

    return normalizePlanRow(result.data);
  }

  async function loadPlanFromSupabase(planId) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var planResult = await client
      .from("plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (planResult.error) {
      throw new Error(planResult.error.message);
    }
    if (!planResult.data) {
      throw new Error("Saved plan not found in Supabase.");
    }

    var weekResult = await client
      .from("plan_week_entries")
      .select("*")
      .eq("plan_id", planId)
      .order("week_number", { ascending: true })
      .order("activity_name", { ascending: true });
    if (weekResult.error) {
      throw new Error(weekResult.error.message);
    }

    var consolidationResult = await client
      .from("plan_consolidation_entries")
      .select("*")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true });
    if (consolidationResult.error) {
      throw new Error(consolidationResult.error.message);
    }

    var plan = normalizePlanRow(planResult.data);
    plan.week_entries = (weekResult.data || []).map(function (row) {
      return {
        week_number: row.week_number,
        activity_name: row.activity_name,
        activity_date: row.activity_date,
        leads: Number(row.leads || 0),
        attendees: Number(row.attendees || 0),
        pay_ins: Number(row.pay_ins || 0),
        sales: Number(row.sales || 0),
        extra: row.extra || {}
      };
    });
    plan.consolidation_entries = (consolidationResult.data || []).map(function (row) {
      return {
        name: row.name,
        role_label: row.role_label,
        leads: Number(row.leads || 0),
        att: Number(row.att || 0),
        pi: Number(row.pi || 0),
        sales: Number(row.sales || 0),
        evt: Number(row.evt || 0),
        pi_target: Number(row.pi_target || 0)
      };
    });

    return plan;
  }

  async function deletePlanFromSupabase(planId) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client
      .from("plans")
      .delete()
      .eq("id", planId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return true;
  }

  async function reviewPlanInSupabase(planId, nextStatus, reviewNote) {
    var client = getClientOrThrow();
    await getUserOrThrow();

    var result = await client
      .rpc("review_plan", {
        target_plan_id: planId,
        next_status: nextStatus,
        review_note: reviewNote || null
      })
      .single();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return normalizePlanRow(result.data);
  }

  window.GutguardPlanApi = {
    isConfigured: function () {
      return !!(window.GutguardSupabase && window.GutguardSupabase.isConfigured());
    },
    listPlans: listPlans,
    listReviewQueue: listReviewQueue,
    getMyProfile: getMyProfile,
    inferMyRoleHint: inferMyRoleHint,
    syncMyProfile: syncMyProfile,
    listPotentialParents: listPotentialParents,
    listChildPlans: listChildPlans,
    getDashboardSummary: getDashboardSummary,
    listPlanActivity: listPlanActivity,
    listUserProfiles: listUserProfiles,
    listDirectoryProfiles: listDirectoryProfiles,
    adminUpdateUserProfile: adminUpdateUserProfile,
    savePlanToSupabase: savePlanToSupabase,
    loadPlanFromSupabase: loadPlanFromSupabase,
    deletePlanFromSupabase: deletePlanFromSupabase,
    reviewPlanInSupabase: reviewPlanInSupabase
  };
})();
