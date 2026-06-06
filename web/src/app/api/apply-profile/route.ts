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

  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const update: ApplyProfileUpdate = {
    first_name:          s(body.first_name),
    last_name:           s(body.last_name),
    email:               s(body.email),
    phone:               s(body.phone),
    linkedin_url:        s(body.linkedin_url),
    github_url:          s(body.github_url),
    portfolio_url:       s(body.portfolio_url),
    website_url:         s(body.website_url),
    city:                s(body.city),
    country:             s(body.country),
    authorized_to_work:  body.authorized_to_work  !== false,
    requires_sponsorship: body.requires_sponsorship === true,
    // Role & experience
    employment_status:        s(body.employment_status),
    target_experience_level:  s(body.target_experience_level),
    industry:                 s(body.industry),
    willing_to_relocate:      body.willing_to_relocate === true,
    available_from:           s(body.available_from),
    // Personal / address
    address_line1:            s(body.address_line1),
    address_line2:            s(body.address_line2),
    postal_code:              s(body.postal_code),
    date_of_birth:            s(body.date_of_birth),
    // Eligibility
    work_auth_us:             s(body.work_auth_us),
    work_auth_canada:         s(body.work_auth_canada),
    work_auth_countries:      Array.isArray(body.work_auth_countries)
      ? body.work_auth_countries.filter(
          (e: unknown) => e && typeof (e as Record<string, unknown>).country === "string" && typeof (e as Record<string, unknown>).status === "string"
        )
      : [],
    languages:                Array.isArray(body.languages)
      ? body.languages.filter(
          (e: unknown) => e && typeof (e as Record<string, unknown>).language === "string" && typeof (e as Record<string, unknown>).proficiency === "string"
        )
      : [],
    security_clearance:       s(body.security_clearance),
    has_drivers_license:      body.has_drivers_license === true,
    // Education & certifications
    highest_education:        s(body.highest_education),
    university:               s(body.university),
    certifications:           Array.isArray(body.certifications)
      ? body.certifications.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [],
    // Voluntary self-identification
    race_ethnicity:           s(body.race_ethnicity),
    nationality:              s(body.nationality),
    gender_identity:          s(body.gender_identity),
    sexual_orientation:       s(body.sexual_orientation),
    transgender:              s(body.transgender),
    disability_status:        s(body.disability_status),
    veteran_status:           s(body.veteran_status),
    // Application behaviour
    cc_email:                 s(body.cc_email),
    application_mode:         s(body.application_mode) ?? "review",
    auto_reply:               body.auto_reply === true,
  };

  const { data, error } = await supabaseAdmin
    .from("apply_profiles")
    .upsert({ user_id: userId, ...update }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
