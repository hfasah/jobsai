import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/debug/setup-status
// Returns actual database values for setup completion
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [resumesRes, prefsRes, applyProfileRes] = await Promise.all([
      supabaseAdmin
        .from("resume_documents")
        .select("id, user_id")
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabaseAdmin
        .from("user_preferences")
        .select("id, user_id, job_titles, locations")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("apply_profiles")
        .select("id, user_id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      userId,
      resume: {
        hasData: (resumesRes.data?.length ?? 0) > 0,
        count: resumesRes.data?.length ?? 0,
        data: resumesRes.data,
      },
      preferences: {
        hasData: prefsRes.data != null,
        data: prefsRes.data,
      },
      applyProfile: {
        hasData: applyProfileRes.data != null,
        data: applyProfileRes.data,
      },
      allComplete: (resumesRes.data?.length ?? 0) > 0 && prefsRes.data != null && applyProfileRes.data != null,
    });
  } catch (err) {
    console.error("Debug error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
