"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type RoleType = "member" | "leader" | "squad" | "platoon" | "o1";

type FeatureCard = {
  eyebrow: string;
  title: string;
  copy: string;
  meta: string;
};

type RoleCard = {
  role: RoleType;
  icon: string;
  name: string;
  description: string;
  items: string[];
  badgeClass: string;
  badgeLabel: string;
  cta: string;
  tileClass: string;
};

declare global {
  interface Window {
    startForm?: (type: RoleType) => void;
    handleAuthSubmit?: (event?: Event) => void;
    handleSignUp?: () => void;
    handleSignOut?: () => void;
    saveMyProfile?: () => void;
    refreshSavedPlans?: (forceRefresh?: boolean) => void;
    refreshReviewQueue?: (forceRefresh?: boolean) => void;
    refreshDashboard?: (forceRefresh?: boolean) => void;
    refreshActivityFeed?: (forceRefresh?: boolean) => void;
    refreshAdminDirectory?: (forceRefresh?: boolean) => void;
    refreshUserDirectory?: (forceRefresh?: boolean) => void;
    bulkApprovePendingProfiles?: () => void;
    bulkRejectPendingProfiles?: () => void;
  }
}

const featureCards: FeatureCard[] = [
  {
    eyebrow: "Planning Engine",
    title: "Target Conversion",
    copy:
      "Turns 90-day goals into supporting numbers so each role can see the required leads, attendees, pay-ins, and sales volume before building a weekly plan.",
    meta: "Targets -> Activity Load"
  },
  {
    eyebrow: "Execution",
    title: "Weekly Activity Planner",
    copy:
      "Maps activities week by week, stores dates, and keeps each role focused on the actions that drive the projection instead of tracking targets in isolation.",
    meta: "12-Week Breakdown"
  },
  {
    eyebrow: "Roll-Up",
    title: "Live Consolidation",
    copy:
      "Leader views combine child plans into instant totals, making it easier to spot shortfalls, confirm event coverage, and submit one aligned operating plan.",
    meta: "Member -> 01"
  },
  {
    eyebrow: "Reliability",
    title: "Local Draft Recovery",
    copy:
      "Unsaved edits are preserved on the device, reducing loss during interruptions and making it safer to build complex plans before final submission.",
    meta: "Autosave Support"
  },
  {
    eyebrow: "Access",
    title: "Saved Plan Browser",
    copy:
      "Lets users search existing records from the home screen, reopen them by role, and continue updating the same plan instead of starting over.",
    meta: "Search + Reopen"
  },
  {
    eyebrow: "Control",
    title: "Scoped Sign-In",
    copy:
      "Supabase authentication and row-level security keep plan ownership clear so consolidation can scale without mixing records between users.",
    meta: "Secure Data Scope"
  }
];

const chainRoles: Array<{ role: RoleType; className: string; icon: string; label: string }> = [
  { role: "member", className: "fc-m", icon: "\u{1F647}", label: "Member" },
  { role: "leader", className: "fc-l", icon: "\u{1F465}", label: "Team Leader" },
  { role: "squad", className: "fc-s", icon: "\u{1F3C5}", label: "Squad Leader" },
  { role: "platoon", className: "fc-p", icon: "\u2B50", label: "Platoon Leader" },
  { role: "o1", className: "fc-o", icon: "\u{1F3E2}", label: "01 / Product Center" }
];

const stepItems = [
  { number: "Step 1", name: "Set Targets" },
  { number: "Step 2", name: "Compute Numbers" },
  { number: "Step 3", name: "Plan Activities" },
  { number: "Step 4", name: "Set Big Events" },
  { number: "Step 5", name: "Consolidate & Submit" }
];

const roleCards: RoleCard[] = [
  {
    role: "member",
    icon: "\u{1F647}",
    name: "Member",
    description:
      "Personal planning workspace for turning your 90-day commitment into weekly action.",
    items: [
      "Set pay-in and sales targets with auto-derived leads and attendees.",
      "Build a weekly pipeline across presentations, trainings, and follow-ups.",
      "Commit event attendance with dates and execution notes."
    ],
    badgeClass: "bm",
    badgeLabel: "Member",
    cta: "Start Plan",
    tileClass: "tc-m"
  },
  {
    role: "leader",
    icon: "\u{1F465}",
    name: "Team Leader",
    description:
      "Team planning view with both personal execution and direct-member roll-up control.",
    items: [
      "Run your own 90-day activity and production targets.",
      "Attach members under you and review combined totals instantly.",
      "Submit one team-level plan backed by actual child contributions."
    ],
    badgeClass: "bl",
    badgeLabel: "Team Leader",
    cta: "Open Workspace",
    tileClass: "tc-l"
  },
  {
    role: "squad",
    icon: "\u{1F3C5}",
    name: "Squad Leader",
    description:
      "Squad oversight workspace built for team leader consolidation and gap detection.",
    items: [
      "Monitor whether team leaders are covering target volume and events.",
      "Blend linked child plans with manual fallback entries when needed.",
      "See consolidated output before escalating to platoon level."
    ],
    badgeClass: "bs",
    badgeLabel: "Squad Leader",
    cta: "Review Roll-Up",
    tileClass: "tc-s"
  },
  {
    role: "platoon",
    icon: "\u2B50",
    name: "Platoon Leader",
    description:
      "Mid-level command view for verifying squad output before final center submission.",
    items: [
      "Aggregate squad leader plans into a platoon-wide target picture.",
      "Check activity load, event commitments, and production gaps in one place.",
      "Prepare the most accurate handoff for Product Center review."
    ],
    badgeClass: "bp",
    badgeLabel: "Platoon Leader",
    cta: "Consolidate",
    tileClass: "tc-p"
  },
  {
    role: "o1",
    icon: "\u{1F3E2}",
    name: "01 / Product Center",
    description:
      "Final command dashboard for validating all field plans before the April 1, 2026 submission deadline.",
    items: [
      "See the highest-level consolidated target and event commitment view.",
      "Confirm that every lower level is represented in the submitted chain.",
      "Finalize a center-wide plan with fewer blind spots and cleaner totals."
    ],
    badgeClass: "bo",
    badgeLabel: "01 Level",
    cta: "Finalize Plan",
    tileClass: "tc-o"
  }
];

export default function HomeScreen() {
  const [activePanel, setActivePanel] = useState<"overview" | "workspace" | "operations">(
    "overview"
  );

  function handleStartForm(role: RoleType) {
    window.startForm?.(role);
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    window.handleAuthSubmit?.(event.nativeEvent);
  }

  function refreshSavedPlans(forceRefresh?: boolean) {
    window.refreshSavedPlans?.(forceRefresh);
  }

  function getPanelClass(panel: "overview" | "workspace" | "operations") {
    return `home-panel ${activePanel === panel ? "active" : ""}`;
  }

  return (
    <div id="sc-home" className="screen active">
      <div className="ch-head">
        <h1>90-Day Planning &amp; Consolidation System</h1>
        <p>
          Each level enters their own plan. Data flows up automatically: Member -&gt; Team
          Leader -&gt; Squad -&gt; Platoon -&gt; 01
        </p>
      </div>

      <div className="auth-wrap">
        <div className="auth-head">
          <div>
            <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
              Account Access
            </div>
            <div className="auth-copy">
              Sign in with your Supabase account to save drafts, reopen submitted plans, and
              keep consolidation records scoped to the correct user through Supabase RLS.
            </div>
            <div className="auth-copy" style={{ marginTop: ".35rem" }}>
              New accounts must verify email first, then wait for admin approval before they can
              load parent links, save plans, or review submissions.
            </div>
          </div>
        </div>
        <div
          style={{ marginTop: ".75rem", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
        >
          <form
            id="auth-credentials"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
            onSubmit={handleAuthSubmit}
          >
            <input
              type="email"
              id="auth-email"
              placeholder="Email address"
              aria-label="Email address"
              autoComplete="email"
            />
            <input
              type="password"
              id="auth-password"
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
            />
            <input
              type="text"
              id="auth-display-name"
              placeholder="Display name for sign up"
              aria-label="Display name for sign up"
              autoComplete="name"
            />
            <select id="auth-role-type" aria-label="Role for sign up" defaultValue="member">
              <option value="member">Member</option>
              <option value="leader">Team Leader</option>
              <option value="squad">Squad Leader</option>
              <option value="platoon">Platoon Leader</option>
              <option value="o1">01 / Product Center</option>
            </select>
            <button className="btn btp" type="submit">
              Sign In
            </button>
            <button className="btn bto" type="button" onClick={() => window.handleSignUp?.()}>
              Sign Up
            </button>
            <div className="saved-plan-stat-meta" style={{ flexBasis: "100%" }}>
              Display name and role are used only when creating a new account.
            </div>
          </form>
          <div
            id="auth-signed-in"
            style={{ display: "none", alignItems: "center", gap: 10 }}
          >
            <span>
              Signed in as <strong id="auth-email-display"></strong>
            </span>
            <span className="auth-status">
              <strong id="auth-display-name-display"></strong>
              <span id="auth-role-display" style={{ marginLeft: 8 }}></span>
            </span>
            <button
              className="btn bto"
              id="sign-out-btn"
              type="button"
              onClick={() => window.handleSignOut?.()}
            >
              Sign Out
            </button>
          </div>
        </div>
        <div id="auth-access-state" className="saved-plan-empty" style={{ marginTop: ".85rem" }}>
          Sign in to load your access state.
        </div>
      </div>

      <div id="dashboard-wrap" className="saved-plans-wrap" style={{ display: "none" }}>
        <div className="saved-plans-head">
          <div>
            <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
              Operations Dashboard
            </div>
            <div className="saved-plans-copy">
              Live operating view of accounts, plan activity, missing hierarchy links, and review
              workload.
            </div>
          </div>
          <div className="saved-plans-tools">
            <button className="btn bto" type="button" onClick={() => window.refreshDashboard?.(true)}>
              Refresh Dashboard
            </button>
          </div>
        </div>
        <div id="dashboard-stats" className="saved-plan-stats">
          <div className="saved-plan-stat-card">
            <div className="saved-plan-stat-label">Accounts</div>
            <div className="saved-plan-stat-value">0</div>
            <div className="saved-plan-stat-meta">Visible after sign-in</div>
          </div>
          <div className="saved-plan-stat-card">
            <div className="saved-plan-stat-label">Plans</div>
            <div className="saved-plan-stat-value">0</div>
            <div className="saved-plan-stat-meta">All roles combined</div>
          </div>
          <div className="saved-plan-stat-card">
            <div className="saved-plan-stat-label">Missing Links</div>
            <div className="saved-plan-stat-value">0</div>
            <div className="saved-plan-stat-meta">Plans without a parent</div>
          </div>
          <div className="saved-plan-stat-card">
            <div className="saved-plan-stat-label">Pending Review</div>
            <div className="saved-plan-stat-value">0</div>
            <div className="saved-plan-stat-meta">Submitted child plans</div>
          </div>
        </div>
      </div>

      <div id="my-profile-wrap" className="saved-plans-wrap" style={{ display: "none" }}>
        <div className="saved-plans-head">
          <div>
            <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
              My Profile
            </div>
            <div className="saved-plans-copy">
              Manage the display name shown around the planner. Role, approval, and admin access
              are controlled by the admin directory.
            </div>
          </div>
          <div className="saved-plans-tools">
            <button className="btn btp" type="button" onClick={() => window.saveMyProfile?.()}>
              Save Profile
            </button>
          </div>
        </div>
        <div className="profile-grid">
          <div className="profile-field">
            <label htmlFor="profile-display-name">Display Name</label>
            <input id="profile-display-name" type="text" placeholder="Your display name" />
          </div>
          <div className="profile-field">
            <label htmlFor="profile-role-type">Current Role</label>
            <input id="profile-role-type" type="text" readOnly placeholder="Assigned by admin" />
          </div>
          <div className="profile-field profile-field-wide">
            <label htmlFor="profile-notes">Notes</label>
            <textarea
              id="profile-notes"
              rows={3}
              placeholder="Optional note for this account"
            ></textarea>
          </div>
        </div>
      </div>

      <div className="home-switcher" role="tablist" aria-label="Home sections">
        <button
          type="button"
          className={`home-switcher-btn ${activePanel === "overview" ? "active" : ""}`}
          onClick={() => setActivePanel("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`home-switcher-btn ${activePanel === "workspace" ? "active" : ""}`}
          onClick={() => setActivePanel("workspace")}
        >
          Workspace
        </button>
        <button
          type="button"
          className={`home-switcher-btn ${activePanel === "operations" ? "active" : ""}`}
          onClick={() => setActivePanel("operations")}
        >
          Operations
        </button>
      </div>

      <div className={getPanelClass("overview")} aria-hidden={activePanel !== "overview"}>
        <div className="memo-box">
          <div className="mb-lbl">How It Works</div>
          <strong>1.</strong> Every role starts with a 90-day target, and the system converts it
          into leads, attendees, pay-ins, sales, and weekly execution.
          <br />
          <strong>2.</strong> Leaders get a <strong>Consolidation View</strong> that combines child
          plans, manual fallback entries, and saved linked plans in one roll-up.
          <br />
          <strong>3.</strong> The 01/Product Center closes the loop with one final view of targets,
          event commitments, and actual combined field activity.
        </div>

        <div className="sec-lbl">System Features</div>
        <div className="feature-grid">
          {featureCards.map((card) => (
            <div key={card.title} className="feature-card">
              <div className="feature-eyebrow">{card.eyebrow}</div>
              <div className="feature-title">{card.title}</div>
              <div className="feature-copy">{card.copy}</div>
              <div className="feature-meta">{card.meta}</div>
            </div>
          ))}
        </div>

        <div className="sec-lbl">Consolidation Chain</div>
        <div className="flow-chain">
          {chainRoles.map((item, index) => (
            <span key={item.role} style={{ display: "contents" }}>
              <div className="fc-node">
                <span
                  className={`fc-badge ${item.className}`}
                  onClick={() => handleStartForm(item.role)}
                >
                  {item.icon} {item.label}
                </span>
              </div>
              {index < chainRoles.length - 1 ? <span className="fc-arrow">-&gt;</span> : null}
            </span>
          ))}
        </div>

        <div className="step-bar">
          {stepItems.map((step) => (
            <div key={step.number} className="step-item">
              <span className="s-num">{step.number}</span>
              <div className="s-name">{step.name}</div>
            </div>
          ))}
        </div>

        <div className="sec-lbl">Open a Plan</div>
        <div className="type-grid">
          {roleCards.map((card) => (
            <div
              key={card.role}
              className={`tc ${card.tileClass}`}
              onClick={() => handleStartForm(card.role)}
            >
              <span className="t-icon">{card.icon}</span>
              <div className="t-name">{card.name}</div>
              <div className="t-desc">{card.description}</div>
              <ul className="t-list">
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="t-foot">
                <span className={`t-badge ${card.badgeClass}`}>{card.badgeLabel}</span>
                <span className="t-cta">{card.cta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={getPanelClass("workspace")} aria-hidden={activePanel !== "workspace"}>
        <div className="saved-plans-wrap">
          <div className="saved-plans-head">
            <div>
              <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                Saved Plans
              </div>
              <div className="saved-plans-copy">
                Browse plans already stored in Supabase and open any role-specific record directly
                from the home screen.
              </div>
            </div>
            <div className="saved-plans-tools">
              <input
                type="text"
                id="saved-plans-search"
                placeholder="Search name, ID, or status"
                aria-label="Search saved plans by name, ID, or status"
                onInput={() => refreshSavedPlans()}
              />
              <select
                id="saved-plans-filter"
                aria-label="Filter saved plans by role"
                onChange={() => refreshSavedPlans()}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <select
                id="saved-plans-status"
                aria-label="Filter saved plans by status"
                onChange={() => refreshSavedPlans()}
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="needs_revision">Needs Revision</option>
              </select>
              <button className="btn bto" type="button" onClick={() => refreshSavedPlans(true)}>
                Refresh List
              </button>
            </div>
          </div>
          <div id="saved-plan-stats" className="saved-plan-stats">
            <div className="saved-plan-stat-card">
              <div className="saved-plan-stat-label">Total Plans</div>
              <div className="saved-plan-stat-value">0</div>
              <div className="saved-plan-stat-meta">Visible after sign-in</div>
            </div>
            <div className="saved-plan-stat-card">
              <div className="saved-plan-stat-label">Submitted</div>
              <div className="saved-plan-stat-value">0</div>
              <div className="saved-plan-stat-meta">Ready records</div>
            </div>
            <div className="saved-plan-stat-card">
              <div className="saved-plan-stat-label">Drafts</div>
              <div className="saved-plan-stat-value">0</div>
              <div className="saved-plan-stat-meta">Unfinished plans</div>
            </div>
            <div className="saved-plan-stat-card">
              <div className="saved-plan-stat-label">Last Updated</div>
              <div className="saved-plan-stat-value">-</div>
              <div className="saved-plan-stat-meta">Most recent activity</div>
            </div>
          </div>
          <div id="saved-plans-list" className="saved-plans-list">
            <div className="saved-plan-empty">
              Saved plans will appear here after Supabase is connected.
            </div>
          </div>
        </div>
        <div className="saved-plans-wrap">
          <div className="saved-plans-head">
            <div>
              <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                Review Queue
              </div>
              <div className="saved-plans-copy">
                Submitted child plans that are visible through the hierarchy chain can be approved
                or sent back with revision notes from here.
              </div>
            </div>
            <div className="saved-plans-tools">
              <button className="btn bto" type="button" onClick={() => window.refreshReviewQueue?.(true)}>
                Refresh Queue
              </button>
            </div>
          </div>
          <div id="review-queue-list" className="saved-plans-list">
            <div className="saved-plan-empty">
              Reviewable plans will appear here after sign-in.
            </div>
          </div>
        </div>
      </div>

      <div className={getPanelClass("operations")} aria-hidden={activePanel !== "operations"}>
        <div className="saved-plans-wrap">
          <div className="saved-plans-head">
            <div>
              <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                User Directory
              </div>
              <div className="saved-plans-copy">
                Browse active approved accounts by role, see whether they already have a plan, and
                confirm who is ready for hierarchy linking.
              </div>
            </div>
            <div className="saved-plans-tools">
              <input
                type="text"
                id="user-directory-search"
                placeholder="Search user or email"
                aria-label="Search approved users"
                onInput={() => window.refreshUserDirectory?.()}
              />
              <select
                id="user-directory-role"
                aria-label="Filter approved users by role"
                onChange={() => window.refreshUserDirectory?.()}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <button className="btn bto" type="button" onClick={() => window.refreshUserDirectory?.(true)}>
                Refresh Directory
              </button>
            </div>
          </div>
          <div id="user-directory-list" className="saved-plans-list">
            <div className="saved-plan-empty">
              Approved users will appear here after sign-in.
            </div>
          </div>
        </div>

        <div className="saved-plans-wrap">
          <div className="saved-plans-head">
            <div>
              <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                Recent Activity
              </div>
              <div className="saved-plans-copy">
                Audit trail for account onboarding, plan updates, approvals, and deletion events.
              </div>
            </div>
            <div className="saved-plans-tools">
              <input
                type="text"
                id="activity-feed-search"
                placeholder="Search activity"
                aria-label="Search recent activity"
                onInput={() => window.refreshActivityFeed?.()}
              />
              <select
                id="activity-feed-action"
                aria-label="Filter recent activity by action"
                onChange={() => window.refreshActivityFeed?.()}
              >
                <option value="">All Actions</option>
                <option value="created">Plan Created</option>
                <option value="updated">Plan Updated</option>
                <option value="status_changed">Plan Status Changed</option>
                <option value="deleted">Plan Deleted</option>
                <option value="account_created">Account Created</option>
                <option value="profile_updated">Profile Updated</option>
                <option value="approval_changed">Approval Changed</option>
                <option value="role_changed">Role Changed</option>
                <option value="activation_changed">Activation Changed</option>
                <option value="admin_changed">Admin Changed</option>
              </select>
              <select
                id="activity-feed-role"
                aria-label="Filter recent activity by role"
                onChange={() => window.refreshActivityFeed?.()}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <button className="btn bto" type="button" onClick={() => window.refreshActivityFeed?.(true)}>
                Refresh Activity
              </button>
            </div>
          </div>
          <div id="activity-feed-list" className="saved-plans-list">
            <div className="saved-plan-empty">
              Recent activity will appear here after sign-in.
            </div>
          </div>
        </div>

        <div id="admin-directory-wrap" className="saved-plans-wrap" style={{ display: "none" }}>
          <div className="saved-plans-head">
            <div>
              <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                Admin Directory
              </div>
              <div className="saved-plans-copy">
                Manage account names, roles, active status, and onboarding notes for the whole
                hierarchy directory.
              </div>
            </div>
            <div className="saved-plans-tools">
              <input
                type="text"
                id="admin-profiles-search"
                placeholder="Search email or name"
                aria-label="Search user profiles by email or name"
                onInput={() => window.refreshAdminDirectory?.()}
              />
              <select
                id="admin-profiles-role"
                aria-label="Filter admin directory by role"
                onChange={() => window.refreshAdminDirectory?.()}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <select
                id="admin-profiles-approval"
                aria-label="Filter admin directory by approval"
                onChange={() => window.refreshAdminDirectory?.()}
              >
                <option value="">All Approval States</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                id="admin-profiles-admin"
                aria-label="Filter admin directory by admin access"
                onChange={() => window.refreshAdminDirectory?.()}
              >
                <option value="">All Access</option>
                <option value="admin">Admin</option>
                <option value="standard">Standard</option>
              </select>
              <select
                id="admin-profiles-sort"
                aria-label="Sort admin directory"
                onChange={() => window.refreshAdminDirectory?.()}
                defaultValue="name"
              >
                <option value="name">Sort by Name</option>
                <option value="newest">Newest Signup</option>
                <option value="latest-plan">Latest Plan Activity</option>
                <option value="pending-first">Pending First</option>
              </select>
              <button className="btn bto" type="button" onClick={() => window.bulkApprovePendingProfiles?.()}>
                Approve Visible Pending
              </button>
              <button className="btn btn-danger-lite" type="button" onClick={() => window.bulkRejectPendingProfiles?.()}>
                Reject Visible Pending
              </button>
              <button className="btn bto" type="button" onClick={() => window.refreshAdminDirectory?.(true)}>
                Refresh Directory
              </button>
            </div>
          </div>
          <div id="admin-profiles-list" className="saved-plans-list">
            <div className="saved-plan-empty">
              Admin controls become available after an approved admin signs in.
            </div>
          </div>
        </div>
      </div>

      <div className="notice n-danger">
        <strong>Non-Negotiable:</strong> All leaders submit individual plans | All plans include
        leads, pay-ins, sales | Each Product Center schedules at least 2 big events | Final plan
        submitted by the 01.
      </div>
    </div>
  );
}
