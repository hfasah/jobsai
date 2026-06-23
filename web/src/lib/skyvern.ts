// Skyvern browser-agent client — opens any job URL, fills the form, handles CAPTCHA, submits.
// Uses the current Run Tasks API: POST /v1/run/tasks (prompt-based), GET /v1/runs/{id}.
// Docs: https://www.skyvern.com/docs/running-tasks/api-spec

const SKYVERN_BASE = "https://api.skyvern.com/v1";
// Task creation just queues a run and returns a run_id — it should be fast.
// Cap it so a slow/unreachable Skyvern fails cleanly instead of hanging the
// whole request until Vercel kills it with a 504 (which left the UI stuck on
// "Launching browser agent…").
const SKYVERN_TIMEOUT_MS = 20_000;

export function getSkyvernKey(): string | null {
  return process.env.SKYVERN_API_KEY ?? null;
}

export interface SkyvernTaskPayload {
  url: string;
  webhookCallbackUrl: string;
  navigationPayload: Record<string, string | null>;
  /** Optional: public URL to the resume PDF — Skyvern will download + upload it */
  resumeUrl?: string;
  coverLetter?: string;
  /** Password for creating/logging into job board accounts */
  jobBoardPassword?: string;
  /** Run the browser from this region, e.g. "RESIDENTIAL_CA". Defaults to US. */
  proxyLocation?: string;
}

// Country name / code → ISO-3166 alpha-2, for the job markets we see most.
const COUNTRY_TO_ISO2: Record<string, string> = {
  "united states": "US", usa: "US", "u.s.": "US", "u.s.a.": "US", america: "US", us: "US",
  canada: "CA", ca: "CA",
  "united kingdom": "GB", uk: "GB", "u.k.": "GB", england: "GB", scotland: "GB", wales: "GB", britain: "GB", "great britain": "GB",
  ireland: "IE", australia: "AU", "new zealand": "NZ",
  germany: "DE", deutschland: "DE", france: "FR", netherlands: "NL", holland: "NL",
  spain: "ES", italy: "IT", portugal: "PT", belgium: "BE", austria: "AT", switzerland: "CH",
  sweden: "SE", norway: "NO", denmark: "DK", finland: "FI", poland: "PL",
  india: "IN", singapore: "SG", "united arab emirates": "AE", uae: "AE",
  "south africa": "ZA", nigeria: "NG", kenya: "KE", egypt: "EG",
  brazil: "BR", mexico: "MX", japan: "JP", "hong kong": "HK", philippines: "PH",
};

/**
 * Pick a Skyvern proxy_location from a freeform job location string so the
 * browser appears to be in the job's country (clears regional content gates
 * like Adzuna's "not available in your region"). Falls back to US default.
 */
export function proxyLocationForLocation(location: string | null | undefined): string {
  if (!location) return "RESIDENTIAL";
  const t = ` ${location.toLowerCase().replace(/[.,()/]/g, " ")} `;
  // Longer names first so "united states" wins over "us".
  const names = Object.keys(COUNTRY_TO_ISO2).sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (t.includes(` ${name} `)) return `RESIDENTIAL_${COUNTRY_TO_ISO2[name]}`;
  }
  return "RESIDENTIAL";
}

export interface SkyvernTask {
  /** Maps to the API's run_id (e.g. "tsk_..."). Kept as task_id for our schema. */
  task_id: string;
  status: string;
  created_at?: string;
  /** Present on terminal failures (e.g. "this job is not available in your region"). */
  failure_reason?: string | null;
  /** Number of agent steps consumed — used for cost tracking. */
  step_count?: number | null;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "terminated", "timed_out", "canceled"]);
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

// Human-readable label for a payload key, e.g. linkedin_url -> "LinkedIn URL"
function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\burl\b/gi, "URL")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPrompt(p: SkyvernTaskPayload): string {
  const hasPassword = !!p.jobBoardPassword;

  const details: string[] = [];
  for (const [k, v] of Object.entries(p.navigationPayload)) {
    if (v != null && String(v).trim() !== "") details.push(`- ${labelize(k)}: ${v}`);
  }
  if (p.jobBoardPassword) details.push(`- Account Password (use to log in or sign up): ${p.jobBoardPassword}`);
  if (p.resumeUrl) details.push(`- Resume file to upload (download from this URL): ${p.resumeUrl}`);

  const instructions = [
    "Goal: Apply for the job posted on this page on behalf of the applicant below.",
    "",
    "Steps:",
    "1. Dismiss any popups (cookie banners, newsletter sign-ups, email alerts) first.",
    "2. Find and click the apply button ('Apply', 'Apply for this job', 'Quick Apply', 'Easy Apply').",
    hasPassword
      ? "3. If the site requires an account or login, use the applicant's email and the Account Password below. If no account exists, sign up with that email and password; if one exists, log in. Then continue the application."
      : "3. If the site offers a guest/no-account application, use it. If login is strictly required and you have no credentials, report that login is required.",
    "4. Fill every form field using the applicant details below. Make reasonable choices for optional questions.",
    "5. If there is a resume/CV upload field, upload the applicant's resume from the provided URL.",
    p.coverLetter ? "6. If there is a cover letter field, paste the cover letter provided below." : "6. If a cover letter is requested, write a brief professional one from the applicant's details.",
    "7. Solve any CAPTCHA. Complete every page of multi-step forms.",
    "8. Submit the application. Only stop with an error if the application genuinely cannot be completed.",
    "",
    "Applicant details:",
    ...details,
  ];

  if (p.coverLetter) {
    instructions.push("", "Cover letter:", p.coverLetter);
  }

  return instructions.join("\n");
}

// Systemic (admin/ops) failure of the browser-agent service — NOT the user's
// fault. `adminDetail` is the real reason for ops (never shown to the client);
// the user only ever sees a neutral "temporarily unavailable".
export type SkyvernFailureKind = "auth" | "credits" | "rate_limit" | "outage" | "unknown";
export class SkyvernServiceError extends Error {
  kind: SkyvernFailureKind;
  status: number | null;
  adminDetail: string;
  constructor(kind: SkyvernFailureKind, status: number | null, adminDetail: string) {
    super("Auto-apply is temporarily unavailable.");
    this.name = "SkyvernServiceError";
    this.kind = kind;
    this.status = status;
    this.adminDetail = adminDetail;
  }
}

// Classify a raw Skyvern HTTP failure into an ops-facing reason. Logged in full
// server-side; the user never sees `adminDetail`.
function skyvernError(status: number, body: string): SkyvernServiceError {
  console.error(`[skyvern] task create failed (${status}): ${body?.slice(0, 500)}`);
  const lc = (body || "").toLowerCase();
  if (status === 401 || status === 403) {
    return new SkyvernServiceError("auth", status, "Skyvern rejected our credentials — SKYVERN_API_KEY is missing/invalid or revoked.");
  }
  if (status === 402 || /credit|quota|balance|insufficient|billing|payment/.test(lc)) {
    return new SkyvernServiceError("credits", status, "Skyvern account is out of credits — top up to resume client auto-apply.");
  }
  if (status === 429) {
    return new SkyvernServiceError("rate_limit", status, `Skyvern rate-limited (429): ${body?.slice(0, 200)}`);
  }
  if (status >= 500) {
    return new SkyvernServiceError("outage", status, `Skyvern server error (${status}): ${body?.slice(0, 200)}`);
  }
  return new SkyvernServiceError("unknown", status, `Skyvern task-create error ${status}: ${body?.slice(0, 200)}`);
}

// Lightweight connectivity/auth probe for diagnostics. Hits an authenticated
// read endpoint and reports whether the key works — without creating a run.
export async function checkSkyvernHealth(): Promise<{ ok: boolean; configured: boolean; status: number | null; detail: string }> {
  const key = getSkyvernKey();
  if (!key) return { ok: false, configured: false, status: null, detail: "SKYVERN_API_KEY is not set on this server." };
  try {
    // GET a bogus run id: a working key returns 404 (auth OK, run not found);
    // a bad key returns 401/403. Either way we learn the auth state cheaply.
    const res = await fetch(`${SKYVERN_BASE}/runs/healthcheck-probe`, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(SKYVERN_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, configured: true, status: res.status, detail: "Key is set but rejected by Skyvern (401/403)." };
    }
    if (res.status >= 500) {
      return { ok: false, configured: true, status: res.status, detail: "Skyvern is returning server errors (outage)." };
    }
    // 404/200 → auth works.
    return { ok: true, configured: true, status: res.status, detail: "Skyvern auth OK." };
  } catch {
    return { ok: false, configured: true, status: null, detail: "Could not reach Skyvern (timeout/network)." };
  }
}

export async function createSkyvernTask(p: SkyvernTaskPayload): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const base: Record<string, unknown> = {
    prompt: buildPrompt(p),
    url: p.url,
    webhook_url: p.webhookCallbackUrl,
    // skyvern-2.0 handles complex, multi-step flows (login + multi-page forms)
    engine: "skyvern-2.0",
    // Charged per step — allow enough for login + multi-page forms
    max_steps: 75,
  };

  const post = async (body: Record<string, unknown>) => {
    try {
      return await fetch(`${SKYVERN_BASE}/run/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SKYVERN_TIMEOUT_MS),
      });
    } catch {
      throw new SkyvernServiceError("outage", null, "Skyvern did not respond in time (timeout/network).");
    }
  };

  // Run from the job's region when we know it (clears geo content gates).
  let res = await post(p.proxyLocation ? { ...base, proxy_location: p.proxyLocation } : base);

  // If an unsupported/invalid proxy_location is the problem, retry without it
  // so a region code never blocks the actual application.
  if (!res.ok && p.proxyLocation) {
    const errText = await res.text().catch(() => "");
    if (/proxy|location|region/i.test(errText) || res.status === 422 || res.status === 400) {
      console.warn(`[skyvern] proxy_location ${p.proxyLocation} rejected, retrying without it`);
      res = await post(base);
    } else {
      throw skyvernError(res.status, errText);
    }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw skyvernError(res.status, err);
  }

  const json = (await res.json()) as { run_id?: string; task_id?: string; status?: string; created_at?: string };
  const runId = json.run_id ?? json.task_id;
  if (!runId) throw new Error("Skyvern response missing run_id");

  return { task_id: runId, status: json.status ?? "queued", created_at: json.created_at };
}

export async function getSkyvernTask(taskId: string): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const res = await fetch(`${SKYVERN_BASE}/runs/${taskId}`, {
    headers: { "x-api-key": key },
    signal: AbortSignal.timeout(SKYVERN_TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Skyvern get task failed (${res.status})`);
  const json = (await res.json()) as {
    run_id?: string; task_id?: string; status?: string; created_at?: string;
    failure_reason?: string | null; step_count?: number | null;
  };
  return {
    task_id: json.run_id ?? json.task_id ?? taskId,
    status: json.status ?? "unknown",
    created_at: json.created_at,
    failure_reason: json.failure_reason ?? null,
    step_count: json.step_count ?? null,
  };
}
