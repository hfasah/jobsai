import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { sendWebhookEvent } from "@/lib/enterprise-webhooks";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization found." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach application counts
  const counts = await supabaseAdmin
    .from("enterprise_applications")
    .select("job_id")
    .eq("org_id", org.id);

  const countMap: Record<string, number> = {};
  for (const row of counts.data ?? []) {
    countMap[row.job_id] = (countMap[row.job_id] ?? 0) + 1;
  }

  const jobs = (data ?? []).map((j) => ({ ...j, application_count: countMap[j.id] ?? 0 }));
  return NextResponse.json({ data: jobs });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Job title is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_jobs")
    .insert({
      org_id: org.id,
      title: body.title.trim(),
      department: body.department ?? null,
      location: body.location ?? null,
      employment_type: body.employment_type ?? "full-time",
      description: body.description ?? null,
      responsibilities: body.responsibilities ?? null,
      qualifications: body.qualifications ?? null,
      nice_to_have: body.nice_to_have ?? null,
      salary_min: body.salary_min ?? null,
      salary_max: body.salary_max ?? null,
      salary_currency: body.salary_currency ?? "USD",
      status: body.status ?? "draft",
      created_by: userId,
      published_at: body.status === "active" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  sendWebhookEvent(org.id, "job.created", {
    job_id: data.id,
    title: data.title,
    department: data.department,
    status: data.status,
  }).catch(() => {});

  return NextResponse.json({ data }, { status: 201 });
}
