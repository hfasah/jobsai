import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApplyProfileUpdate } from "@/types/apply";

// GET /api/apply-profile — load the user's apply profile
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("apply_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // If no profile yet, try pre-filling from parsed resume
  if (!data) {
    const { data: parsed } = await supabaseAdmin
      .from("resume_documents")
      .select("active_version_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .eq("is_archived", false)
      .maybeSingle();

    if (parsed?.active_version_id) {
      const { data: profile } = await supabaseAdmin
        .from("resume_parsed_profile")
        .select("full_name, email, phone, links")
        .eq("version_id", parsed.active_version_id)
        .maybeSingle();

      if (profile) {
        const nameParts = (profile.full_name ?? "").trim().split(/\s+/);
        const links = (profile.links ?? {}) as Record<string, string>;
        return NextResponse.json({
          data: null,
          prefill: {
            first_name: nameParts[0] ?? null,
            last_name: nameParts.slice(1).join(" ") || null,
            email: profile.email ?? null,
            phone: profile.phone ?? null,
            linkedin_url: links.linkedin ?? links.LinkedIn ?? null,
            github_url: links.github ?? links.GitHub ?? null,
            portfolio_url: links.portfolio ?? links.Portfolio ?? null,
            website_url: links.website ?? links.Website ?? null,
          },
        });
      }
    }
  }

  return NextResponse.json({ data: data ?? null });
}

// PUT /api/apply-profile — create or replace
export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const update: ApplyProfileUpdate = {
    first_name:          body.first_name ?? null,
    last_name:           body.last_name  ?? null,
    email:               body.email      ?? null,
    phone:               body.phone      ?? null,
    linkedin_url:        body.linkedin_url  ?? null,
    github_url:          body.github_url    ?? null,
    portfolio_url:       body.portfolio_url ?? null,
    website_url:         body.website_url   ?? null,
    city:                body.city    ?? null,
    country:             body.country ?? null,
    authorized_to_work:  body.authorized_to_work  !== false,
    requires_sponsorship: body.requires_sponsorship === true,
  };

  const { data, error } = await supabaseAdmin
    .from("apply_profiles")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
