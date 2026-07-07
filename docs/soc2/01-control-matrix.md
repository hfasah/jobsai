# Control Matrix — Security (CC1–CC9) + Confidentiality (C1)

The tracker. Each row: criterion → the control → where the evidence lives → owner → status.
Update status as controls are implemented and evidence is linked. Status legend in
[`README.md`](README.md). Gap IDs (`G#`) link to [`02-gap-register.md`](02-gap-register.md).

## CC1 — Control Environment
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC1.1 | Documented security program & policies (this repo) | `docs/soc2/`, `policies/` | SecOwner | 🟡 drafts, need approval |
| CC1.2 | Board/leadership oversight; Security Owner assigned | Org chart, SecOwner appointment | Founder | 🔴 G6 (assign owner) |
| CC1.3 | Defined roles & responsibilities | `policies/access-control-policy.md`, `enterprise_role_permissions` | SecOwner | 🟡 |
| CC1.4 | Background checks for personnel | HR records | Founder | 🔴 G9 |
| CC1.5 | Security awareness training + policy acknowledgment | Training records, signed AUP | SecOwner | 🔴 G9 |

## CC2 — Communication & Information
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC2.1 | Security/compliance info published internally + externally | `/enterprise/security`, `/enterprise/compliance`, `/privacy`, `/terms` | Eng | ✅ pages exist |
| CC2.2 | Internal comms channel for security matters | Slack/#security, IR runbook | SecOwner | 🔴 G7 |
| CC2.3 | External channel to report issues | `security@` inbox / `SECURITY.md` | SecOwner | 🔴 add SECURITY.md |

## CC3 — Risk Assessment
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC3.1 | Annual risk assessment (threats, likelihood, impact) | `policies/risk-assessment-policy.md` + risk register | SecOwner | 🔴 G7 |
| CC3.2 | Fraud risk considered | Risk register | SecOwner | 🔴 G7 |
| CC3.3 | Change/vendor risk evaluated | Vendor inventory, change policy | SecOwner | 🟡 |

## CC4 — Monitoring Activities
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC4.1 | Ongoing control monitoring | Control matrix reviews, dashboards | SecOwner | 🟡 |
| CC4.2 | Deficiencies tracked to resolution | `02-gap-register.md` | SecOwner | ✅ this register |

## CC5 — Control Activities
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC5.1 | Policies define control activities | `policies/` | SecOwner | 🟡 |
| CC5.2 | Segregation of duties (prod deploy vs review) | Branch protection, PR review | Eng | 🔴 G2 |
| CC5.3 | Technology controls enforced | `next.config.ts` headers, CI | Eng | 🟡 |

## CC6 — Logical & Physical Access
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC6.1 | Authentication via Clerk; **MFA enforced** for all + admins | Clerk config screenshot | Eng | 🔴 G5 (enforce+evidence) |
| CC6.2 | Least-privilege / RBAC | `enterprise_role_permissions`, `ADMIN_USER_IDS` | Eng | 🟡 document |
| CC6.3 | Access provisioning/deprovisioning (joiners/leavers) | Access-review + offboarding checklist | SecOwner | 🔴 G9 |
| CC6.4 | Quarterly access reviews | Review records | SecOwner | 🔴 G9 |
| CC6.5 | Encryption in transit (TLS/HSTS) | `next.config.ts` HSTS/CSP; Vercel TLS | Eng | ✅ |
| CC6.6 | Encryption at rest | Supabase AES-256, Vercel env encryption | Eng | ✅ document |
| CC6.7 | **Secrets management** (storage, rotation, no VCS) | `.gitignore`, Vercel env, `policies/encryption-policy.md` | Eng | 🔴 G1 (rotate + policy) |
| CC6.8 | Privileged access (admin impersonation) controlled + logged | `enterprise-audit.ts`, impersonation route | Eng | 🟡 verify logged |
| CC6.9 | Physical access | Vercel/Supabase (subservice) SOC 2 | — | ✅ carve-out |

## CC7 — System Operations
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC7.1 | Vulnerability management (dependency + code scanning) | Dependabot + CodeQL config | Eng | 🔴 G3 |
| CC7.2 | Monitoring / anomaly + incident detection | Sentry, Vercel logs, alerts | Eng | 🔴 G4 |
| CC7.3 | Incident response process | `policies/incident-response-policy.md` + runbook | SecOwner | 🔴 G7 |
| CC7.4 | Incident communication (customers/regulators) | IR policy, breach-notification steps | SecOwner | 🔴 G7 |
| CC7.5 | Recovery from incidents | BCP/DR policy, backup restore test | Eng | 🔴 G10 |

## CC8 — Change Management
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC8.1 | Changes via reviewed PRs; branch protection; CI checks | GitHub branch-protection + PR history + CI | Eng | 🔴 G2 |
| CC8.2 | Automated tests / typecheck gate before deploy | CI workflow, Vercel checks | Eng | 🟡 Vercel builds; no required CI |
| CC8.3 | Secure SDLC | `policies/secure-sdlc-policy.md` | Eng | 🔴 G7 |

## CC9 — Risk Mitigation
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| CC9.1 | Business continuity / disaster recovery | `policies/business-continuity-dr-policy.md`, RPO/RTO | Eng | 🔴 G10 |
| CC9.2 | Vendor / subservice risk management | `03-vendor-inventory.md`, `policies/vendor-management-policy.md`, signed DPAs | SecOwner | 🟡 inventory started |
| CC9.3 | Insurance (cyber/E&O) | Policy documents | Founder | 🔴 confirm coverage |

## C1 — Confidentiality
| # | Control | Evidence | Owner | Status |
|---|---|---|---|---|
| C1.1 | Data classification | `policies/data-classification-and-retention-policy.md`, scope §4 | SecOwner | 🟡 |
| C1.2 | Confidential data access restricted (tenant isolation) | `lib/enterprise.ts` org scoping + isolation tests | Eng | 🟡 G8 (tests+doc) |
| C1.3 | Retention limits + disposal | `cron/enterprise-retention`, retention settings | Eng | ✅ |
| C1.4 | Data-subject requests (access/export/delete) | `/api/enterprise/compliance/requests` fulfillment | Eng | ✅ |
| C1.5 | Audit trail of confidential-data actions | `enterprise_audit_logs` (`data.exported`, `data.deleted`, auth) | Eng | ✅ |
| C1.6 | Confidentiality commitments (contracts/NDAs) | MSA/DPA, employee NDAs | Founder | 🟡 |
| C1.7 | Secure disposal / anonymization | retention `anonymize`/`delete` action | Eng | ✅ |

---
**Summary:** ✅ ~12 controls already evidenced (encryption, audit log, retention, DSAR),
🟡 ~10 partial (need docs/hardening), 🔴 the rest are the [gap register](02-gap-register.md)
items — most are small PRs (CI, Dependabot, Sentry) or policy/people work.
