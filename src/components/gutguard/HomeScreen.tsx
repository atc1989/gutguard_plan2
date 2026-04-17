"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useGutguardActions } from "./GutguardActionContext";
import { gutguardSiteConfig } from "@/lib/gutguard-site-config";

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

type SignInFormState = {
  email: string;
  password: string;
};

type SignUpFormState = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  roleType: RoleType;
};

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
      gutguardSiteConfig.o1DeadlineCopy,
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
  const {
    bulkApprovePendingProfiles,
    bulkRejectPendingProfiles,
    refreshActivityFeed,
    refreshAdminDirectory,
    refreshDashboard,
    refreshReviewQueue,
    refreshSavedPlans,
    refreshUserDirectory,
    saveMyProfile,
    signOut,
    signUp,
    startForm,
    submitAuth
  } = useGutguardActions();
  const [activePanel, setActivePanel] = useState<"overview" | "workspace" | "operations">(
    "overview"
  );
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authNotice, setAuthNotice] = useState("");
  const [signInForm, setSignInForm] = useState<SignInFormState>({
    email: "",
    password: ""
  });
  const [signUpForm, setSignUpForm] = useState<SignUpFormState>({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleType: "member"
  });
  const refreshTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  useEffect(() => {
    return () => {
      Object.values(refreshTimersRef.current).forEach((timer) => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, []);

  function syncLegacyAuthFields(values: {
    email: string;
    password: string;
    displayName?: string;
    roleType?: RoleType;
  }) {
    const fieldValues = {
      "auth-email": values.email,
      "auth-password": values.password,
      "auth-display-name": values.displayName ?? "",
      "auth-role-type": values.roleType ?? "member"
    } as const;

    Object.entries(fieldValues).forEach(([id, value]) => {
      const element = document.getElementById(id) as HTMLInputElement | null;

      if (element) {
        element.value = value;
      }
    });
  }

  function handleAuthModeChange(nextMode: "sign-in" | "sign-up") {
    setAuthMode(nextMode);
    setAuthNotice("");
  }

  function handleSignInChange(field: keyof SignInFormState, value: string) {
    setAuthNotice("");
    setSignInForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSignUpChange(
    field: keyof SignUpFormState,
    value: SignUpFormState[keyof SignUpFormState]
  ) {
    setAuthNotice("");
    setSignUpForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = signInForm.email.trim();
    const password = signInForm.password;

    if (!email || !password) {
      setAuthNotice("Enter your email and password to sign in.");
      return;
    }

    syncLegacyAuthFields({
      email,
      password
    });
    setAuthNotice("");
    submitAuth();
  }

  function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const displayName = signUpForm.displayName.trim();
    const email = signUpForm.email.trim();
    const password = signUpForm.password;

    if (!displayName || !email || !password) {
      setAuthNotice("Display name, email, and password are required to create an account.");
      return;
    }

    if (password.length < 6) {
      setAuthNotice("Use a password with at least 6 characters.");
      return;
    }

    if (password !== signUpForm.confirmPassword) {
      setAuthNotice("Password confirmation does not match.");
      return;
    }

    syncLegacyAuthFields({
      email,
      password,
      displayName,
      roleType: signUpForm.roleType
    });
    setAuthNotice("");
    signUp();
  }

  function getPanelClass(panel: "overview" | "workspace" | "operations") {
    return `home-panel ${activePanel === panel ? "active" : ""}`;
  }

  function scheduleRefresh(
    key: string,
    refreshAction: (forceRefresh?: boolean) => void,
    options?: { delay?: number; forceRefresh?: boolean }
  ) {
    const delay = options?.delay ?? 220;
    const forceRefresh = options?.forceRefresh ?? false;
    const existingTimer = refreshTimersRef.current[key];

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    refreshTimersRef.current[key] = setTimeout(() => {
      refreshAction(forceRefresh);
      delete refreshTimersRef.current[key];
    }, delay);
  }

  function getHomeTabProps(panel: "overview" | "workspace" | "operations") {
    const isActive = activePanel === panel;

    return {
      id: `home-tab-${panel}`,
      role: "tab" as const,
      "aria-selected": isActive,
      "aria-controls": `home-panel-${panel}`,
      tabIndex: isActive ? 0 : -1
    };
  }

  function getHomePanelProps(panel: "overview" | "workspace" | "operations") {
    const isActive = activePanel === panel;

    return {
      id: `home-panel-${panel}`,
      role: "tabpanel" as const,
      "aria-labelledby": `home-tab-${panel}`,
      "aria-hidden": !isActive,
      hidden: !isActive,
      tabIndex: 0
    };
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
          <div
            id="auth-credentials"
            className="auth-shell"
            style={{ display: "flex", flexDirection: "column", width: "100%", gap: 14 }}
          >
            <div className="auth-mode-switch" aria-label="Authentication mode">
              <button
                type="button"
                className={`auth-mode-btn ${authMode === "sign-in" ? "active" : ""}`}
                onClick={() => handleAuthModeChange("sign-in")}
                aria-pressed={authMode === "sign-in"}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-btn ${authMode === "sign-up" ? "active" : ""}`}
                onClick={() => handleAuthModeChange("sign-up")}
                aria-pressed={authMode === "sign-up"}
              >
                Create Account
              </button>
            </div>

            <div className="auth-form-shell" aria-hidden="true">
              <input type="hidden" id="auth-email" value="" readOnly />
              <input type="hidden" id="auth-password" value="" readOnly />
              <input type="hidden" id="auth-display-name" value="" readOnly />
              <input type="hidden" id="auth-role-type" value="member" readOnly />
            </div>

            {authMode === "sign-in" ? (
              <form className="auth-card-grid" onSubmit={handleSignInSubmit}>
                <div className="auth-card">
                  <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                    Sign In
                  </div>
                  <div className="saved-plans-copy" style={{ marginBottom: ".95rem" }}>
                    Use your approved account to reopen plans, save drafts, and access your role
                    workspace.
                  </div>
                  <div className="auth-form-grid">
                    <label className="auth-field" htmlFor="sign-in-email">
                      <span>Email Address</span>
                      <input
                        id="sign-in-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={signInForm.email}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignInChange("email", event.target.value)
                        }
                      />
                    </label>
                    <label className="auth-field" htmlFor="sign-in-password">
                      <span>Password</span>
                      <input
                        id="sign-in-password"
                        type="password"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        value={signInForm.password}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignInChange("password", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="auth-action-row">
                    <button className="btn btp" type="submit">
                      Sign In
                    </button>
                    <button
                      className="btn bto"
                      type="button"
                      onClick={() => handleAuthModeChange("sign-up")}
                    >
                      Need an Account?
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form className="auth-card-grid" onSubmit={handleSignUpSubmit}>
                <div className="auth-card">
                  <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                    Create Account
                  </div>
                  <div className="saved-plans-copy" style={{ marginBottom: ".95rem" }}>
                    New users enter their display name and role once, then verify their email and
                    wait for admin approval before protected access unlocks.
                  </div>
                  <div className="auth-form-grid">
                    <label className="auth-field" htmlFor="sign-up-display-name">
                      <span>Display Name</span>
                      <input
                        id="sign-up-display-name"
                        type="text"
                        placeholder="Your full name"
                        autoComplete="name"
                        value={signUpForm.displayName}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignUpChange("displayName", event.target.value)
                        }
                      />
                    </label>
                    <label className="auth-field" htmlFor="sign-up-role">
                      <span>Role</span>
                      <select
                        id="sign-up-role"
                        value={signUpForm.roleType}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          handleSignUpChange("roleType", event.target.value as RoleType)
                        }
                      >
                        <option value="member">Member</option>
                        <option value="leader">Team Leader</option>
                        <option value="squad">Squad Leader</option>
                        <option value="platoon">Platoon Leader</option>
                        <option value="o1">01 / Product Center</option>
                      </select>
                    </label>
                    <label className="auth-field" htmlFor="sign-up-email">
                      <span>Email Address</span>
                      <input
                        id="sign-up-email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={signUpForm.email}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignUpChange("email", event.target.value)
                        }
                      />
                    </label>
                    <label className="auth-field" htmlFor="sign-up-password">
                      <span>Password</span>
                      <input
                        id="sign-up-password"
                        type="password"
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
                        value={signUpForm.password}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignUpChange("password", event.target.value)
                        }
                      />
                    </label>
                    <label className="auth-field" htmlFor="sign-up-confirm-password">
                      <span>Confirm Password</span>
                      <input
                        id="sign-up-confirm-password"
                        type="password"
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        value={signUpForm.confirmPassword}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          handleSignUpChange("confirmPassword", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="auth-action-row">
                    <button className="btn btp" type="submit">
                      Create Account
                    </button>
                    <button
                      className="btn bto"
                      type="button"
                      onClick={() => handleAuthModeChange("sign-in")}
                    >
                      Back to Sign In
                    </button>
                  </div>
                  <div className="saved-plan-stat-meta">
                    Role selection only applies during signup. Role changes after approval should be
                    handled by an admin.
                  </div>
                </div>
              </form>
            )}

            {authNotice ? <div className="auth-inline-note">{authNotice}</div> : null}

            <div className="auth-guide-grid">
              <div className="auth-guide-card">
                <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                  New User Flow
                </div>
                <ol className="auth-guide-list">
                  <li>Create your account once with the correct role.</li>
                  <li>Verify the email link sent by Supabase Auth.</li>
                  <li>Sign in and wait for an approved admin to unlock full access.</li>
                  <li>After approval, reopen the planner and continue from the same account.</li>
                </ol>
              </div>
              <div className="auth-guide-card">
                <div className="sec-lbl" style={{ marginBottom: ".45rem" }}>
                  Admin Approval Flow
                </div>
                <ol className="auth-guide-list">
                  <li>Bootstrap the first approved admin once in Supabase.</li>
                  <li>That admin signs in and opens Operations -&gt; Admin Directory.</li>
                  <li>Filter Approval to Pending, then approve visible accounts or update one user at a time.</li>
                  <li>After the first admin is active, normal approvals no longer need SQL.</li>
                </ol>
              </div>
            </div>
          </div>
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
              onClick={signOut}
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
            <button className="btn bto" type="button" onClick={() => refreshDashboard(true)}>
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
            <button className="btn btp" type="button" onClick={saveMyProfile}>
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
          {...getHomeTabProps("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`home-switcher-btn ${activePanel === "workspace" ? "active" : ""}`}
          onClick={() => setActivePanel("workspace")}
          {...getHomeTabProps("workspace")}
        >
          Workspace
        </button>
        <button
          type="button"
          className={`home-switcher-btn ${activePanel === "operations" ? "active" : ""}`}
          onClick={() => setActivePanel("operations")}
          {...getHomeTabProps("operations")}
        >
          Operations
        </button>
      </div>

      <div className={getPanelClass("overview")} {...getHomePanelProps("overview")}>
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
                <button
                  type="button"
                  className={`fc-badge ${item.className}`}
                  onClick={() => startForm(item.role)}
                  aria-label={`Open ${item.label} workspace`}
                >
                  {item.icon} {item.label}
                </button>
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
            <button
              type="button"
              key={card.role}
              className={`tc ${card.tileClass}`}
              onClick={() => startForm(card.role)}
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
            </button>
          ))}
        </div>
      </div>

      <div className={getPanelClass("workspace")} {...getHomePanelProps("workspace")}>
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
                onInput={() => scheduleRefresh("saved-plans-search", refreshSavedPlans, { delay: 280 })}
              />
              <select
                id="saved-plans-filter"
                aria-label="Filter saved plans by role"
                onChange={() => scheduleRefresh("saved-plans-filter", refreshSavedPlans)}
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
                onChange={() => scheduleRefresh("saved-plans-status", refreshSavedPlans)}
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
              <button className="btn bto" type="button" onClick={() => refreshReviewQueue(true)}>
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

      <div className={getPanelClass("operations")} {...getHomePanelProps("operations")}>
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
                onInput={() =>
                  scheduleRefresh("user-directory-search", refreshUserDirectory, { delay: 280 })
                }
              />
              <select
                id="user-directory-role"
                aria-label="Filter approved users by role"
                onChange={() => scheduleRefresh("user-directory-role", refreshUserDirectory)}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <button className="btn bto" type="button" onClick={() => refreshUserDirectory(true)}>
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
                onInput={() =>
                  scheduleRefresh("activity-feed-search", refreshActivityFeed, { delay: 280 })
                }
              />
              <select
                id="activity-feed-action"
                aria-label="Filter recent activity by action"
                onChange={() => scheduleRefresh("activity-feed-action", refreshActivityFeed)}
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
                onChange={() => scheduleRefresh("activity-feed-role", refreshActivityFeed)}
              >
                <option value="">All Roles</option>
                <option value="member">Member</option>
                <option value="leader">Team Leader</option>
                <option value="squad">Squad Leader</option>
                <option value="platoon">Platoon Leader</option>
                <option value="o1">01 / Product Center</option>
              </select>
              <button className="btn bto" type="button" onClick={() => refreshActivityFeed(true)}>
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
                Manage account names, roles, active status, onboarding notes, and audit context for
                the whole hierarchy directory. Pending signups can be approved here after they
                verify email.
              </div>
            </div>
            <div className="saved-plans-tools">
              <input
                type="text"
                id="admin-profiles-search"
                placeholder="Search email or name"
                aria-label="Search user profiles by email or name"
                onInput={() =>
                  scheduleRefresh("admin-profiles-search", refreshAdminDirectory, { delay: 280 })
                }
              />
              <select
                id="admin-profiles-role"
                aria-label="Filter admin directory by role"
                onChange={() => scheduleRefresh("admin-profiles-role", refreshAdminDirectory)}
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
                onChange={() =>
                  scheduleRefresh("admin-profiles-approval", refreshAdminDirectory)
                }
              >
                <option value="">All Approval States</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                id="admin-profiles-admin"
                aria-label="Filter admin directory by admin access"
                onChange={() => scheduleRefresh("admin-profiles-admin", refreshAdminDirectory)}
              >
                <option value="">All Access</option>
                <option value="admin">Admin</option>
                <option value="standard">Standard</option>
              </select>
              <select
                id="admin-profiles-sort"
                aria-label="Sort admin directory"
                onChange={() => scheduleRefresh("admin-profiles-sort", refreshAdminDirectory)}
                defaultValue="name"
              >
                <option value="name">Sort by Name</option>
                <option value="newest">Newest Signup</option>
                <option value="latest-plan">Latest Plan Activity</option>
                <option value="pending-first">Pending First</option>
              </select>
              <button className="btn bto" type="button" onClick={bulkApprovePendingProfiles}>
                Approve Visible Pending
              </button>
              <button className="btn btn-danger-lite" type="button" onClick={bulkRejectPendingProfiles}>
                Reject Visible Pending
              </button>
              <button className="btn bto" type="button" onClick={() => refreshAdminDirectory(true)}>
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
