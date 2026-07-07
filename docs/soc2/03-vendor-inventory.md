# Vendor / Subprocessor Inventory

Subservice organizations and vendors that process or store in-scope data. For each,
track the compliance report (SOC 2 / ISO 27001), whether a **DPA** is signed, the data
they touch, and the **Complementary Subservice Organization Controls (CSOCs)** JobsAI
relies on. (Carve-out method — see `00-scope-and-system-description.md` §6.)

| Vendor | Purpose | Data processed | Compliance report | DPA signed | CSOC relied upon |
|---|---|---|---|---|---|
| **Vercel** | Hosting, edge, CI/build, env secrets | Requests, encrypted env, logs | SOC 2 Type 2 | ☐ | TLS, infra security, env encryption |
| **Supabase** | Postgres DB + object storage | All customer/candidate PII, resumes | SOC 2 Type 2 | ☐ | Encryption at rest, backups/PITR, physical security |
| **Clerk** | Authentication / identity | User identity, sessions, MFA | SOC 2 Type 2 | ☐ | Auth security, MFA, session mgmt |
| **Stripe** | Payments / billing | Billing contact, card (Stripe-vaulted) | SOC 2 / PCI DSS | ☐ | PCI cardholder handling |
| **Resend** | Transactional + candidate email; inbound intake | Email content, recipient addresses | SOC 2 | ☐ | Email transport security |
| **OpenAI** | AI (matching/drafting/screening) | Prompts derived from candidate/job data | SOC 2 Type 2 | ☐ | **No training on API data** (confirm terms) |
| **DeepSeek** | AI (fast tier, enterprise) | Prompts | Confirm | ☐ | Data handling terms — **verify** |
| **Google (OAuth)** | Calendar + Gmail send | Calendar events, sent email; (verification in progress) | SOC 2 / ISO | ☐ | OAuth token handling |
| **Microsoft (Entra/Graph)** | Outlook/365 send + calendar | Calendar/email send | SOC 2 / ISO | ☐ | OAuth token handling |
| **Skyvern** | Browser-agent auto-apply (consumer) | Application data | Confirm | ☐ | Noted; primarily consumer scope |
| **PostHog** | Product/traffic analytics | Usage events (proxied) | SOC 2 | ☐ | Analytics data minimization |
| **Pipedrive** | One-way CRM push (customer-directed) | Company/contact/deal data | SOC 2 / ISO | ☐ | Export at customer direction |
| **GitHub** | Source control, CI, scanning | Source code (no secrets) | SOC 2 / ISO | ☐ | Access control, branch protection |
| **Google Workspace** | Internal identity/email | Internal comms, access | SOC 2 / ISO | ☐ | Identity, offboarding |

## To do (G11)
- [ ] Collect the latest SOC 2 / ISO report for each ☐ vendor (request via their trust portal).
- [ ] Sign a **DPA** with each vendor that processes personal data.
- [ ] Confirm **no-training / data-use** terms for OpenAI and **DeepSeek** (DeepSeek especially — verify data residency + training terms).
- [ ] Record CSOCs in the system description so the auditor sees the shared-responsibility boundary.

> Maintain a public **subprocessor list** (e.g. `app.jobsai.work/subprocessors`) — enterprise customers and DPAs frequently require it.
