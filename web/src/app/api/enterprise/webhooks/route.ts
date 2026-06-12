import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { generateWebhookSecret } from "@/lib/enterprise-webhooks";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_webhooks")
    .select("id, url, secret, active, created_at, last_triggered_at, last_status")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const url: string = body.url?.trim();
  if (!url || !/^https?:\/\/.+/.test(url)) {
    return NextResponse.json({ error: "Valid URL required (must start with http/https)." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_webhooks")
    .insert({
      org_id: org.id,
      created_by: userId,
      url,
      secret: generateWebhookSecret(),
      active: true,
    })
    .select("id, url, secret, active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await supabaseAdmin.from("enterprise_webhooks").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
