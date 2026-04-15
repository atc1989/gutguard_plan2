(function () {
  var STORAGE_KEY = "gutguard.supabase.planRefs";
  var DRAFT_STORAGE_KEY = "gutguard.localDrafts.v1";
  var PARENT_ROLE = {
    member: "leader",
    leader: "squad",
    squad: "platoon",
    platoon: "o1",
    o1: null
  };

  function toNumber(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeEmpty(value) {
    return value === "" ? null : value;
  }

  function getStoredRefs() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveStoredRefs(refs) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(refs));
  }

  function getStoredDrafts() {
    try {
      return JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function saveStoredDrafts(drafts) {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }

  function normalizeScope(scopeId) {
    return scopeId || "guest";
  }

  function getStoredPlanRef(roleType, scopeId) {
    var refs = getStoredRefs();
    var scope = refs[normalizeScope(scopeId)] || {};
    return scope[roleType] || null;
  }

  function rememberPlanRef(roleType, savedPlan, scopeId) {
    var refs = getStoredRefs();
    var scopeKey = normalizeScope(scopeId);
    if (!refs[scopeKey]) {
      refs[scopeKey] = {};
    }
    refs[scopeKey][roleType] = {
      planId: savedPlan.id,
      fullName: savedPlan.full_name || "",
      updatedAt: savedPlan.updated_at || savedPlan.created_at || null
    };
    saveStoredRefs(refs);
  }

  function clearStoredPlanRef(roleType, scopeId) {
    var refs = getStoredRefs();
    var scopeKey = normalizeScope(scopeId);
    if (!refs[scopeKey] || !refs[scopeKey][roleType]) {
      return;
    }
    delete refs[scopeKey][roleType];
    if (!Object.keys(refs[scopeKey]).length) {
      delete refs[scopeKey];
    }
    saveStoredRefs(refs);
  }

  function getLocalDraft(roleType, scopeId) {
    var drafts = getStoredDrafts();
    var scope = drafts[normalizeScope(scopeId)] || {};
    return scope[roleType] || null;
  }

  function saveLocalDraft(roleType, plan, meta, scopeId) {
    var drafts = getStoredDrafts();
    var scopeKey = normalizeScope(scopeId);
    if (!drafts[scopeKey]) {
      drafts[scopeKey] = {};
    }

    drafts[scopeKey][roleType] = {
      role_type: roleType,
      saved_at: new Date().toISOString(),
      meta: {
        planId: meta && meta.planId ? meta.planId : null,
        status: plan && plan.status ? plan.status : (meta && meta.status ? meta.status : "draft"),
        lastSavedAt: meta && meta.lastSavedAt ? meta.lastSavedAt : null
      },
      plan: plan
    };

    saveStoredDrafts(drafts);
    return drafts[scopeKey][roleType];
  }

  function clearLocalDraft(roleType, scopeId) {
    var drafts = getStoredDrafts();
    var scopeKey = normalizeScope(scopeId);
    if (!drafts[scopeKey] || !drafts[scopeKey][roleType]) {
      return;
    }

    delete drafts[scopeKey][roleType];
    if (!Object.keys(drafts[scopeKey]).length) {
      delete drafts[scopeKey];
    }
    saveStoredDrafts(drafts);
  }

  function readInfoFields() {
    var root = document.getElementById("forminner");
    var info = {};
    if (!root) {
      return info;
    }

    root.querySelectorAll("[data-plan-field]").forEach(function (el) {
      var key = el.getAttribute("data-plan-field");
      info[key] = el.value;
    });

    return info;
  }

  function writeInfoFields(info) {
    var root = document.getElementById("forminner");
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-plan-field]").forEach(function (el) {
      var key = el.getAttribute("data-plan-field");
      el.value = info && info[key] != null ? info[key] : "";
    });
  }

  function readChecklist(type) {
    if (type !== "member") {
      return [];
    }

    var root = document.getElementById("forminner");
    if (!root) {
      return [];
    }

    return Array.from(root.querySelectorAll("[data-check-key].checked")).map(function (el) {
      return el.getAttribute("data-check-key");
    });
  }

  function writeChecklist(type, checklist) {
    if (type !== "member") {
      return;
    }

    var keys = new Set(Array.isArray(checklist) ? checklist : []);
    var root = document.getElementById("forminner");
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-check-key]").forEach(function (el) {
      var key = el.getAttribute("data-check-key");
      el.classList.toggle("checked", keys.has(key));
    });
  }

  function collectWeekEntries(type) {
    var roleWeeks = (window.wkData && window.wkData[type]) || {};
    var extraCols = (window.EXTRA_COLS && window.EXTRA_COLS[type]) || [];
    var rows = [];

    Object.keys(roleWeeks).forEach(function (weekKey) {
      var weekNumber = Number(weekKey);
      var weekRows = roleWeeks[weekKey] || {};

      Object.keys(weekRows).forEach(function (activityName) {
        var row = weekRows[activityName] || {};
        var extra = {};
        extraCols.forEach(function (col) {
          if (row[col.key]) {
            extra[col.key] = row[col.key];
          }
        });

        var hasContent =
          row.date ||
          toNumber(row.leads) ||
          toNumber(row.att) ||
          toNumber(row.pi) ||
          toNumber(row.sales) ||
          Object.keys(extra).length > 0;

        if (!hasContent) {
          return;
        }

        rows.push({
          week_number: weekNumber,
          activity_name: activityName,
          activity_date: normalizeEmpty(row.date || ""),
          leads: toNumber(row.leads),
          attendees: toNumber(row.att),
          pay_ins: toNumber(row.pi),
          sales: toNumber(row.sales),
          extra: extra
        });
      });
    });

    rows.sort(function (a, b) {
      if (a.week_number !== b.week_number) {
        return a.week_number - b.week_number;
      }
      return a.activity_name.localeCompare(b.activity_name);
    });

    return rows;
  }

  function writeWeekEntries(type, entries) {
    var nextWeeks = {};

    (entries || []).forEach(function (entry) {
      var weekNumber = Number(entry.week_number);
      if (!nextWeeks[weekNumber]) {
        nextWeeks[weekNumber] = {};
      }

      nextWeeks[weekNumber][entry.activity_name] = {
        leads: entry.leads ? String(entry.leads) : "",
        att: entry.attendees ? String(entry.attendees) : "",
        pi: entry.pay_ins ? String(entry.pay_ins) : "",
        sales: entry.sales ? String(entry.sales) : "",
        date: entry.activity_date || ""
      };

      Object.keys(entry.extra || {}).forEach(function (key) {
        nextWeeks[weekNumber][entry.activity_name][key] = entry.extra[key];
      });
    });

    window.wkData[type] = nextWeeks;
  }

  function collectConsolidationEntries(type) {
    return ((window.subMembers && window.subMembers[type]) || []).map(function (member) {
      return {
        name: member.name || "",
        role_label: member.role || (window.SUB_ROLES && window.SUB_ROLES[type]) || "",
        leads: toNumber(member.leads),
        att: toNumber(member.att),
        pi: toNumber(member.pi),
        sales: toNumber(member.sales),
        evt: toNumber(member.evt),
        pi_target: toNumber(member.piTarget)
      };
    });
  }

  function writeConsolidationEntries(type, entries) {
    window.subMembers[type] = (entries || []).map(function (entry) {
      return {
        name: entry.name || "",
        role: entry.role_label || "",
        leads: toNumber(entry.leads),
        att: toNumber(entry.att),
        pi: toNumber(entry.pi),
        sales: toNumber(entry.sales),
        evt: toNumber(entry.evt),
        piTarget: toNumber(entry.pi_target || entry.pi)
      };
    });
  }

  function collectPlanData(type, meta) {
    var info = readInfoFields();
    var targetPiEl = document.getElementById(type + "-tgt-pi");
    var targetSalesEl = document.getElementById(type + "-tgt-sales");
    var calendarStartEl = document.getElementById(type + "-cs");
    var parentSelectEl = document.getElementById(type + "-parent-plan-id");

    return {
      id: meta && meta.planId ? meta.planId : null,
      role_type: type,
      owner_role: type,
      parent_plan_id: parentSelectEl ? normalizeEmpty(parentSelectEl.value || "") : null,
      status: meta && meta.status ? meta.status : "submitted",
      full_name: (info.full_name || "").trim(),
      start_date: normalizeEmpty(info.start_date || ""),
      calendar_start_date: normalizeEmpty(calendarStartEl ? calendarStartEl.value : ""),
      target_pi: toNumber(targetPiEl ? targetPiEl.value : 0),
      target_sales: toNumber(targetSalesEl ? targetSalesEl.value : 0),
      info_fields: info,
      checklist: readChecklist(type),
      week_entries: collectWeekEntries(type),
      consolidation_entries: collectConsolidationEntries(type)
    };
  }

  function hasMeaningfulPlanData(plan) {
    if (!plan) {
      return false;
    }

    if (plan.full_name || plan.parent_plan_id || plan.target_pi || plan.target_sales) {
      return true;
    }

    if ((plan.checklist && plan.checklist.length) ||
        (plan.week_entries && plan.week_entries.length) ||
        (plan.consolidation_entries && plan.consolidation_entries.length)) {
      return true;
    }

    var info = plan.info_fields || {};
    return Object.keys(info).some(function (key) {
      if (key === "start_date") {
        return false;
      }
      return !!info[key];
    });
  }

  function validatePlanData(plan, options) {
    var mode = options && options.mode ? options.mode : (plan.status || "submitted");

    if (!plan.full_name) {
      throw new Error("Full name is required before saving.");
    }

    if (plan.target_pi < 0 || plan.target_sales < 0) {
      throw new Error("Targets cannot be negative.");
    }

    if (mode === "draft") {
      return;
    }

    if (!plan.calendar_start_date) {
      throw new Error("Calendar start date is required before submitting.");
    }

    if (!plan.target_pi && !plan.target_sales) {
      throw new Error("Set a pay-in target or sales target before submitting.");
    }

    if (PARENT_ROLE[plan.role_type] && !plan.parent_plan_id) {
      throw new Error("Select a parent plan before submitting.");
    }

    if (!plan.week_entries || !plan.week_entries.length) {
      throw new Error("Add at least one weekly planner entry before submitting.");
    }
  }

  function hydratePlanData(type, plan) {
    writeInfoFields(plan.info_fields || {});
    writeChecklist(type, plan.checklist || []);

    var targetPiEl = document.getElementById(type + "-tgt-pi");
    var targetSalesEl = document.getElementById(type + "-tgt-sales");
    var calendarStartEl = document.getElementById(type + "-cs");
    var parentSelectEl = document.getElementById(type + "-parent-plan-id");

    if (targetPiEl) {
      targetPiEl.value = plan.target_pi || "";
    }
    if (targetSalesEl) {
      targetSalesEl.value = plan.target_sales || "";
    }
    if (calendarStartEl) {
      calendarStartEl.value = plan.calendar_start_date || "";
    }
    if (parentSelectEl) {
      parentSelectEl.value = plan.parent_plan_id || "";
    }

    if (window.targets && window.targets[type]) {
      window.targets[type] = {
        pi: toNumber(plan.target_pi),
        sales: toNumber(plan.target_sales)
      };
    }

    writeWeekEntries(type, plan.week_entries || []);
    writeConsolidationEntries(type, plan.consolidation_entries || []);
    window.calEvts[type] = {};
    window.curWeek = 1;

    if (typeof window.renderPlanner === "function") {
      window.renderPlanner(type);
    }
    if (typeof window.renderSummaryTbl === "function") {
      window.renderSummaryTbl(type);
    }
    if (typeof window.renderCal === "function") {
      window.renderCal(type);
    }
    if (typeof window.calcAllTotals === "function") {
      window.calcAllTotals(type);
    }
    if (typeof window.computeProjections === "function") {
      window.computeProjections(type);
    }
    if (typeof window.updateDots === "function") {
      window.updateDots(type);
    }
    if (typeof window.renderConsolidation === "function") {
      window.renderConsolidation(type);
    }
  }

  window.GutguardPlanModel = {
    collectPlanData: collectPlanData,
    hasMeaningfulPlanData: hasMeaningfulPlanData,
    validatePlanData: validatePlanData,
    hydratePlanData: hydratePlanData,
    getStoredPlanRef: getStoredPlanRef,
    rememberPlanRef: rememberPlanRef,
    clearStoredPlanRef: clearStoredPlanRef,
    getLocalDraft: getLocalDraft,
    saveLocalDraft: saveLocalDraft,
    clearLocalDraft: clearLocalDraft
  };
})();
