import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runWorkflows } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .select("id,candidate_name,job_title,content,status,signed_at,declined_at,org_id")
    .eq("sign_token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  // Fetch org name
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name,id")
    .eq("id", data.org_id)
    .maybeSingle();

  return NextResponse.json({
    data: {
      id: data.id,
      candidate_name: data.candidate_name,
      job_title: data.job_title,
      content: data.content,
      status: data.status,
      signed_at: data.signed_at,
      declined_at: data.declined_at,
      org_name: org?.name ?? "",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: offer, error: fetchErr } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .select("id,status,candidate_name,candidate_email,job_title,org_id,application_id")
    .eq("sign_token", token)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  if (body.action === "decline") {
    if (offer.status !== "sent") {
      return NextResponse.json({ error: "Only sent offers can be declined." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("enterprise_offer_letters")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        decline_reason: body.decline_reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Fetch org for workflow context
    const { data: dOrg } = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", offer.org_id).maybeSingle();
    runWorkflows("offer_declined", {
      org_id: offer.org_id,
      org_name: dOrg?.name ?? "",
      candidate_name: offer.candidate_name as string,
      candidate_email: offer.candidate_email as string,
      job_title: offer.job_title as string,
      application_id: (offer.application_id as string) ?? undefined,
    }).catch(() => {});
    return NextResponse.json({ data });
  }

  // Default: sign
  if (offer.status !== "sent") {
    return NextResponse.json({ error: "This offer cannot be signed in its current state." }, { status: 400 });
  }
  const signed_by_name = body.signed_by_name?.trim();
  if (!signed_by_name) {
    return NextResponse.json({ error: "Please type your full name to sign." }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_by_name,
      signed_by_ip: ip,
      signed_by_ua: ua,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offer.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Fetch org for workflow context
  const { data: sOrg } = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", offer.org_id).maybeSingle();
  runWorkflows("offer_signed", {
    org_id: offer.org_id,
    org_name: sOrg?.name ?? "",
    candidate_name: offer.candidate_name as string,
    candidate_email: offer.candidate_email as string,
    job_title: offer.job_title as string,
    application_id: (offer.application_id as string) ?? undefined,
  }).catch(() => {});
  return NextResponse.json({ data });
}
