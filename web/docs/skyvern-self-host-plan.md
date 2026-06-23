# Self-hosting Skyvern — implementation plan (cost lever #1)

**Goal:** run our own Skyvern instead of the hosted cloud API, to (a) cut
per-apply cost ~5–20× (from ~$0.80 to ~$0.05–0.20: raw LLM + browser infra only,
no Skyvern markup) and (b) remove the **shared-pool single point of failure** —
today one hosted org account out of credits takes down auto-apply for *everyone*.

The self-hosted server exposes the **same REST API** we already call
(`POST /v1/run/tasks`, `POST /v1/run/workflows`, `GET /v1/runs/{id}`,
`x-api-key` auth) on port **8000**. So this is mostly **infra + a base-URL swap**,
not an app rewrite.

---

## 0. The one code enabler (do first, ship anytime)

`SKYVERN_BASE` is currently hardcoded in `src/lib/skyvern.ts`:
```ts
const SKYVERN_BASE = "https://api.skyvern.com/v1";
```
Change to env-driven (default = cloud, so it's a no-op until set):
```ts
const SKYVERN_BASE = (process.env.SKYVERN_BASE_URL ?? "https://api.skyvern.com").replace(/\/$/, "") + "/v1";
```
Then the entire cutover is: set `SKYVERN_BASE_URL=https://agent.jobsai.work` +
`SKYVERN_API_KEY=<self-host key>` in Vercel. **One small PR, zero behavior change
until the env is set.** Everything else below is infra.

---

## 1. Architecture

```
jobsai.work (Vercel)  ──HTTPS──>  agent.jobsai.work  (our Skyvern server)
  agent-apply / webhook              ├─ Skyvern API (port 8000, x-api-key)
                                     ├─ headless Chromium (Playwright)
                                     ├─ Postgres (runs/workflows/artifacts)
                                     └─ outbound LLM calls (OpenAI/Anthropic)
        ▲                                         │
        └────────── webhook POST /api/webhooks/agent-apply ◀── on run complete
```
- Skyvern calls our existing webhook with `run_id` + `status` + `step_count` —
  **no webhook changes needed** (same payload contract).
- Browser profiles + workflows (lever #2) work the same on self-host.

## 2. Hosting options (pick one)

| Option | Effort | Fit |
|---|---|---|
| **Single VM + Docker Compose** (e.g. Hetzner/DO/Fly/EC2, 4 vCPU / 8–16 GB) | Low | **Recommended start.** `docker compose up -d` runs API + Postgres + browser. Cheapest, simplest. |
| Managed container (Render/Railway/Fly machines) + managed Postgres | Low-med | Less ops; slightly pricier. Good if you don't want to babysit a VM. |
| Kubernetes | High | Only if/when concurrency demands horizontal browser scaling. Premature now. |

**Recommended:** one VM, Docker Compose, managed-or-local Postgres, behind a
reverse proxy (Caddy/Traefik) for TLS at `agent.jobsai.work`.

### Sizing
Each concurrent apply ≈ one Chromium tab (RAM-heavy). Budget ~1–1.5 GB/concurrent
run. Start at **4 vCPU / 16 GB** (~8–10 concurrent applies) and add a daily/concurrency
cap. Scale vertically first; add a second worker VM when concurrency saturates.

## 3. Provisioning steps

1. **DNS + TLS:** `agent.jobsai.work` → VM IP; Caddy/Traefik auto-TLS. Lock it
   down: allow inbound 443 only; the API is reachable only from our Vercel egress
   (Skyvern's own `x-api-key` is the auth, but restrict at the proxy too).
2. **Clone + configure:** `git clone Skyvern-AI/skyvern`, `cp .env.example .env`.
3. **`.env` essentials:**
   - LLM: `OPENAI_API_KEY` (and/or `ANTHROPIC_API_KEY`); set the model envs.
   - `DATABASE_URL` → Postgres (managed recommended for durability).
   - Generate/declare the server **`x-api-key`** (Skyvern prints/accepts a local
     key on first run) → this becomes our `SKYVERN_API_KEY`.
   - Proxy/residential-IP config if we keep `proxy_location` behavior (see Risks).
4. **`docker compose up -d`**, confirm API on `:8000` and a test
   `GET /v1/runs/<bogus>` returns 404 (auth OK) via our `checkSkyvernHealth`.
5. **Persistent volumes** for Postgres + Skyvern artifacts (screenshots/recordings).

## 4. Cutover (staged, reversible)

1. Ship the §0 env enabler.
2. Stand up the server; validate with a **manual `run_task`** against a real job
   (curl) end-to-end incl. our webhook.
3. **Canary:** point a single internal/admin account at self-host (we can gate by
   reading `SKYVERN_BASE_URL` per-request later, or just flip the env in a preview
   deploy first). Run ~10 real applies across ATS types; record `step_count` +
   success rate via the existing `apply_attempts` cost columns.
4. Compare success rate + cost vs cloud. If green, flip `SKYVERN_BASE_URL` in prod.
5. **Rollback** = unset `SKYVERN_BASE_URL` (instantly back to cloud). Keep the
   hosted key funded with a small buffer during the transition.

## 5. What carries over for free
- Metering (PR #150) — `step_count` from self-host runs meters identically.
- Profile reuse / workflows (PR #151) — same endpoints; recreate the apply
  workflow on the self-host instance and update `SKYVERN_APPLY_WORKFLOW_ID`.
- Ops alerting (PR #149) — `checkSkyvernHealth` + `SkyvernServiceError` work
  against any base URL; "out of credits" becomes "LLM key/quota" — update the
  `credits` copy mapping once self-hosted (LLM billing replaces Skyvern credits).

## 6. New cost model (post-cutover)
Cost ≈ **LLM tokens per run + VM amortization**, not Skyvern credits.
- LLM: a multi-step apply ≈ tens of vision+text calls. With Anthropic/OpenAI,
  ballpark ~$0.05–0.20/apply (model-dependent — measure on the canary).
- VM: a $40–80/mo box absorbs hundreds–thousands of applies → fractions of a cent
  amortized. The metering credit rate (`BILLED_CREDITS_PER_STEP`) can then drop or
  the margin widens — revisit pricing after measuring real LLM cost/apply.

## 7. Risks & mitigations
- **Residential proxies / geo gates:** the hosted cloud bundles proxy IPs
  (`proxy_location`). Self-host runs from the VM's datacenter IP → some boards
  geo-block or bot-flag. **Mitigation:** plug a residential-proxy provider
  (Bright Data/Oxylabs/IPRoyal) into Skyvern's proxy config; keep
  `proxyLocationForLocation` mapping. Budget for proxy cost in the per-apply math.
- **CAPTCHA / anti-bot:** cloud may have tuned solving. Validate success rate on
  the canary; wire a CAPTCHA-solver key if needed.
- **Reliability/ops:** we now own uptime. Mitigations: health checks +
  auto-restart (Docker `restart: always`), the existing ops-alert email on
  failures, and the **instant env-unset rollback** to cloud.
- **Scaling:** browser RAM is the bottleneck — enforce a concurrency cap + the
  existing per-tier daily caps; scale the VM before lifting caps.
- **Version drift:** pin the Skyvern image/tag; the API is stable but re-validate
  `run_task`/`run_workflows`/profile endpoints after upgrades.

## 8. Effort estimate
- §0 enabler: ~30 min (one PR).
- Provision VM + compose + TLS + `.env`: ~half a day.
- Canary validation + cost/success measurement: ~1–2 days of real applies.
- Proxy integration (if geo-blocking shows up): ~half a day.

**Owner split:** you provision the VM/DNS/LLM+proxy keys; I do the §0 PR, the
canary validation harness, and the copy/config updates (health mapping, workflow
recreation). Total ~2–3 working days spread over a measurement window.
