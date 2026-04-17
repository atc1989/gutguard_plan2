export const gutguardSiteConfig = {
  referenceCode: "Ref. OPS-032326-003",
  deadlineLabel: "Configured by operations admin",
  memoTo: "All Members, 01s, Leaders, Depots & City Stockists",
  memoFrom: "Office of Chairman & CEO",
  memoDate: "Configured in site settings",
  executionWindow: "Current 90-day execution window",
  o1DeadlineCopy: "Final command dashboard for validating all field plans before the configured submission deadline.",
  calendarWindowNote: "Use the current 90-day execution window configured for this rollout."
} as const;

export type GutguardSiteConfig = typeof gutguardSiteConfig;
