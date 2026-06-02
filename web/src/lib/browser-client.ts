import type { ApplyPlatform, ApplyStatus, ApplyProfile } from "@/types/apply";

export interface BrowserApplyRequest {
  platform: ApplyPlatform;
  sourceUrl: string;
  profile: ApplyProfile;
  resumeBase64: string;
  resumeMime: string;
  resumeFilename: string;
  coverLetter: string;
}

export interface BrowserApplyResponse {
  status: ApplyStatus;
  message?: string;
}

export function browserAgentConfigured(): boolean {
  return !!process.env.BROWSER_AGENT_URL;
}

export async function callBrowserAgent(
  req: BrowserApplyRequest
): Promise<BrowserApplyResponse> {
  const baseUrl = process.env.BROWSER_AGENT_URL;
  if (!baseUrl) {
    return { status: "manual_required", message: "Browser agent not configured" };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.BROWSER_AGENT_SECRET
          ? { Authorization: `Bearer ${process.env.BROWSER_AGENT_SECRET}` }
          : {}),
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(120_000), // 2 min for form filling
    });

    if (!res.ok) {
      return { status: "failed", message: `Browser agent returned ${res.status}` };
    }

    return (await res.json()) as BrowserApplyResponse;
  } catch (err) {
    return {
      status: "failed",
      message: err instanceof Error ? err.message : "Browser agent unreachable",
    };
  }
}
