import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserPlan, PLAN_LIMITS } from "@/lib/billing";
import type { ParsedJson } from "@/types/resume";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/extension/profile
// Auth: Authorization: Bearer jsk_xxx
// Returns: { profile: { ...flat autofill fields } } for LinkedIn Easy Apply.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing API key." }, { status: 401, headers: CORS_HEADERS });
  }

  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("extension_api_key", token)
    .maybeSingle();

  if (!billing?.user_id) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: CORS_HEADERS });
  }
  const userId = billing.user_id;

  // Applying to jobs is a paid feature — gate the extension's autofill so free
  // users can't auto-apply through it (mirrors the server auto-apply gate).
  const plan = await getUserPlan(userId);
  if (!PLAN_LIMITS[plan].auto_apply) {
    return NextResponse.json(
      { error: "Auto-apply is a paid feature. Upgrade your plan to apply with JobsAI.", upgrade_required: true },
      { status: 402, headers: CORS_HEADERS }
    );
  }

  // Prefer the structured apply profile.
  const { data: ap } = await supabaseAdmin
    .from("apply_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Resume fallback for name/contact/links/experience.
  const { data: doc } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false)
    .maybeSingle();

  let parsed: ParsedJson | null = null;
  if (doc?.active_version_id) {
    const { data: pp } = await supabaseAdmin
      .from("resume_parsed_profile")
      .select("parsed_json")
      .eq("version_id", doc.active_version_id)
      .maybeSingle();
    parsed = (pp?.parsed_json as ParsedJson) ?? null;
  }

  const resumeName = (parsed?.name ?? "").trim();
  const resumeParts = resumeName.split(/\s+/);
  const resumeLinks = (parsed?.links ?? {}) as Record<string, string>;
  const pick = (obj: Record<string, string>, ...keys: string[]) => {
    for (const k of keys) if (obj[k]) return obj[k];
    return null;
  };

  const first_name = ap?.first_name ?? resumeParts[0] ?? null;
  const last_name = ap?.last_name ?? (resumeParts.slice(1).join(" ") || null);

  const profile = {
    first_name,
    last_name,
    full_name: [first_name, last_name].filter(Boolean).join(" ") || resumeName || null,
    email: ap?.email ?? parsed?.email ?? null,
    phone: ap?.phone ?? parsed?.phone ?? null,
    city: ap?.city ?? null,
    location: parsed?.location ?? null,
    postal_code: ap?.postal_code ?? null,
    country: ap?.country ?? null,
    linkedin_url: ap?.linkedin_url ?? pick(resumeLinks, "linkedin", "LinkedIn"),
    github_url: ap?.github_url ?? pick(resumeLinks, "github", "GitHub"),
    portfolio_url: ap?.portfolio_url ?? pick(resumeLinks, "portfolio", "Portfolio"),
    website_url: ap?.website_url ?? pick(resumeLinks, "website", "Website"),
    years_experience: parsed?.years_experience ?? null,
    authorized_to_work: ap?.authorized_to_work ?? true,
    requires_sponsorship: ap?.requires_sponsorship ?? false,
  };

  return NextResponse.json({ profile }, { headers: CORS_HEADERS });
}
