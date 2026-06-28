import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { enforceLimit } from "@/lib/enterprise-limits";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";
import { getOrCreateIntakePool, createIntakeApplication, firstEmail, storeResumeFile } from "@/lib/enterprise-intake-inbox";

export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// POST (multipart) — recruiter uploads a resume for review. Extracts text,
// derives the candidate's name/email (from the form or the resume itself),
// creates an application, and auto-screens when tied to a real posting.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const lim = await enforceLimit(userId, "candidates");
  if (lim) return lim;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)." }, { status: 400 });
  }

  let text = "";
  let resumeStorageKey: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const out = await extractText(buffer, file.type);
    text = out.text;
    // Keep the original file for download as-uploaded.
    resumeStorageKey = await storeResumeFile(org.id, buffer, file.name, file.type);
  } catch {
    return NextResponse.json(
      { error: "Couldn't read that file. Upload a PDF or Word (.docx) resume." },
      { status: 422 },
    );
  }
  if (text.trim().length < 50) {
    return NextResponse.json(
      { error: "No readable text found (a scanned/image PDF can't be parsed)." },
      { status: 422 },
    );
  }

  // Identity + skills: prefer what the recruiter typed for identity; always
  // parse the résumé so we capture skills (for the Skills column + search).
  let name = (form?.get("name") as string | null)?.trim() || "";
  let email = ((form?.get("email") as string | null)?.trim() || "").toLowerCase();
  let phone = (form?.get("phone") as string | null)?.trim() || "";
  let location = (form?.get("location") as string | null)?.trim() || "";
  let skills: string[] = [];
  try {
    const parsed = await parseResumeText(text);
    name = name || (parsed.name ?? "").trim();
    email = email || (parsed.email ?? "").trim().toLowerCase();
    phone = phone || (parsed.phone ?? "").trim();
    location = location || (parsed.location ?? "").trim();
    skills = Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s).trim()).filter(Boolean) : [];
  } catch { /* fall back to regex below */ }
  if (!email) email = firstEmail(text) ?? "";
  if (!email) {
    return NextResponse.json(
      { error: "Couldn't find an email on the resume — add the candidate's email and retry." },
      { status: 422 },
    );
  }
  if (!name) name = email.split("@")[0];

  // Target job: a real posting (auto-screened) or the General Applications pool.
  const requestedJob = (form?.get("job_id") as string | null)?.trim() || "";
  let jobId = "";
  let isPool = false;
  if (requestedJob) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("id, is_intake_pool")
      .eq("id", requestedJob)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    jobId = job.id;
    isPool = !!job.is_intake_pool;
  } else {
    const poolId = await getOrCreateIntakePool(org.id, userId);
    if (!poolId) return NextResponse.json({ error: "Couldn't open the intake pool." }, { status: 500 });
    jobId = poolId;
    isPool = true;
  }

  const { id, deduped } = await createIntakeApplication({
    orgId: org.id, jobId, name, email, phone: phone || null, location: location || null, resumeText: text, resumeStorageKey, skills, source: "upload",
  });
  if (!id) return NextResponse.json({ error: "Couldn't save the candidate." }, { status: 500 });

  // Auto-screen only against a real posting (the pool has no JD to score on).
  if (!deduped && !isPool) {
    after(async () => {
      await fetch(`${APP_URL}/api/enterprise/jobs/${jobId}/applications/${id}/screen`, {
        method: "POST", headers: { "x-internal-auto-screen": "1" },
      }).catch(() => {});
    });
  }

  return NextResponse.json({ data: { id, name, email, deduped, screening: !isPool && !deduped } }, { status: 201 });
}
