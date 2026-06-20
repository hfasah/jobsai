import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { loadResumeProfile, isContextError } from "@/lib/job-context";
import { buildSkillResume } from "@/lib/ai-content";
import { fillExperienceDates } from "@/lib/resume-dates";

// POST /api/resumes/build  { skills: string[], role?: string }
// Optimizes the user's primary resume to surface a set of target skills.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const skills: string[] = Array.isArray(body.skills)
    ? body.skills.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 25)
    : [];
  const role: string | undefined = typeof body.role === "string" ? body.role.trim() || undefined : undefined;
  const resumeVersionId: string | undefined =
    typeof body.resume_version_id === "string" && body.resume_version_id ? body.resume_version_id : undefined;

  if (skills.length === 0) {
    return NextResponse.json({ error: "Add at least one target skill." }, { status: 400 });
  }

  const ctx = await loadResumeProfile(userId, resumeVersionId);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const result = await buildSkillResume(ctx.resumeProfile, skills, role);
    if (result.tailored_json?.experience) {
      result.tailored_json.experience = fillExperienceDates(
        result.tailored_json.experience,
        ctx.resumeProfile.experience ?? []
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Resume build error:", err);
    return NextResponse.json({ error: "Build failed. Please try again." }, { status: 500 });
  }
}
