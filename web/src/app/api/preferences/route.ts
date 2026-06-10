import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { PreferencesUpdate } from "@/types/preferences";

// GET /api/preferences — load the user's preferences (or null if not set yet)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// PUT /api/preferences — create or replace the user's preferences
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const update: Partial<PreferencesUpdate> = {
    job_titles:           Array.isArray(body.job_titles)         ? body.job_titles         : undefined,
    keywords:             Array.isArray(body.keywords)           ? body.keywords           : undefined,
    location_type:        body.location_type                     ?? undefined,
    locations:            Array.isArray(body.locations)          ? body.locations          : undefined,
    min_salary:           body.min_salary != null ? Number(body.min_salary) || null : null,
    salary_currency:      body.salary_currency                   ?? undefined,
    employment_types:     Array.isArray(body.employment_types)   ? body.employment_types   : undefined,
    seniority_levels:     Array.isArray(body.seniority_levels)   ? body.seniority_levels   : undefined,
    excluded_companies:   Array.isArray(body.excluded_companies) ? body.excluded_companies : undefined,
    blocked_domains:      Array.isArray(body.blocked_domains) ? body.blocked_domains : undefined,
    auto_apply_enabled:   typeof body.auto_apply_enabled === "boolean" ? body.auto_apply_enabled : undefined,
    auto_apply_mode:      ["auto", "hybrid", "review"].includes(body.auto_apply_mode) ? body.auto_apply_mode : undefined,
    auto_apply_threshold: body.auto_apply_threshold != null ? Number(body.auto_apply_threshold) : undefined,
    require_approval:     typeof body.require_approval === "boolean" ? body.require_approval : undefined,
    cc_email_enabled:     typeof body.cc_email_enabled === "boolean" ? body.cc_email_enabled : undefined,
  };

  const { data, error } = await supabaseAdmin
    .from("user_preferences")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // CC-email written separately + best-effort so core prefs still save even on a
  // deployment where the columns don't exist yet (migration 047).
  if (body.cc_email_enabled !== undefined || body.cc_email !== undefined) {
    const ccUpdate: Record<string, unknown> = {};
    if (typeof body.cc_email_enabled === "boolean") ccUpdate.cc_email_enabled = body.cc_email_enabled;
    if (body.cc_email !== undefined) ccUpdate.cc_email = (typeof body.cc_email === "string" && body.cc_email.trim()) ? body.cc_email.trim() : null;
    const { data: ccData, error: ccErr } = await supabaseAdmin
      .from("user_preferences").update(ccUpdate).eq("user_id", userId).select("cc_email_enabled, cc_email").maybeSingle();
    if (ccErr) console.warn("cc_email not saved (run migration 047):", ccErr.message);
    else if (ccData) Object.assign(data, ccData);
  }

  return NextResponse.json({ data });
}
