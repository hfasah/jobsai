// Human-readable labels for token_ledger rows — both spend features and
// grant/refund reasons. Used by the consumer Credits & Usage page.

const FEATURE_LABELS: Record<string, string> = {
  auto_apply: "Auto-Apply",
  extension_apply: "Extension Apply",
  resume_tailor: "Résumé Tailoring",
  cover_letter: "Cover Letter",
  ats_scan: "ATS Scan",
  written_eval: "Written Interview",
  voice_minute: "Voice Interview",
  avatar_minute: "Avatar Interview",
  linkedin_optimize: "LinkedIn Optimizer",
  linkedin_post: "LinkedIn Post",
  coaching_session: "Coaching Session",
  interview_prep: "Interview Prep",
  mock_interview: "Mock Interview",
  company_research: "Company Research",
  salary_intel: "Salary Intel",
  follow_up: "Follow-up",
};

const REASON_LABELS: Record<string, string> = {
  signup_grant: "Signup bonus",
  monthly_grant: "Monthly credits",
  topup: "Credit top-up",
  free_apply: "Free auto-apply",
  auto_apply_refund: "Auto-apply refund",
  admin_credit: "Support credit",
  coaching_refund: "Coaching refund",
};

function titleCase(k: string): string {
  return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Label a ledger row from its reason + feature. For spends, reason === feature
// (both hold the feature key); grants/refunds carry a distinct reason.
export function ledgerLabel(reason: string | null | undefined, feature: string | null | undefined): string {
  const r = (reason ?? "").trim();
  const f = (feature ?? "").trim();
  if (f && FEATURE_LABELS[f]) return FEATURE_LABELS[f];
  if (r && REASON_LABELS[r]) return REASON_LABELS[r];
  if (r && FEATURE_LABELS[r]) return FEATURE_LABELS[r];
  return titleCase(f || r || "Activity");
}

// Is this row a spend (true) or a credit/grant (false)?
export function isSpend(delta: number): boolean {
  return delta < 0;
}
