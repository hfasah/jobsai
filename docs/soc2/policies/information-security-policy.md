# Information Security Policy (Master)

- **Owner:** Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual

## 1. Purpose
Establish JobsAI's commitment to protecting the confidentiality, integrity, and availability
of customer, candidate, and company data, and to satisfy the SOC 2 Security and
Confidentiality criteria.

## 2. Scope
All JobsAI personnel, contractors, systems, and data within the in-scope boundary
(`app.jobsai.work` and shared Supabase/Clerk/Vercel infrastructure — see the system
description). All subordinate policies in this pack fall under this master policy.

## 3. Principles
- **Least privilege** — access is granted only as needed and reviewed regularly.
- **Defense in depth** — controls at network, application, identity, and data layers.
- **Encryption everywhere** — data encrypted in transit (TLS 1.2+) and at rest (AES-256).
- **Secure by default** — security headers, MFA, PR review, and scanning are baseline.
- **Data minimization & confidentiality** — collect/retain only what's needed; isolate per tenant.
- **Accountability** — actions on confidential data are logged and auditable.

## 4. Governance
- The **Security Owner** owns this program, maintains the policy pack and control matrix,
  runs the annual risk assessment, and reports to leadership.
- Leadership provides oversight and resources and approves policies.

## 5. Requirements (summary — see subordinate policies)
- **Access:** Clerk authentication with **MFA enforced**; RBAC via `enterprise_role_permissions`;
  admin access allow-listed; quarterly access reviews; timely deprovisioning.
- **Change:** all production changes go through reviewed pull requests with passing CI on
  protected branches; no direct pushes to `main`/`enterprise`.
- **Vulnerability:** automated dependency (Dependabot) and code (CodeQL) scanning; timely patching.
- **Monitoring:** error/anomaly monitoring (Sentry) and log review; defined incident response.
- **Data:** classification, retention limits + disposal, and data-subject-request handling.
- **Vendors:** subprocessors risk-assessed; SOC 2/ISO reports tracked; DPAs signed.
- **Secrets:** stored only in Vercel encrypted env; never committed; rotated per the Encryption/Key-Management Policy.

## 6. Enforcement
Violations may result in access revocation and disciplinary action. Exceptions require
documented Security-Owner approval with a remediation date.

## 7. Related criteria
CC1–CC9, C1 (all).

## 8. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
