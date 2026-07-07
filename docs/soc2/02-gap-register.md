# Gap Register — remediation tracker

Prioritized open gaps for the Type 1 report. Update `Status` as each is closed and link
the resulting evidence in [`01-control-matrix.md`](01-control-matrix.md).

| ID | Gap | Criteria | Priority | Owner | Effort | Status |
|---|---|---|---|---|---|---|
| **G1** | **Secrets management** — prod keys were exposed in a OneDrive-synced folder; rotate all 5 (Supabase service-role, Clerk, Stripe, OpenAI, Resend); write a key-management/rotation policy; confirm no secrets in VCS | CC6.7 | Founder+Eng | S | 🔴 rotation pending |
| **G2** | **Change management** — enable GitHub **branch protection** on `main`/`enterprise` (require PR review + passing checks, no direct pushes) + add a **CI workflow** (typecheck/lint/build gate) | CC8.1, CC5.2 | Eng | S | 🔴 |
| **G3** | **Vulnerability management** — enable **Dependabot** (deps + security updates) and **CodeQL** code scanning | CC7.1 | Eng | S | 🔴 |
| **G4** | **Monitoring/incident detection** — add **Sentry** (error + performance) with alerting; document log review | CC7.2 | Eng | S | 🔴 |
| **G5** | **MFA enforcement** — enforce MFA in Clerk for all users and especially admins; capture config evidence | CC6.1 | Eng | S | 🔴 |
| **G6** | **Governance** — appoint a **Security Owner**; leadership sign-off on the security program | CC1.2 | Founder | S | 🔴 |
| **G7** | **Policies + risk assessment + IR** — approve the policy pack; complete the **risk assessment** + risk register; write the **incident-response runbook**; add `SECURITY.md` | CC1–CC9 | SecOwner | M | 🔴 drafts in `policies/` |
| **G8** | **Tenant isolation** — document the app-layer isolation control and add **automated isolation tests** (org A cannot read org B) | C1.2, CC6.1 | Eng | M | 🔴 |
| **G9** | **People controls** — background-check process, onboarding/offboarding checklist, **quarterly access reviews**, security-awareness training + AUP acknowledgment | CC1.4/1.5, CC6.3/6.4 | SecOwner | M | 🔴 |
| **G10** | **BCP/DR** — document RPO/RTO, Supabase backup/PITR settings, and perform a **restore test** | CC7.5, CC9.1 | Eng | S | 🔴 |
| **G11** | **Vendor management** — finish subprocessor inventory; collect each vendor's SOC 2/ISO; sign **DPAs**; note CSOCs | CC9.2 | SecOwner | M | 🟡 inventory started |
| **G12** | **Insurance** — confirm cyber/E&O coverage | CC9.3 | Founder | S | 🔴 |

## Effort key
S = small (hours–1 day) · M = medium (multi-day) · L = large (weeks)

## Fast wins I (Eng/AI) can PR immediately
- **G2** CI workflow + branch-protection settings guide
- **G3** Dependabot + CodeQL config
- **G4** Sentry integration
- **G8** tenant-isolation test scaffold
- **G7/G1** policy drafts (in `policies/`) + `SECURITY.md` + key-management policy

## Owner-only (dashboard/people)
- **G1** actual key rotation (provider logins) · **G5** Clerk MFA enforcement toggle
- **G6/G9/G12** governance, people controls, insurance
