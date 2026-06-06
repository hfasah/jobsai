import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authApiKey, rateLimit } from "@/lib/enterprise-api-auth";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };

export async function OPTIONS() { return new NextResponse(null, { headers: cors }); }

// GET /api/v1/enterprise/jobs — list jobs (public API)
export async function GET(req: NextRequest) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let q = supabaseAdmin.from("enterprise_jobs")
    .select("id, title, department, location, employment_type, salary_min, salary_max, salary_currency, status, created_at, published_at")
    .eq("org_id", org.id).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  return NextResponse.json({ data }, { headers: cors });
}

// POST /api/v1/enterprise/jobs — create a job
export async function POST(req: NextRequest) {
  const org = await authApiKey(req);
  if (!org) return NextResponse.json({ error: "Invalid API key." }, { status: 401, headers: cors });
  if (!rateLimit(org.id)) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429, headers: cors });

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "title is required." }, { status: 400, headers: cors });

  const { data, error } = await supabaseAdmin.from("enterprise_jobs").insert({
    org_id: org.id, title: body.title.trim(),
    department: body.department ?? null, location: body.location ?? null,
    employment_type: body.employment_type ?? "full-time",
    description: body.description ?? null, qualifications: body.qualifications ?? null,
    responsibilities: body.responsibilities ?? null,
    salary_min: body.salary_min ?? null, salary_max: body.salary_max ?? null,
    salary_currency: body.salary_currency ?? "USD",
    status: body.status === "active" ? "active" : "draft",
    created_by: "api",
    published_at: body.status === "active" ? new Date().toISOString() : null,
  }).select("id, title, status").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  return NextResponse.json({ data }, { status: 201, headers: cors });
}
