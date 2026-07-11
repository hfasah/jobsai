# Evidence — Secrets Exposure & Key Rotation (July 2026)

**Control:** CC6.7 (secrets management), CC7.3–7.5 (incident response), CC6.1
**Gap:** G1 · **Status:** 🟡 in progress (Wave 1 closed + verified; Wave 2 pending)

## Incident summary
Production secrets were found in `web/.env.local`, which sat in a **cloud-synced
(OneDrive) folder** — meaning the working-tree copy was replicated to cloud storage.
The file was correctly git-ignored (never committed), but the sync path constituted an
exposure. Handled per the Incident Response Policy: identify → rotate → **verify old key
revoked** → verify production healthy on new keys → remove from the synced file.

## Verification method
Each old (exposed) key was tested directly against its provider API; a `401/403`
("invalid/incorrect key") confirms revocation. Production health was confirmed via
public + auth-gated endpoints returning expected codes (200/307/403, not 500).

## Wave 1 — rotated + VERIFIED revoked (2026-07-09)
| Secret | Old key test | Result |
|---|---|---|
| Clerk secret | Clerk API → 401 | ✅ revoked |
| Stripe secret | Stripe API → 401 | ✅ revoked |
| Supabase `service_role` (legacy JWT) | REST → 401 | ✅ revoked (legacy keys disabled) |
| OpenAI | `/v1/models` → 401 "Incorrect API key" | ✅ revoked |
| Resend | `/api-keys` → "API key is invalid" | ✅ revoked |
| LiveAvatar | `/v1/sessions/token` → 401 | ✅ revoked |

Production verified healthy on the new keys (both `jobsai-web` + `jobsai-enterprise`):
`app.jobsai.work/enterprise/blog` 200, `/launch` 307, admin API 403.

## Wave 2 — additional exposed secrets found in the same file (PENDING rotation)
Discovered during file cleanup; still to rotate + verify:
| Secret | Status (2026-07-09) |
|---|---|
| DeepSeek API key | 🔴 still live |
| Adzuna app key | 🔴 still live |
| JSearch (RapidAPI) key | 🔴 still live |
| Merge API key | ⚪ untested — rotate |
| Google OAuth client secret (`GOCSPX-…`) | ⚪ rotate (ties to OAuth verification) |
| Microsoft (Entra) client secret | ⚪ rotate (was pasted raw into the file) |
| Stripe webhook signing secret | ⚪ rotate |
| Resend webhook signing secret | ⚪ rotate |
| PostHog personal API key | 🟡 likely revoked (403) — confirm |

## Remediation actions taken
- ✅ Wave 1 (6 keys) rotated in providers; new keys deployed to Vercel (both projects, Prod+Preview); old keys revoked and verified dead.
- ✅ `web/.env.local` cleaned: all secret values blanked, stray pasted secret material (a Microsoft client secret + terminal output) removed, header added prohibiting secrets in the file.
- ✅ Confirmed `.env*` is git-ignored (never committed).

## Follow-up (to fully close G1)
- [ ] Rotate the **Wave 2** secrets above; verify each old key → revoked.
- [ ] **Move the repository out of the cloud-synced path** (root cause) or exclude it from sync.
- [ ] Adopt the Encryption/Key-Management Policy: secrets only in Vercel; **test/dev creds for local dev**; documented rotation cadence.
- [ ] Update `../../02-gap-register.md` G1 to ✅ once Wave 2 is verified.
