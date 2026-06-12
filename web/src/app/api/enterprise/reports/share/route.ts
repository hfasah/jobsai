import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import crypto from "crypto";

// GET — list active share tokens
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_report_shares")
    .select("id,token,label,filters,created_at,expires_at,view_count,created_by")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create a new share token
// body: { label?: string, filters?: { from, to, job, department }, expires_days?: number }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const label: string = body.label?.trim() || `Report ${new Date().toLocaleDateString()}`;
  const filters = body.filters ?? {};
  const expiresDays: number = Number(body.expires_days) || 30;

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresDays * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("enterprise_report_shares")
    .insert({
      org_id: org.id,
      created_by: userId,
      token,
      label,
      filters,
      expires_at: expiresAt,
      view_count: 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — revoke a share token
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await supabaseAdmin
    .from("enterprise_report_shares")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  return NextResponse.json({ ok: true });
}
