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
    auto_apply_enabled:   typeof body.auto_apply_enabled === "boolean" ? body.auto_apply_enabled : undefined,
    auto_apply_threshold: body.auto_apply_threshold != null ? Number(body.auto_apply_threshold) : undefined,
  };

  const { data, error } = await supabaseAdmin
    .from("user_preferences")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
