import type { ApplyProfile } from "@/types/apply";

// ─── URL parsing ──────────────────────────────────────────────────────────────

// Ashby URL formats:
//   https://jobs.ashbyhq.com/{company}/{uuid}
//   https://app.ashbyhq.com/careers/{company}/{uuid}
//   https://ashbyhq.com/{company}/{uuid}
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseAshbyUrl(url: string): string | null {
  const m = url.match(UUID_RE);
  return m ? m[0] : null;
}

// ─── Ashby API types ──────────────────────────────────────────────────────────

interface AshbyField {
  path: string;
  title: string;
  isRequired: boolean;
  fieldType: string;
}

interface AshbyFormInfo {
  results?: {
    applicationFormDefinition?: {
      jobPostingId: string;
      sections: Array<{ fields: AshbyField[] }>;
    };
  };
}

interface AshbyUploadResult {
  results?: { fileHandle?: string };
}

// ─── Field mapper ─────────────────────────────────────────────────────────────

function mapField(
  path: string,
  profile: ApplyProfile,
  fullName: string,
  coverLetter: string,
  resumeHandle: string | null
): unknown {
  switch (path) {
    case "_systemfield_name":           return fullName || undefined;
    case "_systemfield_first_name":     return profile.first_name || undefined;
    case "_systemfield_last_name":      return profile.last_name || undefined;
    case "_systemfield_email":          return profile.email || undefined;
    case "_systemfield_phone":          return profile.phone || undefined;
    case "_systemfield_linkedin_url":   return profile.linkedin_url || undefined;
    case "_systemfield_github_url":     return profile.github_url || undefined;
    case "_systemfield_website_url":    return profile.portfolio_url || profile.website_url || undefined;
    case "_systemfield_cover_letter":   return coverLetter || undefined;
    case "_systemfield_location":
      return [profile.city, profile.country].filter(Boolean).join(", ") || undefined;
    case "_systemfield_resume":
      return resumeHandle ? { fileHandle: resumeHandle } : undefined;
    default:
      return undefined;
  }
}

// ─── Main submission ──────────────────────────────────────────────────────────

export async function submitToAshby(
  postingId: string,
  profile: ApplyProfile,
  resumeBlob: Blob,
  resumeFilename: string,
  coverLetter: string
): Promise<{ ok: boolean; message?: string }> {
  // 1. Fetch form definition
  const infoRes = await fetch("https://api.ashbyhq.com/applicationForm.info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobPostingId: postingId }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!infoRes.ok) {
    return { ok: false, message: `Ashby form info returned ${infoRes.status}` };
  }

  const infoJson = (await infoRes.json()) as AshbyFormInfo;
  const formDef = infoJson.results?.applicationFormDefinition;
  if (!formDef) {
    return { ok: false, message: "Ashby form definition not found" };
  }

  const fields = formDef.sections.flatMap((s) => s.fields);

  // 2. Upload resume (best-effort — submission can still proceed without it)
  let resumeHandle: string | null = null;
  try {
    const uploadForm = new FormData();
    uploadForm.append("applicationFormId", postingId);
    uploadForm.append("file", new File([resumeBlob], resumeFilename, { type: resumeBlob.type }));

    const uploadRes = await fetch("https://api.ashbyhq.com/applicationForm.uploadFile", {
      method: "POST",
      body: uploadForm,
      signal: AbortSignal.timeout(25_000),
    });

    if (uploadRes.ok) {
      const j = (await uploadRes.json()) as AshbyUploadResult;
      resumeHandle = j.results?.fileHandle ?? null;
    }
  } catch {
    // Non-fatal — continue without resume handle
  }

  // 3. Build field submissions
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const submissions: Array<{ path: string; value: unknown }> = [];

  for (const field of fields) {
    const value = mapField(field.path, profile, fullName, coverLetter, resumeHandle);
    if (value !== undefined) {
      submissions.push({ path: field.path, value });
    }
  }

  if (submissions.length === 0) {
    return { ok: false, message: "No mappable fields found in Ashby form" };
  }

  // 4. Submit
  const submitRes = await fetch("https://api.ashbyhq.com/applicationForm.submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationFormId: postingId,
      fieldSubmissions: submissions,
      source: "ashby_hosted_job_board",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (submitRes.ok) return { ok: true };

  const text = await submitRes.text().catch(() => "");
  return {
    ok: false,
    message: `Ashby submission failed (${submitRes.status}): ${text.slice(0, 300)}`,
  };
}
