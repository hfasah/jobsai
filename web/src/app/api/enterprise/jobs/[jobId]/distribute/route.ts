import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 45;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

const PLATFORMS = ["linkedin", "indeed", "twitter", "email", "google_jobs"] as const;
type Platform = typeof PLATFORMS[number];

const PLATFORM_INSTRUCTIONS: Record<Platform, string> = {
  linkedin:    "LinkedIn job post (200-250 words). Professional, skimmable, starts with a hook about the role/company. Include key requirements as bullet points. End with 'Apply at [APPLY_LINK]'.",
  indeed:      "Indeed job ad (150-200 words). Keyword-optimised for ATS search. Clear structure: role summary, key duties (5 bullets), must-have skills (4 bullets). End with 'Apply at [APPLY_LINK]'.",
  twitter:     "Twitter/X thread (3 tweets). Tweet 1: hook (max 280 chars, end with 🧵). Tweet 2: role highlights + salary. Tweet 3: how to apply with link [APPLY_LINK] and 3 relevant hashtags.",
  email:       "Recruiting email to send to your talent network (150 words). Subject line included. Warm, personal tone. Highlights opportunity + compensation. Ends with apply link [APPLY_LINK].",
  google_jobs: "Concise job summary for Google Jobs structured data (100-120 words). Plain text, no markdown. Focus on responsibilities and qualifications. Include location, employment type, and salary.",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("enterprise_distributions")
    .select("*")
    .eq("job_id", jobId)
    .eq("org_id", org.id);

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const applyUrl = `${APP_URL}/enterprise/jobs/${jobId}/apply`;

  const jobContext = `
Company: ${org.name}${org.industry ? ` (${org.industry})` : ""}
Role: ${job.title}${job.department ? `, ${job.department}` : ""}
Location: ${job.location ?? "Not specified"}
Type: ${job.employment_type}
${job.salary_min && job.salary_max ? `Salary: $${job.salary_min.toLocaleString()}–$${job.salary_max.toLocaleString()} ${job.salary_currency}` : ""}
${job.description ? `Overview: ${job.description.slice(0, 300)}` : ""}
${job.qualifications ? `Requirements: ${job.qualifications.slice(0, 300)}` : ""}
`;

  // Generate all platform versions in parallel
  const results = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const instruction = PLATFORM_INSTRUCTIONS[platform];
      const trackingUrl = `${APP_URL}/api/enterprise/jobs/${jobId}/track?source=${platform}&redirect=apply`;

      const completion = await ai().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Write a ${instruction}\n\nJob details:\n${jobContext}\nApply link: ${applyUrl}\n\nReplace [APPLY_LINK] with: ${trackingUrl}`,
        }],
      });

      const content = completion.choices[0]?.message?.content?.trim() ?? "";

      // Upsert into DB
      const { data } = await supabaseAdmin
        .from("enterprise_distributions")
        .upsert({
          job_id: jobId,
          org_id: org.id,
          platform,
          content,
          tracking_url: trackingUrl,
          published_at: new Date().toISOString(),
        }, { onConflict: "job_id,platform" })
        .select("*")
        .single();

      return data;
    })
  );

  return NextResponse.json({ data: results });
}
