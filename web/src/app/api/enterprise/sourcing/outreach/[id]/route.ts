import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — mark replied / add to pipeline / unsubscribe
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { action } = await req.json().catch(() => ({}));

  const { data: outreach } = await supabaseAdmin
    .from("enterprise_sourcing_outreach")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!outreach) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (action === "mark_replied") {
    await supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .update({ replied_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "add_to_pipeline") {
    if (outreach.reply_added_to_pipeline) {
      return NextResponse.json({ error: "Already added to pipeline." }, { status: 409 });
    }
    if (!outreach.job_id) {
      return NextResponse.json({ error: "No job associated with this outreach." }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id")
      .eq("job_id", outreach.job_id)
      .eq("candidate_email", outreach.candidate_email)
      .maybeSingle();

    let applicationId: string;
    if (existing) {
      applicationId = existing.id;
    } else {
      const { data: app, error } = await supabaseAdmin
        .from("enterprise_applications")
        .insert({
          job_id: outreach.job_id,
          org_id: org.id,
          candidate_name: outreach.candidate_name,
          candidate_email: outreach.candidate_email,
          source: "sourced",
          stage: "applied",
        })
        .select("id")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      applicationId = app.id;
    }

    await supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .update({
        reply_added_to_pipeline: true,
        replied_at: outreach.replied_at ?? new Date().toISOString(),
        application_id: applicationId,
      })
      .eq("id", id);

    return NextResponse.json({ ok: true, application_id: applicationId });
  }

  if (action === "unsubscribe") {
    await supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .update({ unsubscribed: true })
      .eq("org_id", org.id)
      .eq("candidate_email", outreach.candidate_email);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
