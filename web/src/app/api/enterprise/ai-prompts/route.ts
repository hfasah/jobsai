import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_ai_prompts").select("*").eq("org_id", org.id)
    .order("uses", { ascending: false }).order("created_at", { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}

// POST — save a new shared prompt template (anyone on the team)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim() || !body.prompt?.trim()) {
    return NextResponse.json({ error: "Title and prompt are required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("enterprise_ai_prompts")
    .insert({ org_id: org.id, title: body.title.trim(), prompt: body.prompt.trim(), created_by: userId })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
