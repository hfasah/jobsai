# Roadmap — SOC 2 Type 1 in <3 months (manual, no compliance platform)

Deal-gated. Type 1 attests to control **design** at a point in time, so manual evidence is
feasible. The long-pole is booking the auditor — do that in Week 1.

## Phase 0 — Kickoff (Week 1)
- [ ] **Founder:** appoint a **Security Owner** (G6).
- [ ] **Founder:** shortlist + **book an auditor** who accepts manual evidence for Type 1
      (e.g. Johanson Group, Prescient Assurance, Insight Assurance). Confirm timeline + fee.
- [ ] **Founder+Eng:** **rotate the exposed keys** (G1) and confirm none are in a synced folder.
- [ ] **AI/Eng:** land the readiness repo (this `docs/soc2/`) + `SECURITY.md`.

## Phase 1 — Policies & governance (Weeks 1–3)
- [ ] Approve the **policy pack** in `policies/` (G7). SecOwner signs; date each policy.
- [ ] Complete the **risk assessment** + risk register (G7).
- [ ] Write the **incident-response runbook** (G7).
- [ ] Finish the **vendor inventory**, request vendor SOC 2s, sign **DPAs** (G11).

## Phase 2 — Technical controls (Weeks 2–6, mostly small PRs)
- [ ] **CI + branch protection** on `main`/`enterprise` (G2).
- [ ] **Dependabot + CodeQL** (G3).
- [ ] **Sentry** error monitoring + alerts (G4).
- [ ] **MFA enforced** in Clerk (G5) — capture evidence.
- [ ] **Tenant-isolation tests** + doc (G8).
- [ ] **BCP/DR** doc + **backup restore test** (G10).

## Phase 3 — People controls (Weeks 3–8)
- [ ] Onboarding/offboarding checklist; **quarterly access review** performed once (G9).
- [ ] **Security-awareness training** + AUP acknowledgment for all staff (G9).
- [ ] Background-check process documented (G9).
- [ ] Confirm **cyber/E&O insurance** (G12).

## Phase 4 — Evidence & audit (Weeks 8–12)
- [ ] Populate `evidence/` with artifacts; link each from the control matrix.
- [ ] Internal **readiness review** — walk the control matrix; ensure every criterion has a control + evidence.
- [ ] Auditor **readiness/gap review** → remediate any last items.
- [ ] **Type 1 fieldwork** (point-in-time) → report.

## RACI (starter)
| Area | Responsible | Accountable |
|---|---|---|
| Policies, risk, vendor, people | SecOwner | Founder |
| Technical controls (CI, scanning, monitoring, isolation) | Eng/AI | SecOwner |
| Key rotation, MFA toggle, insurance, auditor contract | Founder | Founder |
| Evidence assembly + control matrix upkeep | SecOwner | SecOwner |

_A tool (Vanta/Drata) is **not** required for Type 1. Reconsider before **Type 2**, where
continuous evidence collection over 3–12 months makes automation worth the spend._
