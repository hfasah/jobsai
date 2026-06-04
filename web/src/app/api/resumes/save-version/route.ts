import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { loadResumeProfile, isContextError } from "@/lib/job-context";
import { createResumeFromProfile } from "@/lib/resume-version";
import type { ParsedJson, ParsedExperience } from "@/types/resume";

type IncomingExp = {
  title?: string; company?: string;
  start_date?: string | null; end_date?: string | null; is_current?: boolean;
  bullets?: string[];
};

// POST /api/resumes/save-version
// { label, headline?, summary?, experience: IncomingExp[], skills: string[] }
// Persists an optimized resume (from Builder/Optimizer) as a new resume version,
// merged with the user's contact details + education from their primary resume.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label: string = (typeof body.label === "string" && body.label.trim()) || "Optimized Resume";

  const base = await loadResumeProfile(userId);
  if (isContextError(base)) {
    return NextResponse.json({ error: base.error }, { status: base.status });
  }
  const primary = base.resumeProfile;

  // Build experience entries: keep bullets (for preview) + a joined description.
  const incoming: IncomingExp[] = Array.isArray(body.experience) ? body.experience : [];
  const experience = incoming.map((e) => {
    const bullets = (e.bullets ?? []).map((b) => String(b)).filter(Boolean);
    return {
      title: e.title ?? "",
      company: e.company ?? "",
      start_date: e.start_date ?? undefined,
      end_date: e.end_date ?? undefined,
      is_current: e.is_current ?? false,
      description: bullets.map((b) => `• ${b}`).join("\n"),
      bullets, // extra field preserved in parsed_json (jsonb) for the preview
    } as ParsedExperience & { bullets: string[] };
  });

  const skills = Array.isArray(body.skills)
    ? body.skills.map((s: unknown) => ({ skill: String(s).trim() })).filter((s: { skill: string }) => s.skill)
    : primary.skills ?? [];

  const parsed: ParsedJson = {
    ...primary,
    headline: typeof body.headline === "string" && body.headline.trim() ? body.headline.trim() : primary.headline,
    summary: typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : primary.summary,
    experience: experience.length ? experience : primary.experience,
    skills,
  };

  try {
    const { documentId, versionId } = await createResumeFromProfile(userId, parsed, label, "optimized");
    return NextResponse.json({ data: { documentId, versionId } }, { status: 201 });
  } catch (err) {
    console.error("save-version error:", err);
    return NextResponse.json({ error: "Could not save resume version." }, { status: 500 });
  }
}
