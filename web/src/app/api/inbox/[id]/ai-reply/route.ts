import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { draftInboxReply } from "@/lib/ai-content";

// POST /api/inbox/[id]/ai-reply — draft a reply with AI.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: msg } = await supabaseAdmin
    .from("inbox_messages")
    .select("subject, body_text")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const { data: profile } = await supabaseAdmin.from("apply_profiles").select("first_name").eq("user_id", userId).maybeSingle();

  try {
    const draft = await draftInboxReply(msg.subject ?? "", msg.body_text ?? "", profile?.first_name ?? "");
    return NextResponse.json({ data: { draft } });
  } catch (err) {
    console.error("ai-reply error:", err);
    return NextResponse.json({ error: "Could not draft a reply." }, { status: 500 });
  }
}
