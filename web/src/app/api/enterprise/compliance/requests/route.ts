import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const status = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("enterprise_compliance_requests")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "compliance_gdpr");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { request_type, candidate_email, candidate_name, notes } = body;

  if (!request_type || !candidate_email) {
    return NextResponse.json({ error: "request_type and candidate_email are required." }, { status: 400 });
  }
  const VALID = ["access", "erasure", "portability"];
  if (!VALID.includes(request_type)) {
    return NextResponse.json({ error: "Invalid request_type." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_compliance_requests")
    .insert({ org_id: org.id, request_type, candidate_email, candidate_name: candidate_name || null, notes: notes || null })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log audit event
  void supabaseAdmin.from("enterprise_audit_logs").insert({
    org_id: org.id, user_id: userId,
    action: "compliance.request_created",
    resource_type: "compliance_request",
    resource_id: data.id,
    metadata: { request_type, candidate_email },
  });

  return NextResponse.json({ data });
}
