import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { checkSkyvernHealth } from "@/lib/skyvern";
import { notifyAgentApplyDown } from "@/lib/ops-alert";

export const maxDuration = 30;

// POST /api/support/auto-apply-down — client clicked "Notify support" after
// seeing the neutral "auto-apply temporarily unavailable" notice. Probes the
// real Skyvern state and alerts ops with it (the client never sees the reason).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobId = typeof body.job_id === "string" ? body.job_id : undefined;

  // Probe the live state so ops gets the real reason (configured? bad key? etc.).
  const health = await checkSkyvernHealth();
  const kind = !health.configured ? "auth" : health.status === 401 || health.status === 403 ? "auth" : "unknown";

  await notifyAgentApplyDown({
    kind,
    detail: `Client-reported. Skyvern health: ${health.detail} (configured=${health.configured}, status=${health.status ?? "n/a"}). If auth is OK, most likely OUT OF CREDITS.`,
    source: "user",
    userId,
    jobId,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
