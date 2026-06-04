import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/inbox/disconnect — remove the connected mailbox.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabaseAdmin.from("email_accounts").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
