import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// GET /api/enterprise/voice-screen/status?appId=xxx
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const appId = new URL(req.url).searchParams.get("appId");
  if (!appId) return NextResponse.json({ error: "appId required." }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,voice_screen_status,voice_score,voice_summary,voice_transcript,voice_recommendation,voice_strengths,voice_concerns,voice_questions,voice_call_sid,voice_screened_at")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();

  return NextResponse.json({ data });
}
