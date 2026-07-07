# Scope & System Description

## 1. Company & service
JobsAI operates an AI recruiting platform. The **Enterprise platform** (`app.jobsai.work`)
lets employers/recruiters/staffing agencies source, screen, communicate with, schedule,
and manage candidates, including a Recruiting CRM and compliance tooling.

## 2. Report scope
- **Report type:** SOC 2 Type 1 (design of controls at a specified date).
- **Trust Services Criteria:** Security (Common Criteria CC1–CC9) and **Confidentiality (C1)**.
- **System boundary (in scope):**
  - The Enterprise web application `app.jobsai.work` (Next.js, deployed on Vercel project `jobsai-enterprise`).
  - Shared data + identity infrastructure: **Supabase** (Postgres, storage), **Clerk** (authentication/identity), **Vercel** (hosting/build/edge, environment secrets).
  - Supporting integrations used by the Enterprise product (see `03-vendor-inventory.md`).
- **Out of scope:** consumer job-seeker app internals (`www.jobsai.work` / Vercel project `jobsai-web`), except the shared infrastructure listed above. The consumer app is a separate deployment; its product features are excluded.

## 3. System components
| Layer | Technology | Notes |
|---|---|---|
| Frontend/Backend | Next.js (App Router), TypeScript | One codebase, deployed as Vercel project `jobsai-enterprise` from the `enterprise` git branch |
| Hosting/Edge/CI-build | Vercel | TLS termination, env-var secret storage (encrypted), build + deploy |
| Identity/Auth | Clerk | SSO/OAuth, sessions, MFA capability, admin allow-list (`ADMIN_USER_IDS`) |
| Database | Supabase (Postgres) | Encryption at rest (AES-256), automated backups/PITR, service-role access from server code |
| Object storage | Supabase Storage | Resumes/documents |
| Email | Resend | Transactional + candidate/outreach email, inbound intake webhooks |
| AI | OpenAI / DeepSeek (via `lib/ai-client.ts`, tiers) | Matching, drafting, screening; no training on customer data (see vendor terms) |
| Browser-agent apply | Skyvern | Auto-apply (consumer-side; noted for completeness) |
| Calendar/Email connect | Google (OAuth) / Microsoft (Entra) | Interview scheduling + send; verification in progress |
| Analytics | PostHog | Product/traffic analytics (proxied) |
| CRM push | Pipedrive | One-way export at customer direction |
| Payments | Stripe | Subscriptions/billing |
| Source control | GitHub (`hfasah/jobsai`) | PR-based workflow; Vercel checks on PRs |

## 4. Data classification (in scope)
| Class | Examples | Handling |
|---|---|---|
| **Confidential — customer/candidate PII** | Candidate names, emails, résumés, application data, recruiter–candidate messages, org member data | Access restricted to the owning org (app-layer tenant scoping) + platform admins; encrypted in transit + at rest; retention configurable; DSAR supported |
| **Confidential — secrets** | API keys, DB service-role key, OAuth client secrets | Stored in Vercel encrypted env; excluded from VCS via `.gitignore` |
| **Internal** | Application logs, audit logs, metrics | Restricted to Eng/admin |
| **Public** | Marketing pages, blog | Public by design |

## 5. Users & access
- **Customers (org members):** recruiters/employers, role-scoped via `enterprise_role_permissions`; data isolated per org (`org_id` scoping in application code).
- **Platform administrators:** allow-listed via `ADMIN_USER_IDS`; access the admin portal (`/admin`) with elevated capabilities (support, impersonation via Clerk sign-in tokens, credits, suspension). Privileged actions are audit-logged.
- **Engineering:** GitHub + Vercel + Supabase + Clerk consoles.

## 6. Subservice organizations (carve-out method)
Vercel, Supabase, Clerk, Stripe, Resend, OpenAI, and Google/Microsoft are subservice
organizations relied upon for infrastructure/identity/processing. JobsAI uses the
**carve-out method**: their controls are excluded from JobsAI's description but their
own SOC 2 / ISO reports are tracked in `03-vendor-inventory.md`. Complementary
Subservice Organization Controls (CSOCs) are noted there.

## 7. Multi-tenant isolation (key confidentiality control)
Tenant isolation is enforced primarily at the **application layer**: every data query is
scoped by `org_id` via `getMyOrg(userId)` / `getMyMembership(userId)` (`lib/enterprise.ts`)
before access. This is a deliberate architecture (not database RLS for most tables). It is
documented here, covered by the Access Control Policy, and must be evidenced with
isolation tests (see gap register G8).

## 8. Point-in-time
The Type 1 report attests to control **design** as of the audit date (TBD). Controls are
listed in `01-control-matrix.md`.
