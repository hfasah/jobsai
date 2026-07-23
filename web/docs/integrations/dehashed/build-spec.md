# Build Spec — DeHashed Integration (technical guardrails)

Status: **not built.** Build only after (a) the client's use case is confirmed as
own-data / security exposure monitoring, and (b) the AUP + contract clauses are
attorney-approved. Gated to the one requesting client via entitlement.

## Guardrails

| Guardrail | Implementation |
|---|---|
| **BYO key only** | Client pastes her **own** DeHashed API key in Settings → Integrations → DeHashed. Stored **encrypted at rest**, **server-side only** — never sent to the browser. No shared JobsAI key, ever. |
| **Server-side proxy** | `POST /api/enterprise/integrations/dehashed/search` — Clerk-authed, org-scoped, `requireFeature("dehashed")` gated. Loads the org's key, calls DeHashed server-to-server, returns results. Key never reaches the client. |
| **Click-through AUP gate** | On first use (and on AUP version bumps) show `consent-copy.md`; user must check all boxes and accept. Record `{ user_id, aup_version, accepted_at }`. Block the search route until accepted. |
| **Audit log** | Every query writes `dehashed_search_log` (`org_id, user_id, query_field, query_term, result_count, created_at`). Visible to org admins; append-only. |
| **No breach-data storage** | Results proxied live and displayed only — **not persisted**. Optional user-initiated export re-runs the query. Passwords/hashes masked until explicitly revealed. |
| **Entitlement gating** | Behind a `dehashed` feature flag → only the requesting client's org sees it. |
| **In-product warnings** | Persistent banner + result footer per `consent-copy.md` (not for FCRA/employment; you're responsible; searches logged). |
| **Credit visibility** | Surface DeHashed credits used/remaining so billing isn't a surprise. |

## Data model (proposed)
- Encrypted key: reuse the org integration-credentials pattern (e.g. an encrypted column / secrets store keyed by `org_id`). Do **not** log or return the key.
- `dehashed_aup_acceptance` (org_id, user_id, aup_version, accepted_at).
- `dehashed_search_log` (id, org_id, user_id, query_field, query_term, result_count, created_at).

## Open items before build
- **Confirm DeHashed's live API spec** — exact base URL, auth scheme (API key header vs. basic auth), request format (GET vs. POST JSON), searchable fields, response shape, and rate/credit model. The public docs page returns **403 to bots**, so this needs a logged-in look at https://dehashed.com/api (or DeHashed's dashboard docs).
- **Confirm scope** — own-domain/own-data monitoring UI vs. general search. Scope the UI to reinforce the neutral-conduit posture.
- **Attorney sign-off** on AUP + contract clauses (FCRA + RI Identity Theft Protection Act).

## Effort
~1 day once the spec is confirmed and legal is approved: 1 encrypted settings field + integrations card, 1 proxy route, 1 consent gate, 1 audit-log table, 1 search UI + results component.
