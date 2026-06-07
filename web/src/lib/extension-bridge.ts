// Client-side bridge to the JobsAI browser extension. Used by both the bulk
// Apply-to-All bar and the single-job apply on the job detail page, so there's
// one code path for talking to the extension's bulk-apply port.

import { LINKEDIN_EXTENSION_ID } from "@/lib/constants";

export type ApplyJobStatus = "queued" | "applying" | "applied" | "review" | "failed";

export interface BridgeJob {
  id: string;
  url: string | null;
  title: string;
  company: string | null;
}

export type BridgeEvent =
  | { type: "ack" }
  | { type: "progress"; jobId: string; status: ApplyJobStatus }
  | { type: "done"; applied: number }
  | { type: "unavailable" };

// Minimal typed view of the chrome bridge exposed to the page.
type ChromePort = {
  postMessage: (m: unknown) => void;
  onMessage: { addListener: (cb: (m: unknown) => void) => void };
  onDisconnect: { addListener: (cb: () => void) => void };
};
type ChromeRuntime = { connect?: (id: string, info?: { name?: string }) => ChromePort };

function getRuntime(): ChromeRuntime | undefined {
  return (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

/** True if a Chromium runtime capable of reaching the extension is present. */
export function extensionMaybeInstalled(): boolean {
  return !!getRuntime()?.connect;
}

/**
 * Send a batch (1+ jobs) to the extension and stream progress to `onEvent`.
 * If the extension isn't installed/reachable, emits a single `unavailable` event.
 */
export function runExtensionApply(
  jobs: BridgeJob[],
  opts: { resumeId?: string; resumeLabel?: string | null },
  onEvent: (e: BridgeEvent) => void
): void {
  const runtime = getRuntime();
  if (!runtime?.connect) { onEvent({ type: "unavailable" }); return; }

  let port: ChromePort;
  try {
    port = runtime.connect(LINKEDIN_EXTENSION_ID, { name: "jobsai-bulk-apply" });
  } catch {
    onEvent({ type: "unavailable" });
    return;
  }

  let acked = false;
  port.onMessage.addListener((raw) => {
    const msg = raw as { type?: string; jobId?: string; status?: ApplyJobStatus; applied?: number };
    if (msg.type === "ACK") { acked = true; onEvent({ type: "ack" }); }
    else if (msg.type === "PROGRESS" && msg.jobId && msg.status) onEvent({ type: "progress", jobId: msg.jobId, status: msg.status });
    else if (msg.type === "DONE") onEvent({ type: "done", applied: msg.applied ?? 0 });
  });
  port.onDisconnect.addListener(() => { if (!acked) onEvent({ type: "unavailable" }); });

  port.postMessage({
    type: "BULK_APPLY",
    apiBase: window.location.origin,
    resumeId: opts.resumeId,
    resumeLabel: opts.resumeLabel ?? null,
    jobs: jobs.map((j) => ({ id: j.id, url: j.url, title: j.title, company: j.company })),
  });
}
