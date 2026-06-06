import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// Public: track view/click events and optionally redirect
export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "direct";
  const event = url.searchParams.get("event") ?? "view";
  const redirect = url.searchParams.get("redirect");

  // Get org_id for the job (fire-and-forget)
  supabaseAdmin
    .from("enterprise_jobs")
    .select("org_id")
    .eq("id", jobId)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return;
      supabaseAdmin.from("enterprise_job_views").insert({
        job_id: jobId,
        org_id: data.org_id,
        source,
        event_type: event,
      }).then(() => {});
    });

  if (redirect === "apply") {
    return NextResponse.redirect(`${APP_URL}/enterprise/jobs/${jobId}/apply?src=${source}`);
  }

  return NextResponse.json({ tracked: true });
}
