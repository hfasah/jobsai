# Access Control Policy

- **Owner:** Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual

## 1. Purpose
Ensure only authorized individuals access in-scope systems and confidential data, at the
minimum level required.

## 2. Scope
Clerk (identity), Supabase, Vercel, GitHub, Google Workspace, and the Enterprise
application, plus all personnel and customer org members.

## 3. Policy
### 3.1 Authentication
- All access is authenticated via **Clerk**. **Multi-factor authentication (MFA) is required**
  for all users and **enforced** for platform administrators and all internal staff on
  Clerk, GitHub, Vercel, Supabase, and Google Workspace.
- Passwords follow the Password & Authentication Policy; SSO is preferred where available.

### 3.2 Authorization (least privilege)
- Customer org members are authorized via role-based permissions
  (`enterprise_role_permissions`); all data access is **scoped to their `org_id`** in
  application code (`getMyOrg` / `getMyMembership`), enforcing tenant isolation.
- **Platform administrators** are limited to the allow-list `ADMIN_USER_IDS`. Admin
  capabilities (support, user impersonation via Clerk sign-in tokens, credits, suspension)
  are restricted and **audit-logged** (`enterprise_audit_logs`).
- Engineering access to production consoles (Vercel/Supabase/Clerk/GitHub) is limited to
  those who need it.

### 3.3 Provisioning & deprovisioning
- Access is granted on a documented request during onboarding, at least privilege.
- Access is **revoked within 24 hours** of a person leaving or changing role (offboarding checklist).

### 3.4 Access reviews
- The Security Owner performs a **quarterly access review** of all systems and removes
  unneeded access. Reviews are recorded as evidence.

### 3.5 Secrets & keys
- Application secrets live only in **Vercel encrypted environment variables**, never in
  source control (enforced by `.gitignore`), never in shared/synced folders. Rotation per
  the Encryption/Key-Management Policy.

## 4. Roles & responsibilities
- **Security Owner:** approves access, runs reviews, manages the allow-list changes.
- **Eng:** implements RBAC + isolation controls; captures evidence.

## 5. Related criteria
CC6.1–CC6.8, CC5.2, C1.2.

## 6. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
