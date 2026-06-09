import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deductTokens, TOKEN_COSTS } from "@/lib/tokens";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Extension apply outcomes → apply_attempts statuses.
const STATUS_MAP: Record<string, "submitted" | "failed" | "manual_required"> = {
  applied: "submitted",
  submitted: "submitted",
  needs_review: "manual_required",
  assisted: "manual_required",
  external: "manual_required",
  skipped: "manual_required",
  failed: "failed",
};

// POST /api/extension/apply-result
// Auth: Authorization: Bearer jsk_xxx
// Body: { job_id, board, status, error?, applied_url? }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Missing API key." }, { status: 401, headers: CORS_HEADERS });

  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("extension_api_key", token)
    .maybeSingle();
  if (!billing?.user_id) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: CORS_HEADERS });
  const userId = billing.user_id;

  const body = await req.json().catch(() => ({}));
  const jobId = (body.job_id as string | undefined)?.trim();
  const board = (body.board as string | undefined)?.trim() || "unknown";
  const status = STATUS_MAP[(body.status as string) ?? ""] ?? "failed";
  if (!jobId) return NextResponse.json({ error: "job_id is required." }, { status: 400, headers: CORS_HEADERS });

  // Ownership check — never log against a job the caller doesn't own.
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404, headers: CORS_HEADERS });

  const { error } = await supabaseAdmin.from("apply_attempts").insert({
    user_id: userId,
    job_id: jobId,
    platform: board,
    status,
    submitted_at: status === "submitted" ? new Date().toISOString() : null,
    error_msg: (body.error as string | undefined)?.slice(0, 500) ?? null,
    response_data: body.applied_url ? { applied_url: body.applied_url } : {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  // Charge the cheap extension-apply credit only on a real submission, and
  // advance the pipeline card to "applied" (forward-only).
  if (status === "submitted") {
    await deductTokens(userId, TOKEN_COSTS.extension_apply, "extension_apply", { job_id: jobId, board }, { meterFree: true });
    const now = new Date().toISOString();
    const { data: app } = await supabaseAdmin
      .from("applications").select("id, stage, stage_history")
      .eq("user_id", userId).eq("job_id", jobId).maybeSingle();
    if (!app) {
      await supabaseAdmin.from("applications").insert({
        user_id: userId, job_id: jobId, stage: "applied", applied_at: now,
        stage_history: [{ stage: "applied", at: now }],
      });
    } else if (app.stage === "saved") {
      const history = Array.isArray(app.stage_history) ? app.stage_history : [];
      await supabaseAdmin.from("applications")
        .update({ stage: "applied", applied_at: now, stage_history: [...history, { stage: "applied", at: now }] })
        .eq("id", app.id);
    }
  }

  return NextResponse.json({ ok: true, status }, { status: 201, headers: CORS_HEADERS });
}
