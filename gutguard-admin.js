(function () {
  function buildStatusPill(text, tone) {
    var pill = document.createElement("span");
    pill.className = "admin-status-pill is-" + getStatusTone(tone);
    pill.textContent = text;
    return pill;
  }

  function buildAdminMetaItem(label, value) {
    var item = document.createElement("div");
    item.className = "admin-profile-meta-item";
    var itemLabel = document.createElement("div");
    itemLabel.className = "admin-profile-meta-label";
    itemLabel.textContent = label;
    var itemValue = document.createElement("div");
    itemValue.className = "admin-profile-meta-value";
    itemValue.textContent = value;
    item.appendChild(itemLabel);
    item.appendChild(itemValue);
    return item;
  }

  function buildAdminProfileCard(profile) {
    var card = document.createElement("div");
    card.className = "admin-profile-card";
    card.dataset.userId = profile.user_id;

    var top = document.createElement("div");
    top.className = "admin-profile-top";
    var info = document.createElement("div");
    var name = document.createElement("div");
    name.className = "admin-profile-name";
    name.textContent = profile.display_name || "(No Name)";
    info.appendChild(name);
    var email = document.createElement("div");
    email.className = "admin-profile-email";
    email.textContent = profile.email || "";
    info.appendChild(email);
    top.appendChild(info);
    var badge = document.createElement("div");
    badge.className = "admin-profile-badge";
    badge.textContent = getRoleLabel(profile.role_type);
    top.appendChild(badge);
    card.appendChild(top);

    var statusRow = document.createElement("div");
    statusRow.className = "admin-profile-status-row";
    statusRow.appendChild(buildStatusPill(getApprovalLabel(profile.approval_status), getApprovalTone(profile.approval_status)));
    statusRow.appendChild(buildStatusPill(profile.is_active === false ? "Inactive" : "Active", profile.is_active === false ? "warn" : "success"));
    statusRow.appendChild(buildStatusPill(profile.is_admin === true ? "Admin Access" : "Standard Access", profile.is_admin === true ? "info" : "loading"));
    if ((profile.approval_status || "") === "approved" && !profile.approved_at) {
      statusRow.appendChild(buildStatusPill("Approval Timestamp Missing", "warn"));
    }
    if (profile.latest_plan_status) {
      statusRow.appendChild(buildStatusPill("Latest Plan: " + String(profile.latest_plan_status).replace(/_/g, " "), profile.latest_plan_status === "approved" ? "success" : (profile.latest_plan_status === "needs_revision" ? "warn" : "info")));
    } else {
      statusRow.appendChild(buildStatusPill("No Saved Plan", "warn"));
    }
    card.appendChild(statusRow);

    var metaRow = document.createElement("div");
    metaRow.className = "admin-profile-meta-row";
    metaRow.appendChild(buildAdminMetaItem("Signed Up", profile.created_at ? formatSavedAt(profile.created_at) : "Unknown"));
    metaRow.appendChild(buildAdminMetaItem("Last Updated", profile.updated_at ? formatSavedAt(profile.updated_at) : "No recent update"));
    metaRow.appendChild(buildAdminMetaItem("Approved At", getApprovedAtDisplay(profile)));
    metaRow.appendChild(buildAdminMetaItem("Approved By", profile.approved_by_display_name || profile.approved_by_email || ((profile.approval_status || "") === "approved" ? "Recorded in audit log" : "Not approved yet")));
    metaRow.appendChild(buildAdminMetaItem("Latest Plan", profile.latest_plan_updated_at ? formatSavedAt(profile.latest_plan_updated_at) : "No plan activity yet"));
    card.appendChild(metaRow);

    var grid = document.createElement("div");
    grid.className = "admin-profile-grid";

    var displayField = document.createElement("div");
    displayField.className = "admin-profile-field";
    var displayLabel = document.createElement("label");
    displayLabel.textContent = "Display Name";
    var displayInput = document.createElement("input");
    displayInput.type = "text";
    displayInput.value = profile.display_name || "";
    displayInput.id = "admin-display-name-" + profile.user_id;
    displayField.appendChild(displayLabel);
    displayField.appendChild(displayInput);
    grid.appendChild(displayField);

    var roleField = document.createElement("div");
    roleField.className = "admin-profile-field";
    var roleLabel = document.createElement("label");
    roleLabel.textContent = "Role";
    var roleSelect = document.createElement("select");
    roleSelect.id = "admin-role-type-" + profile.user_id;
    ["member", "leader", "squad", "platoon", "o1"].forEach(function (roleType) {
      var option = document.createElement("option");
      option.value = roleType;
      option.textContent = getRoleLabel(roleType);
      option.selected = profile.role_type === roleType;
      roleSelect.appendChild(option);
    });
    roleField.appendChild(roleLabel);
    roleField.appendChild(roleSelect);
    grid.appendChild(roleField);

    var activeField = document.createElement("div");
    activeField.className = "admin-profile-field";
    var activeLabel = document.createElement("label");
    activeLabel.textContent = "Active";
    var activeSelect = document.createElement("select");
    activeSelect.id = "admin-active-" + profile.user_id;
    ["true", "false"].forEach(function (flag) {
      var option = document.createElement("option");
      option.value = flag;
      option.textContent = flag === "true" ? "Active" : "Inactive";
      option.selected = String(profile.is_active) !== "false" ? flag === "true" : flag === "false";
      activeSelect.appendChild(option);
    });
    activeField.appendChild(activeLabel);
    activeField.appendChild(activeSelect);
    grid.appendChild(activeField);

    var approvalField = document.createElement("div");
    approvalField.className = "admin-profile-field";
    var approvalLabel = document.createElement("label");
    approvalLabel.textContent = "Approval";
    var approvalSelect = document.createElement("select");
    approvalSelect.id = "admin-approval-" + profile.user_id;
    ["pending", "approved", "rejected"].forEach(function (status) {
      var option = document.createElement("option");
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      option.selected = (profile.approval_status || "approved") === status;
      approvalSelect.appendChild(option);
    });
    approvalField.appendChild(approvalLabel);
    approvalField.appendChild(approvalSelect);
    grid.appendChild(approvalField);

    var adminField = document.createElement("div");
    adminField.className = "admin-profile-field";
    var adminLabel = document.createElement("label");
    adminLabel.textContent = "Admin Access";
    var adminSelect = document.createElement("select");
    adminSelect.id = "admin-is-admin-" + profile.user_id;
    ["false", "true"].forEach(function (flag) {
      var option = document.createElement("option");
      option.value = flag;
      option.textContent = flag === "true" ? "Admin" : "Standard";
      option.selected = profile.is_admin === true ? flag === "true" : flag === "false";
      adminSelect.appendChild(option);
    });
    adminField.appendChild(adminLabel);
    adminField.appendChild(adminSelect);
    grid.appendChild(adminField);

    var summaryField = document.createElement("div");
    summaryField.className = "admin-profile-field admin-profile-field-wide";
    var summaryLabel = document.createElement("label");
    summaryLabel.textContent = "Change Summary";
    var summaryInput = document.createElement("input");
    summaryInput.type = "text";
    summaryInput.id = "admin-change-summary-" + profile.user_id;
    summaryInput.placeholder = "Explain role, approval, or access changes before saving";
    summaryField.appendChild(summaryLabel);
    summaryField.appendChild(summaryInput);
    grid.appendChild(summaryField);

    var notesField = document.createElement("div");
    notesField.className = "admin-profile-field admin-profile-field-wide";
    var notesLabel = document.createElement("label");
    notesLabel.textContent = "Notes";
    var notesInput = document.createElement("textarea");
    notesInput.id = "admin-notes-" + profile.user_id;
    notesInput.value = profile.notes || "";
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesInput);
    grid.appendChild(notesField);

    card.appendChild(grid);

    var feedback = document.createElement("div");
    feedback.className = "admin-profile-feedback";
    feedback.id = "admin-feedback-" + profile.user_id;
    var feedbackState = getAdminProfileFeedback(profile.user_id);
    if (feedbackState && feedbackState.message) {
      feedback.classList.add("is-" + feedbackState.tone);
      var feedbackTitle = document.createElement("div");
      feedbackTitle.className = "admin-profile-feedback-title";
      feedbackTitle.textContent = feedbackState.message;
      feedback.appendChild(feedbackTitle);
      if (feedbackState.detail) {
        var feedbackDetail = document.createElement("div");
        feedbackDetail.className = "admin-profile-feedback-detail";
        feedbackDetail.textContent = feedbackState.detail;
        feedback.appendChild(feedbackDetail);
      }
    } else {
      feedback.style.display = "none";
    }
    card.appendChild(feedback);

    var actions = document.createElement("div");
    actions.className = "admin-profile-actions";
    var saveBtn = document.createElement("button");
    saveBtn.className = "btn btp";
    saveBtn.type = "button";
    saveBtn.textContent = "Save Changes";
    saveBtn.addEventListener("click", function () {
      saveAdminProfile(profile.user_id);
    });
    actions.appendChild(saveBtn);
    if ((profile.approval_status || "") === "pending") {
      var approveBtn = document.createElement("button");
      approveBtn.className = "btn btn-success-lite";
      approveBtn.type = "button";
      approveBtn.textContent = "Approve Now";
      approveBtn.addEventListener("click", function () {
        setAdminApprovalValue(profile.user_id, "approved");
        saveAdminProfile(profile.user_id, { intent: "approve" });
      });
      actions.appendChild(approveBtn);

      var rejectBtn = document.createElement("button");
      rejectBtn.className = "btn btn-danger-lite";
      rejectBtn.type = "button";
      rejectBtn.textContent = "Reject Now";
      rejectBtn.addEventListener("click", function () {
        setAdminApprovalValue(profile.user_id, "rejected");
        saveAdminProfile(profile.user_id, { intent: "reject" });
      });
      actions.appendChild(rejectBtn);
    }
    if (profile.latest_plan_id) {
      var openBtn = document.createElement("button");
      openBtn.className = "btn bto";
      openBtn.type = "button";
      openBtn.textContent = "Open Latest Plan";
      openBtn.addEventListener("click", function () {
        openSavedPlan(profile.latest_plan_id, profile.role_type);
      });
      actions.appendChild(openBtn);
    }
    card.appendChild(actions);

    return card;
  }

  function filterAdminProfiles(profiles) {
    var searchEl = document.getElementById("admin-profiles-search");
    var roleEl = document.getElementById("admin-profiles-role");
    var approvalEl = document.getElementById("admin-profiles-approval");
    var adminEl = document.getElementById("admin-profiles-admin");
    var sortEl = document.getElementById("admin-profiles-sort");
    var searchTerm = searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : "";
    var roleFilter = roleEl && roleEl.value ? roleEl.value : "";
    var approvalFilter = approvalEl && approvalEl.value ? approvalEl.value : "";
    var adminFilter = adminEl && adminEl.value ? adminEl.value : "";
    var filtered = (profiles || []).filter(function (profile) {
      if (roleFilter && profile.role_type !== roleFilter) return false;
      if (approvalFilter && (profile.approval_status || "") !== approvalFilter) return false;
      if (adminFilter === "admin" && profile.is_admin !== true) return false;
      if (adminFilter === "standard" && profile.is_admin === true) return false;
      if (!searchTerm) return true;
      var haystack = [
        profile.email || "",
        profile.display_name || "",
        profile.role_type || "",
        profile.approval_status || "",
        profile.is_admin ? "admin" : "",
        profile.notes || "",
        profile.approved_by_display_name || "",
        profile.approved_by_email || ""
      ].join(" ").toLowerCase();
      return haystack.indexOf(searchTerm) !== -1;
    });
    var sortMode = sortEl && sortEl.value ? sortEl.value : "name";
    filtered.sort(function (a, b) {
      if (sortMode === "newest") {
        return getTimeValue(b.created_at) - getTimeValue(a.created_at);
      }
      if (sortMode === "latest-plan") {
        return getTimeValue(b.latest_plan_updated_at) - getTimeValue(a.latest_plan_updated_at);
      }
      if (sortMode === "pending-first") {
        var aPending = (a.approval_status || "") === "pending" ? 0 : 1;
        var bPending = (b.approval_status || "") === "pending" ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
      }
      return String(a.display_name || a.email || "").localeCompare(String(b.display_name || b.email || ""));
    });
    return filtered;
  }

  async function renderAdminDirectory(forceRefresh) {
    var wrap = document.getElementById("admin-directory-wrap");
    var listEl = document.getElementById("admin-profiles-list");
    if (!wrap || !listEl) return;
    if (!currentUser || !isCurrentUserAdmin()) {
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "block";
    if (!(window.GutguardPlanApi && window.GutguardPlanApi.listUserProfiles)) {
      setSavedPlansMessage(listEl, "Admin directory helpers are unavailable.", "error", "Reload the page after the planner scripts finish loading.");
      return;
    }
    if (forceRefresh || !Array.isArray(adminProfilesCache.profiles)) {
      setSavedPlansMessage(listEl, "Loading admin directory...", "loading", "Pulling the latest account records and approval states from Supabase.");
    }
    try {
      var profiles = await fetchAdminProfiles(!!forceRefresh);
      var filteredProfiles = filterAdminProfiles(profiles);
      visibleAdminProfiles = filteredProfiles.slice();
      if (!filteredProfiles.length) {
        setSavedPlansMessage(
          listEl,
          profiles.length ? "No user profiles matched the current filter." : "No user profiles are available yet.",
          "info",
          profiles.length
            ? "Try clearing one of the admin filters or search terms."
            : "Ask users to sign up first, then verify their email so they can appear here for approval."
        );
        return;
      }
      clearNode(listEl);
      filteredProfiles.forEach(function (profile) {
        listEl.appendChild(buildAdminProfileCard(profile));
      });
    } catch (err) {
      reportClientIssue("renderAdminDirectory", err);
      setSavedPlansMessage(listEl, "Failed to load the admin directory.", "error", err && err.message ? err.message : "Unknown error.");
    }
  }

  async function saveAdminProfile(userId, options) {
    options = options || {};
    if (!(window.GutguardPlanApi && window.GutguardPlanApi.adminUpdateUserProfile)) {
      setAdminProfileFeedback(userId, "Admin profile helpers are unavailable.", "error", "Reload the page after the planner scripts finish loading.");
      updateAdminProfileFeedbackRegion(userId);
      showToast("Admin profile helpers are unavailable.", "error");
      return;
    }
    var previousProfile = (visibleAdminProfiles || []).find(function (profile) {
      return profile.user_id === userId;
    }) || null;
    var nextRoleType = document.getElementById("admin-role-type-" + userId).value;
    var nextIsAdmin = document.getElementById("admin-is-admin-" + userId).value === "true";
    var nextIsActive = document.getElementById("admin-active-" + userId).value === "true";
    var nextApprovalStatus = document.getElementById("admin-approval-" + userId).value;
    var changeSummaryEl = document.getElementById("admin-change-summary-" + userId);
    var changeSummary = changeSummaryEl && changeSummaryEl.value ? changeSummaryEl.value.trim() : "";
    var roleChanged = !!(previousProfile && previousProfile.role_type !== nextRoleType);
    var approvalChanged = !!(previousProfile && previousProfile.approval_status !== nextApprovalStatus);
    var adminChanged = !!(previousProfile && previousProfile.is_admin !== nextIsAdmin);
    var activeChanged = !!(previousProfile && previousProfile.is_active !== nextIsActive);
    if (roleChanged && !changeSummary) {
      setAdminProfileFeedback(userId, "Add a change summary before changing a role.", "warn", "Role changes affect saved plans, hierarchy linking, and review scope.");
      updateAdminProfileFeedbackRegion(userId);
      showToast("Add a change summary before changing a role.", "warn");
      return;
    }
    if (roleChanged && !confirm("Change this account role from " + getRoleLabel(previousProfile.role_type) + " to " + getRoleLabel(nextRoleType) + "? Existing saved plans stay on the account, but hierarchy expectations and draft ownership can shift.")) return;
    if (activeChanged && !confirm((nextIsActive ? "Reactivate " : "Deactivate ") + "this account now?")) return;
    if (adminChanged && !confirm((nextIsAdmin ? "Grant " : "Remove ") + "admin access for this account?")) return;
    if (options.intent === "reject" && !confirm("Reject this account now? The user will stay blocked until an admin changes the approval state again.")) return;
    if (options.intent === "approve" && !confirm("Approve this account now? The user will gain access after email verification and the next sign-in.")) return;
    setAdminProfileFeedback(userId, "Saving account changes...", "loading", "Writing the latest role, approval, and access settings to Supabase.");
    updateAdminProfileFeedbackRegion(userId);
    try {
      var updatedProfile = await window.GutguardPlanApi.adminUpdateUserProfile(userId, {
        display_name: document.getElementById("admin-display-name-" + userId).value.trim(),
        role_type: nextRoleType,
        is_admin: nextIsAdmin,
        is_active: nextIsActive,
        approval_status: nextApprovalStatus,
        notes: document.getElementById("admin-notes-" + userId).value.trim(),
        change_reason: changeSummary
      });
      invalidateOperationsCaches();
      if (currentUser && userId === currentUser.id) {
        await fetchCurrentUserProfile(true).catch(function () {});
        renderAuthState();
      }
      var successMessage = "User profile updated.";
      if (previousProfile && previousProfile.approval_status !== updatedProfile.approval_status) {
        successMessage = updatedProfile.approval_status === "approved"
          ? "Account approved and unlocked."
          : (updatedProfile.approval_status === "rejected"
            ? "Account rejected."
            : "Account moved back to pending review.");
      } else if (previousProfile && previousProfile.is_admin !== updatedProfile.is_admin) {
        successMessage = updatedProfile.is_admin === true ? "Admin access granted." : "Admin access removed.";
      } else if (roleChanged) {
        successMessage = "Account role updated.";
      }
      setAdminProfileFeedback(
        userId,
        successMessage,
        "success",
        "Saved " + formatSavedAt(new Date().toISOString()) + "." + (updatedProfile.approved_at ? " Approval timestamp: " + formatSavedAt(updatedProfile.approved_at) + "." : "") + (changeSummary ? " Change summary: " + changeSummary + "." : "")
      );
      if (changeSummaryEl) changeSummaryEl.value = "";
      await refreshOperationsPanels(true);
      showToast(successMessage, "success");
    } catch (err) {
      reportClientIssue("saveAdminProfile", err, { userId: userId });
      setAdminProfileFeedback(userId, "Unable to update the user profile.", "error", err && err.message ? err.message : "Unknown error.");
      updateAdminProfileFeedbackRegion(userId);
      showToast(err && err.message ? err.message : "Unable to update the user profile.", "error");
    }
  }

  async function bulkUpdateVisibleProfiles(nextStatus) {
    if (!isCurrentUserAdmin()) {
      showToast("Admin access is required.", "error");
      return;
    }
    var targets = (visibleAdminProfiles || []).filter(function (profile) {
      return (profile.approval_status || "") === "pending";
    });
    if (!targets.length) {
      showToast("No visible pending accounts matched the current admin filter.", "warn");
      return;
    }
    if (!confirm((nextStatus === "approved" ? "Approve " : "Reject ") + targets.length + " visible pending account(s)?")) return;
    try {
      for (var index = 0; index < targets.length; index += 1) {
        var profile = targets[index];
        await window.GutguardPlanApi.adminUpdateUserProfile(profile.user_id, {
          display_name: profile.display_name,
          role_type: profile.role_type,
          is_admin: profile.is_admin === true,
          is_active: profile.is_active !== false,
          approval_status: nextStatus,
          notes: profile.notes || ""
        });
      }
      invalidateOperationsCaches();
      await refreshOperationsPanels(true);
      showToast((nextStatus === "approved" ? "Approved " : "Rejected ") + targets.length + " account(s).", nextStatus === "approved" ? "success" : "warn");
    } catch (err) {
      reportClientIssue("bulkUpdateVisibleProfiles", err, { nextStatus: nextStatus });
      showToast(err && err.message ? err.message : "Bulk update failed.", "error");
    }
  }

  function bulkApprovePendingProfiles() {
    return bulkUpdateVisibleProfiles("approved");
  }

  function bulkRejectPendingProfiles() {
    return bulkUpdateVisibleProfiles("rejected");
  }

  window.GutguardAdmin = {
    buildAdminProfileCard: buildAdminProfileCard,
    filterAdminProfiles: filterAdminProfiles,
    renderAdminDirectory: renderAdminDirectory,
    saveAdminProfile: saveAdminProfile,
    bulkUpdateVisibleProfiles: bulkUpdateVisibleProfiles,
    bulkApprovePendingProfiles: bulkApprovePendingProfiles,
    bulkRejectPendingProfiles: bulkRejectPendingProfiles
  };
})();
