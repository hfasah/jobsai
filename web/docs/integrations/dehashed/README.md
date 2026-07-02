# DeHashed Integration — Reference Docs

Reference material for a **per-client** DeHashed breach-data search integration.
Status: **planned / not built.** Requested by a US (Rhode Island) enterprise client.

> ⚠️ **The two legal documents here are DRAFTS and NOT LEGAL ADVICE.** They are a
> starting point for a Rhode Island tech-transactions attorney, not final or
> enforceable text. Bracketed `[...]` items are placeholders. Counsel must review
> before use — especially the **FCRA** and **RI Identity Theft Protection Act**
> points.

## Contents
- [`acceptable-use-policy.md`](./acceptable-use-policy.md) — the AUP customers agree to (DRAFT).
- [`contract-clauses.md`](./contract-clauses.md) — reps/warranties, indemnification, limitation of liability, disclaimer for the master agreement (DRAFT).
- [`consent-copy.md`](./consent-copy.md) — the short in-product click-through consent text.
- [`build-spec.md`](./build-spec.md) — the technical guardrails + implementation plan.

## Why the guardrails matter (one-paragraph summary)
DeHashed returns leaked/breached personal data. Used in a **recruiting** context it
can trigger **FCRA** (US employment screening) and **GDPR/RI privacy** liability.
The defensible posture is: the client uses **her own** DeHashed account/key
(JobsAI is a neutral conduit), scoped to **legitimate own-data / security
exposure monitoring**, behind a signed agreement + click-through AUP + audit log —
**not** candidate surveillance. A contract shifts risk between JobsAI and the
client but does **not** bind third-party data subjects or waive statutory law, so
attorney review + these engineering guardrails are both required.
