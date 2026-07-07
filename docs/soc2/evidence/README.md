# Evidence

Drop auditor-facing evidence artifacts here and **link each from the control matrix**
(`../01-control-matrix.md`). For a Type 1, evidence shows a control is **designed and in
place** as of the audit date — screenshots, config exports, and settings are sufficient.

## Suggested layout
```
evidence/
  access/         Clerk MFA config, user list, ADMIN_USER_IDS, quarterly access review CSV
  change-mgmt/    GitHub branch-protection settings, sample PR with review, CI run
  vuln-mgmt/      Dependabot config + alerts, CodeQL scan result
  monitoring/     Sentry project + alert config, sample log review
  encryption/     Vercel env-encryption note, Supabase encryption/backup settings, HSTS/CSP headers
  data/           Retention settings screenshot, DSAR fulfillment example, audit-log sample
  vendors/        Each subprocessor's SOC 2/ISO report + signed DPA
  bcdr/           Backup config + restore-test record, RPO/RTO
  people/         Onboarding/offboarding checklist, training completion, signed AUPs
  governance/     Security Owner appointment, approved+dated policies, risk assessment
```

## Rules
- **No secrets** — redact tokens/keys in screenshots. Never commit real credentials.
- Prefer **dated** artifacts (the report is point-in-time).
- Large exports can live in a shared drive; link them from the control matrix instead of committing.

> This folder is intentionally mostly empty until controls are implemented. Populate it as
> gap-register items close.
