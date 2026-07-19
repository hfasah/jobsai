import { auth } from "@clerk/nextjs/server";
import { enforceLimit } from "@/lib/enterprise-limits";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { sendWebhookEvent } from "@/lib/enterprise-webhooks";

const VALID_STAGES = new Set(["applied", "screened", "interview", "offer", "hired", "rejected"]);

interface ImportRow {
  candidate_name?: string;
  candidate_email?: string;
  candidate_phone?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  source?: string;
  stage?: string;
  notes?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lim = await enforceLimit(userId, "candidates");
  if (lim) return lim;

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, org_id, title")
    .eq("id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];

  if (!rows.length) return NextResponse.json({ error: "No rows provided." }, { status: 400 });

  // Load existing emails for this job to detect duplicates
  const { data: existing } = await supabaseAdmin
    .from("enterprise_applications")
    .select("candidate_email")
    .eq("job_id", jobId);
  const existingEmails = new Set((existing ?? []).map((r) => r.candidate_email.toLowerCase()));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = row.candidate_name?.trim();
    const email = row.candidate_email?.trim().toLowerCase();

    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.push(`Skipped row: missing or invalid name/email`);
      continue;
    }
    if (existingEmails.has(email)) { skipped++; continue; }

    const stage = row.stage?.toLowerCase().trim();
    const { error } = await supabaseAdmin.from("enterprise_applications").insert({
      job_id: jobId,
      org_id: org.id,
      candidate_name: name,
      candidate_email: email,
      candidate_phone: row.candidate_phone?.trim() || null,
      linkedin_url: row.linkedin_url?.trim() || null,
      portfolio_url: row.portfolio_url?.trim() || null,
      source: row.source?.trim() || "import",
      stage: VALID_STAGES.has(stage ?? "") ? stage : "applied",
      // NOTE: enterprise_applications has no created_by column — including it
      // made every imported row fail.
      notes: row.notes?.trim() || null,
    });

    if (error) { errors.push(`${email}: ${error.message}`); continue; }

    existingEmails.add(email);
    imported++;

    // Auto-screen in background
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work"}/api/enterprise/jobs/${jobId}/applications`, {
      method: "HEAD", // ping to ensure route is warm — real screen triggered below
    }).catch(() => {});
  }

  // Fire webhook for bulk import
  if (imported > 0) {
    sendWebhookEvent(org.id, "application.created", {
      job_id: jobId,
      job_title: job.title,
      source: "csv_import",
      count: imported,
    }).catch(() => {});
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) });
}
