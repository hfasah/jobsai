import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { ensureJobPools } from "@/lib/enterprise-pools";

// GET — all pools for a job + the candidates in each
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  // Make sure the auto pools exist so the page is never empty
  await ensureJobPools(org.id, jobId);

  const [{ data: pools }, { data: apps }] = await Promise.all([
    supabaseAdmin.from("enterprise_pools").select("*").eq("job_id", jobId).eq("org_id", org.id).order("sort_order"),
    supabaseAdmin.from("enterprise_applications").select("*").eq("job_id", jobId).eq("org_id", org.id).order("match_score", { ascending: false, nullsFirst: false }),
  ]);

  return NextResponse.json({ data: { pools: pools ?? [], applications: apps ?? [] } });
}

// POST — create a custom pool
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: "Pool name is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("enterprise_pools").insert({
    org_id: org.id, job_id: jobId, name: body.name.trim(),
    description: body.description ?? null, criteria: body.criteria ?? null,
    type: "custom", color: body.color ?? "purple", sort_order: 10,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
