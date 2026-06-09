// Skyvern browser-agent client — opens any job URL, fills the form, handles CAPTCHA, submits.
// Uses the current Run Tasks API: POST /v1/run/tasks (prompt-based), GET /v1/runs/{id}.
// Docs: https://www.skyvern.com/docs/running-tasks/api-spec

const SKYVERN_BASE = "https://api.skyvern.com/v1";

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

export async function createSkyvernTask(p: SkyvernTaskPayload): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const res = await fetch(`${SKYVERN_BASE}/run/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({
      prompt: buildPrompt(p),
      url: p.url,
      webhook_url: p.webhookCallbackUrl,
      // skyvern-2.0 handles complex, multi-step flows (login + multi-page forms)
      engine: "skyvern-2.0",
      // Charged per step — allow enough for login + multi-page forms
      max_steps: 75,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Skyvern task creation failed (${res.status}): ${err}`);
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
