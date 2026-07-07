# Change Management Policy

- **Owner:** Engineering / Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual

## 1. Purpose
Ensure changes to in-scope production systems are authorized, reviewed, tested, and traceable.

## 2. Scope
The Enterprise application codebase (`hfasah/jobsai`), its Vercel deployments, and
database migrations (`web/supabase/`).

## 3. Policy
### 3.1 Source control & review
- All changes are made via **pull requests**; direct pushes to `main` and `enterprise` are
  **blocked by branch protection**.
- Each PR requires **at least one review approval** and **passing status checks** before merge.
- PRs and their reviews/approvals are retained in GitHub as the change record.

### 3.2 Testing & quality gates
- CI runs typecheck, lint, and build on every PR; Vercel preview builds must succeed.
- A change may not merge with failing checks.

### 3.3 Database changes
- Schema changes are versioned SQL migrations reviewed in the same PR flow and applied to
  the shared Supabase in a controlled manner.

### 3.4 Deployments
- Deploys are performed by Vercel from protected branches on merge. Rollback is by revert PR
  or Vercel redeploy of a prior build.

### 3.5 Segregation of duties
- The author of a change does not solely approve and deploy it without independent review;
  branch protection enforces the review gate.

### 3.6 Emergency changes
- Emergency fixes follow the same PR/review flow; if expedited, they are reviewed
  retrospectively within 1 business day and documented.

## 4. Related criteria
CC8.1–CC8.3, CC5.2.

## 5. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
