"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren
} from "react";

type RoleType = "member" | "leader" | "squad" | "platoon" | "o1";

type GutguardActionContextValue = {
  goHome: () => void;
  startForm: (role: RoleType) => void;
  submitAuth: () => void;
  signUp: () => void;
  signOut: () => void;
  saveMyProfile: () => void;
  refreshSavedPlans: (forceRefresh?: boolean) => void;
  refreshReviewQueue: (forceRefresh?: boolean) => void;
  refreshDashboard: (forceRefresh?: boolean) => void;
  refreshActivityFeed: (forceRefresh?: boolean) => void;
  refreshAdminDirectory: (forceRefresh?: boolean) => void;
  refreshUserDirectory: (forceRefresh?: boolean) => void;
  bulkApprovePendingProfiles: () => void;
  bulkRejectPendingProfiles: () => void;
};

const GutguardActionContext = createContext<GutguardActionContextValue | null>(null);

function dispatchGutguardAction<TDetail>(type: string, detail?: TDetail) {
  document.dispatchEvent(
    new CustomEvent("gutguard:action", {
      detail: {
        type,
        detail
      }
    })
  );
}

const gutguardActions: GutguardActionContextValue = {
  goHome: () => dispatchGutguardAction("go-home"),
  startForm: (role) => dispatchGutguardAction("start-form", { role }),
  submitAuth: () => dispatchGutguardAction("submit-auth"),
  signUp: () => dispatchGutguardAction("sign-up"),
  signOut: () => dispatchGutguardAction("sign-out"),
  saveMyProfile: () => dispatchGutguardAction("save-my-profile"),
  refreshSavedPlans: (forceRefresh) =>
    dispatchGutguardAction("refresh-saved-plans", { forceRefresh: !!forceRefresh }),
  refreshReviewQueue: (forceRefresh) =>
    dispatchGutguardAction("refresh-review-queue", { forceRefresh: !!forceRefresh }),
  refreshDashboard: (forceRefresh) =>
    dispatchGutguardAction("refresh-dashboard", { forceRefresh: !!forceRefresh }),
  refreshActivityFeed: (forceRefresh) =>
    dispatchGutguardAction("refresh-activity-feed", { forceRefresh: !!forceRefresh }),
  refreshAdminDirectory: (forceRefresh) =>
    dispatchGutguardAction("refresh-admin-directory", { forceRefresh: !!forceRefresh }),
  refreshUserDirectory: (forceRefresh) =>
    dispatchGutguardAction("refresh-user-directory", { forceRefresh: !!forceRefresh }),
  bulkApprovePendingProfiles: () => dispatchGutguardAction("bulk-approve-pending-profiles"),
  bulkRejectPendingProfiles: () => dispatchGutguardAction("bulk-reject-pending-profiles")
};

export function GutguardActionProvider({ children }: PropsWithChildren) {
  return (
    <GutguardActionContext.Provider value={gutguardActions}>
      {children}
    </GutguardActionContext.Provider>
  );
}

export function useGutguardActions() {
  const context = useContext(GutguardActionContext);

  if (!context) {
    throw new Error("useGutguardActions must be used inside GutguardActionProvider.");
  }

  return context;
}
