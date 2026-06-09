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
}

export interface SkyvernTask {
  task_id: string;
  status: "created" | "running" | "completed" | "failed" | "terminated";
  created_at: string;
}

export async function createSkyvernTask(p: SkyvernTaskPayload): Promise<SkyvernTask> {
  const key = getSkyvernKey();
  if (!key) throw new Error("SKYVERN_API_KEY not configured");

  const navigationGoal = [
    "Apply for the job listed on this page.",
    "Use the personal information provided in the data payload to fill out every field of the application form.",
    "If a resume upload field is present, upload the resume from the provided resume URL.",
    "If a cover letter field is present, paste the cover letter text provided.",
    "If a CAPTCHA appears, solve it.",
    "If the site offers a 'Quick Apply' or 'Easy Apply' flow, prefer that.",
    "Submit the completed application.",
    "Do NOT create an account or log in — apply as a guest wherever possible.",
    "Stop and report an error only if the application cannot be completed at all.",
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
      },
      // Skyvern handles CAPTCHA automatically; we allow up to 30 minutes per task
      max_steps_override: 50,
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
