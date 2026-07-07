# Policy Pack

Drafts of the policies a SOC 2 auditor expects. Each must be **reviewed, approved, dated,
and version-controlled** by the Security Owner before the audit (an unapproved draft is not
an operating control). Re-review at least annually.

## Status
| Policy | File | Status |
|---|---|---|
| Information Security (master) | [`information-security-policy.md`](information-security-policy.md) | 🟡 draft |
| Access Control | [`access-control-policy.md`](access-control-policy.md) | 🟡 draft |
| Change Management | [`change-management-policy.md`](change-management-policy.md) | 🟡 draft |
| Incident Response | [`incident-response-policy.md`](incident-response-policy.md) | 🟡 draft |
| Data Classification & Retention | [`data-classification-and-retention-policy.md`](data-classification-and-retention-policy.md) | 🟡 draft |
| Vendor Management | [`vendor-management-policy.md`](vendor-management-policy.md) | 🟡 draft |
| Risk Assessment | `risk-assessment-policy.md` | 🔴 to draft |
| Encryption / Key Management | `encryption-policy.md` | 🔴 to draft (ties to G1) |
| Secure SDLC | `secure-sdlc-policy.md` | 🔴 to draft |
| Business Continuity / DR | `business-continuity-dr-policy.md` | 🔴 to draft (G10) |
| Acceptable Use | `acceptable-use-policy.md` | 🔴 to draft |
| Password & Authentication | `password-authentication-policy.md` | 🔴 to draft |

## Standard template (use for the 🔴 ones)
```
# <Policy Name>
- Owner: Security Owner   - Approved by: <name>   - Version: 1.0   - Effective: <date>   - Review: annual
## 1. Purpose
## 2. Scope (systems, data, people in scope)
## 3. Policy (the actual requirements/rules)
## 4. Roles & responsibilities
## 5. Enforcement / exceptions
## 6. Related controls (CC/C mapping)
## 7. Revision history
```

> Ask the AI assistant to draft any 🔴 policy — they'll be seeded from your actual stack + control matrix, same as the drafts here.
