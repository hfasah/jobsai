import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyEmail } from "@/lib/inbox";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST /api/inbox/reclassify — re-run the (improved) classifier over the current
// user's stored inbound emails and fix any whose label changed. Idempotent.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: messages } = await supabaseAdmin
    .from("inbox_messages")
    .select("id, subject, body_text, classification")
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .limit(2000);

  let updated = 0;
  const changes: Record<string, number> = {};
  for (const m of messages ?? []) {
    const next = classifyEmail((m.subject as string) ?? "", (m.body_text as string) ?? "");
    if (next !== m.classification) {
      await supabaseAdmin
        .from("inbox_messages")
        .update({ classification: next })
        .eq("id", m.id)
        .eq("user_id", userId);
      updated++;
      const key = `${m.classification}->${next}`;
      changes[key] = (changes[key] ?? 0) + 1;
    }
  }

  return NextResponse.json({ scanned: (messages ?? []).length, updated, changes });
}
