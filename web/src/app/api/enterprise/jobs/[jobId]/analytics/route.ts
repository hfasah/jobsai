import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const [viewsRes, appsRes] = await Promise.all([
    supabaseAdmin.from("enterprise_job_views").select("source,event_type").eq("job_id", jobId).eq("org_id", org.id),
    supabaseAdmin.from("enterprise_applications").select("source,match_score,stage").eq("job_id", jobId).eq("org_id", org.id),
  ]);

  const views = viewsRes.data ?? [];
  const apps = appsRes.data ?? [];

  // Aggregate by source
  const sources = [...new Set([...views.map((v) => v.source), ...apps.map((a) => a.source)])];

  const bySource = sources.map((source) => {
    const srcViews = views.filter((v) => v.source === source && v.event_type === "view").length;
    const srcClicks = views.filter((v) => v.source === source && v.event_type === "click").length;
    const srcApps = apps.filter((a) => a.source === source);
    const hired = srcApps.filter((a) => a.stage === "hired").length;
    const avgScore = srcApps.length
      ? Math.round(srcApps.reduce((s, a) => s + (a.match_score ?? 0), 0) / srcApps.length)
      : null;

    return {
      source,
      views: srcViews,
      clicks: srcClicks,
      applicants: srcApps.length,
      hired,
      avg_match_score: avgScore,
      conversion_rate: srcViews > 0 ? Math.round((srcApps.length / srcViews) * 100) : null,
    };
  }).sort((a, b) => b.applicants - a.applicants);

  return NextResponse.json({
    data: {
      by_source: bySource,
      totals: {
        views: views.filter((v) => v.event_type === "view").length,
        applicants: apps.length,
        hired: apps.filter((a) => a.stage === "hired").length,
      },
    },
  });
}

// POST — generate AI budget recommendation
export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const analyticsRes = await fetch(`/api/enterprise/jobs/${jobId}/analytics`);
  const { data: appsData } = await supabaseAdmin
    .from("enterprise_applications")
    .select("source,match_score,stage")
    .eq("job_id", jobId)
    .eq("org_id", org.id);

  const apps = appsData ?? [];
  const bySource: Record<string, { applicants: number; hired: number; avgScore: number }> = {};
  for (const a of apps) {
    if (!bySource[a.source]) bySource[a.source] = { applicants: 0, hired: 0, avgScore: 0 };
    bySource[a.source].applicants++;
    if (a.stage === "hired") bySource[a.source].hired++;
    bySource[a.source].avgScore += a.match_score ?? 0;
  }
  for (const s of Object.values(bySource)) s.avgScore = Math.round(s.avgScore / s.applicants);

  const prompt = `You are a recruiting analytics expert. Based on this hiring data, give a 3-5 bullet point budget recommendation.

Data by source:
${JSON.stringify(bySource, null, 2)}

Provide:
1. Which sources are generating the best quality candidates (highest match scores)
2. Which sources convert best (applicants → hired)
3. Where to increase/decrease budget
4. Any surprising insights

Format as concise bullet points starting with •. Be specific and data-driven.`;

  const completion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return NextResponse.json({ recommendation: completion.choices[0]?.message?.content?.trim() ?? "" });
}
