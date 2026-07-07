# Data Classification & Retention Policy

- **Owner:** Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual

## 1. Purpose
Classify data by sensitivity and define retention, handling, and disposal — the core of the
Confidentiality (C1) criteria.

## 2. Classification
| Class | Examples | Handling |
|---|---|---|
| **Confidential** | Candidate PII, résumés, application data, recruiter↔candidate messages, org member data, secrets | Encrypt in transit + at rest; access limited to owning org + admins; audit-logged; not shared with third parties except approved subprocessors |
| **Internal** | Application/audit logs, metrics, source code | Restricted to Eng/admin |
| **Public** | Marketing site, blog | No restriction |

## 3. Handling requirements (Confidential)
- **Tenant isolation:** confidential customer data is scoped to the owning `org_id` in
  application code; cross-tenant access is prohibited and tested.
- **Encryption:** TLS 1.2+ in transit; AES-256 at rest (Supabase).
- **Access logging:** actions such as export and deletion are recorded in `enterprise_audit_logs`.
- **Minimization:** collect only what the service requires.

## 4. Retention & disposal
- Customer orgs configure **data retention** (`data_retention_days`) with an action of
  **anonymize** or **delete**; enforcement runs via `cron/enterprise-retention`.
- On account termination, customer data is deleted/anonymized per contract terms.
- Backups age out per Supabase backup retention.

## 5. Data-subject / customer requests
- Access, export, and deletion requests are handled via the compliance module
  (`/api/enterprise/compliance/requests`) and fulfilled within the timeframe required by
  applicable law/contract.

## 6. Confidentiality commitments
- Confidentiality obligations are set out in customer MSAs/DPAs and employee/contractor NDAs.

## 7. Related criteria
C1.1–C1.7, CC6.5/6.6.

## 8. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
