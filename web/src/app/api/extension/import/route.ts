import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { importJobFromUrl } from "@/lib/job-import";
import { checkJobImportGate } from "@/lib/billing";

export const maxDuration = 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/extension/import
// Auth: Authorization: Bearer jsk_xxx
// Body: { url: string }
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401, headers: CORS_HEADERS });
  }

  // Look up user by extension_api_key
  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("extension_api_key", token)
    .maybeSingle();

  if (!billing?.user_id) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: CORS_HEADERS });
  }

  const userId = billing.user_id;

  const gate = await checkJobImportGate(userId);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: gate.reason, upgrade_required: true },
      { status: 402, headers: CORS_HEADERS }
    );
  }

  const body = await req.json().catch(() => ({}));
  const url = (body.url as string | undefined)?.trim();

  if (!url) {
    return NextResponse.json({ error: "url is required." }, { status: 400, headers: CORS_HEADERS });
  }

  try { new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const result = await importJobFromUrl(url, userId);
    return NextResponse.json(
      { job_id: result.job_id, duplicate: result.status === "dedup" },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 422, headers: CORS_HEADERS });
  }
}
