# JobsAI — SOC 2 Type 1 Readiness

This directory is JobsAI's **auditor-ready readiness package** for a SOC 2 **Type 1**
attestation. It is maintained manually (no compliance-automation platform for Type 1);
the auditor pulls evidence directly from the artifacts here plus the native tooling
(GitHub, Clerk, Vercel, Supabase, Google Workspace, Sentry).

> **Report:** SOC 2 Type 1 (design of controls at a point in time)
> **Trust Services Criteria:** Security (CC1–CC9) + **Confidentiality (C1)**
> **In scope:** the Enterprise platform — `app.jobsai.work` — and the shared
> infrastructure it depends on (Supabase, Clerk, Vercel, secrets).
> **Out of scope:** the consumer job-seeker app internals (`www.jobsai.work`),
> except where it shares the in-scope infrastructure.

## Contents
| File | Purpose |
|---|---|
| [`00-scope-and-system-description.md`](00-scope-and-system-description.md) | System boundary, data flows, components, users, subservice orgs |
| [`01-control-matrix.md`](01-control-matrix.md) | Every CC/C criterion → control → evidence → owner → status (**the tracker**) |
| [`02-gap-register.md`](02-gap-register.md) | Prioritized open gaps + remediation status |
| [`03-vendor-inventory.md`](03-vendor-inventory.md) | Subprocessors / subservice organizations |
| [`04-roadmap.md`](04-roadmap.md) | <3-month plan to the Type 1 report |
| [`policies/`](policies/) | The policy pack (drafts + index) |
| [`evidence/`](evidence/) | Evidence artifacts the auditor reviews |

## How to use this
1. **Own it** — assign a Security Owner (see CC1). They approve policies and keep this package current.
2. **Close gaps** — work the [gap register](02-gap-register.md); update the [control matrix](01-control-matrix.md) status as each control is implemented + evidenced.
3. **Collect evidence** — drop artifacts (screenshots, exports, configs) into [`evidence/`](evidence/) and link them from the control matrix.
4. **Book the auditor** early — that's the long-pole for a <3-month target. Tell them "manual evidence, no compliance platform."

## Status legend
- ✅ **Implemented + evidenced** — control operates and an artifact is linked.
- 🟡 **Partial** — exists but needs hardening or evidence.
- 🔴 **Gap** — not yet implemented.
- 👤 **Owner** — `SecOwner` (to assign), `Eng`, `Founder`.

_Last updated: see git history. This document is itself evidence of a documented security program (CC1/CC2)._
