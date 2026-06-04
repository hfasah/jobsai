import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTrackedCompanies, mentionsCompany } from "@/lib/gmail";

// POST /api/inbox/cleanup — remove inbound messages that aren't about a company
// in the user's JobsAI pipeline.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await getTrackedCompanies(userId);

  const { data: msgs } = await supabaseAdmin
    .from("inbox_messages")
    .select("id, from_email, from_name, subject, body_text")
    .eq("user_id", userId)
    .eq("direction", "inbound");

  const toRemove = (msgs ?? [])
    .filter((m) => !mentionsCompany(`${m.from_name ?? ""} ${m.from_email ?? ""} ${m.subject ?? ""} ${m.body_text ?? ""}`, companies))
    .map((m) => m.id);

  if (toRemove.length) {
    await supabaseAdmin.from("inbox_messages").delete().in("id", toRemove).eq("user_id", userId);
  }
  return NextResponse.json({ data: { removed: toRemove.length } });
}
