import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [resumeRes, profileRes, prefsRes] = await Promise.all([
    supabaseAdmin
      .from("resume_documents")
      .select("id, active_version_id, is_primary")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .limit(1),
    supabaseAdmin
      .from("apply_profiles")
      .select("first_name, email")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_preferences")
      .select("job_titles")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const has_resume = (resumeRes.data?.length ?? 0) > 0;
  const has_profile = !!(profileRes.data?.first_name || profileRes.data?.email);
  const has_preferences = (prefsRes.data?.job_titles?.length ?? 0) > 0;

  // Try to fetch prefill from the primary (or first) resume's parsed profile
  let prefill = null;
  const doc = resumeRes.data?.[0];
  if (doc?.active_version_id) {
    const { data: parsed } = await supabaseAdmin
      .from("resume_parsed_profile")
      .select("full_name, email, phone, links")
      .eq("version_id", doc.active_version_id)
      .maybeSingle();

    if (parsed) {
      const nameParts = (parsed.full_name ?? "").trim().split(/\s+/);
      const links = (parsed.links ?? {}) as Record<string, string>;
      prefill = {
        first_name: nameParts[0] ?? null,
        last_name: nameParts.slice(1).join(" ") || null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        linkedin_url: links.linkedin ?? links.LinkedIn ?? null,
      };
    }
  }

  return NextResponse.json({ has_resume, has_profile, has_preferences, prefill });
}
