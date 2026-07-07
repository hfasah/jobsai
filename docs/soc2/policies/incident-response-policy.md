# Incident Response Policy

- **Owner:** Security Owner · **Approved by:** _<name>_ · **Version:** 1.0 (draft) · **Effective:** _<date>_ · **Review:** annual (+ after any incident)

## 1. Purpose
Define how JobsAI detects, responds to, communicates, and recovers from security incidents.

## 2. Scope
Any event that compromises (or threatens) the confidentiality, integrity, or availability
of in-scope systems or data — e.g. unauthorized access, data exposure, credential leak,
malware, or vendor breach.

## 3. Severity levels
| Sev | Definition | Target response |
|---|---|---|
| **SEV1** | Confirmed breach of confidential data or full outage | Immediate; all-hands |
| **SEV2** | Suspected compromise / partial impact | < 1 hour |
| **SEV3** | Minor/contained, no data impact | < 1 business day |

## 4. Process
1. **Detect** — via Sentry alerts, log review, vendor notice, or report to `security@jobsai.work`.
2. **Triage & declare** — Security Owner assigns severity + an incident lead.
3. **Contain** — revoke credentials/sessions, **rotate affected keys**, isolate systems.
4. **Eradicate & recover** — remove the cause, restore from clean backups, verify integrity.
5. **Notify** — see §5.
6. **Post-incident review** — within 5 business days: timeline, root cause, corrective actions;
   update controls and this policy.

## 5. Communication & breach notification
- **Internal:** incident channel; leadership informed for SEV1/2.
- **Customers:** for incidents affecting their data, notify **without undue delay** per
  contractual/DPA terms.
- **Regulators/individuals:** where legally required (e.g. GDPR 72-hour), the Security Owner
  coordinates notification with counsel.

## 6. Roles
- **Incident Lead:** runs the response. **Security Owner:** accountable, owns comms.
  **Eng:** containment/recovery.

## 7. Evidence
Incident tickets, timelines, and post-incident reviews are retained as audit evidence.

## 8. Related criteria
CC7.2–CC7.5, CC2.3.

## 9. Revision history
| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 draft | _<date>_ | AI assistant | Initial draft |
