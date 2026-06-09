// Skyvern browser-agent client — opens any job URL, fills the form, handles CAPTCHA, submits.
// Docs: https://docs.skyvern.com

const SKYVERN_BASE = "https://api.skyvern.com/api/v1";

export function getSkyvernKey(): string | null {
  return process.env.SKYVERN_API_KEY ?? null;
}

export interface SkyvernTaskPayload {
  url: string;
  webhookCallbackUrl: string;
  navigationPayload: Record<string, string | null>;
  /** Optional: public URL to the resume PDF — Skyvern will upload it */
  resumeUrl?: string;
  coverLetter?: string;
  /** Password for creating/logging into job board accounts */
  jobBoardPassword?: string;
}

export interface SkyvernTask {
  task_id: string;
  status: "created" | "running" | "completed" | "failed" | "terminated";
  created_at: string;
}

export async function createSkyvernTask(p: SkyvernTaskPayload): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const hasPassword = !!p.jobBoardPassword;
  const navigationGoal = [
    "Apply for the job listed on this page.",
    "Use the personal information provided in the data payload to fill out every field of the application form.",
    "If a resume upload field is present, upload the resume from the provided resume URL.",
    "If a cover letter field is present, paste the cover letter text provided.",
    "If a CAPTCHA appears, solve it.",
    "If the site offers a 'Quick Apply', 'Easy Apply', or 'Apply for this job' button, click it.",
    hasPassword
      ? "If the site requires creating an account or logging in: use the email address and job_board_password from the data payload. If no account exists yet, create one using that email and password, then complete the application. If already registered, log in with those credentials."
      : "If the site offers a guest application option, use it. If login is required and no credentials are provided, stop and report that login is required.",
    "Dismiss any popup dialogs (newsletter sign-ups, cookie notices, email alerts) before proceeding.",
    "Submit the completed application form.",
    "Stop and report an error only if the application truly cannot be completed.",
  ].join(" ");

  const res = await fetch(`${SKYVERN_BASE}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify({
      url: p.url,
      webhook_callback_url: p.webhookCallbackUrl,
      navigation_goal: navigationGoal,
      data_extraction_goal: "Extract the application confirmation message, reference number, or any error.",
      navigation_payload: {
        ...p.navigationPayload,
        ...(p.resumeUrl ? { resume_url: p.resumeUrl } : {}),
        ...(p.coverLetter ? { cover_letter: p.coverLetter } : {}),
        ...(p.jobBoardPassword ? { job_board_password: p.jobBoardPassword } : {}),
      },
      // Allow extra steps for login flows, popups, multi-page forms
      max_steps_override: 75,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Skyvern task creation failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<SkyvernTask>;
}

export async function getSkyvernTask(taskId: string): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const res = await fetch(`${SKYVERN_BASE}/tasks/${taskId}`, {
    headers: { "x-api-key": key },
  });

  if (!res.ok) throw new Error(`Skyvern get task failed (${res.status})`);
  return res.json() as Promise<SkyvernTask>;
}
