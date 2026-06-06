import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ appId: string }> };

// POST — add one check, or { standard: true } to add the standard set
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;
  const body = await req.json().catch(() => ({}));

  if (Array.isArray(body.checks)) {
    const rows = body.checks.map((c: { check_type: string; label: string }) => ({
      application_id: appId, org_id: org.id, check_type: c.check_type, label: c.label, status: "pending",
    }));
    const { data, error } = await supabaseAdmin.from("enterprise_background_checks").insert(rows).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (!body.check_type || !body.label) return NextResponse.json({ error: "check_type and label required." }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("enterprise_background_checks")
    .insert({ application_id: appId, org_id: org.id, check_type: body.check_type, label: body.label, status: "pending" })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
