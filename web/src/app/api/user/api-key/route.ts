import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/user/api-key — return existing key or generate a new one
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("user_billing")
    .select("extension_api_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.extension_api_key) {
    return NextResponse.json({ api_key: data.extension_api_key });
  }

  // Generate and persist
  const key = `jsk_${randomUUID().replace(/-/g, "")}`;
  await supabaseAdmin
    .from("user_billing")
    .upsert({ user_id: userId, extension_api_key: key }, { onConflict: "user_id" });

  return NextResponse.json({ api_key: key });
}

// POST /api/user/api-key — regenerate (invalidates the old one)
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = `jsk_${randomUUID().replace(/-/g, "")}`;
  await supabaseAdmin
    .from("user_billing")
    .upsert({ user_id: userId, extension_api_key: key }, { onConflict: "user_id" });

  return NextResponse.json({ api_key: key });
}
