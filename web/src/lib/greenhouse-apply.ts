import type { ApplyProfile } from "@/types/apply";

// Deterministic Greenhouse adapter — submits straight to the public Greenhouse
// Job Board API (no browser, no AI, ~$0/application). Best-effort by design: if
// the board is auth-gated, reCAPTCHA-protected, or has required custom questions
// we can't answer, the submit fails and the caller falls through to the browser
// agent — so this is pure upside with no regression.
//
// Docs: https://developers.greenhouse.io/job-board.html

// Board token + job id from the common Greenhouse URL shapes:
//   https://boards.greenhouse.io/{token}/jobs/{id}
//   https://job-boards.greenhouse.io/{token}/jobs/{id}
//   https://boards.greenhouse.io/embed/job_app?for={token}&token={id}
export function parseGreenhouseUrl(url: string): { token: string; jobId: string } | null {
  try {
    const u = new URL(url);
    // Embedded application form
    if (u.pathname.includes("/embed/job_app")) {
      const token = u.searchParams.get("for");
      const jobId = u.searchParams.get("token");
      if (token && jobId) return { token, jobId: jobId.replace(/\D/g, "") || jobId };
    }
    // Hosted board: /{token}/jobs/{id}
    const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
    if (m) return { token: m[1], jobId: m[2] };
    // Career page embed: ?gh_jid={id} — token isn't in the URL, can't submit via API
    return null;
  } catch {
    return null;
  }
}

interface GhField { name: string; type: string; required?: boolean }
interface GhQuestion { label: string; required?: boolean; fields?: GhField[] }
interface GhJob { questions?: GhQuestion[] }

// Standard Greenhouse field names we can answer from the apply profile.
function valueForField(name: string, profile: ApplyProfile, coverLetter: string): string | null {
  switch (name) {
    case "first_name": return profile.first_name || null;
    case "last_name":  return profile.last_name || null;
    case "email":      return profile.email || null;
    case "phone":      return profile.phone || null;
    case "cover_letter_text":
    case "cover_letter": return coverLetter || null;
    default:
      // Common custom URL questions
      if (/linkedin/i.test(name)) return profile.linkedin_url || null;
      if (/github/i.test(name)) return profile.github_url || null;
      if (/portfolio|website/i.test(name)) return profile.portfolio_url || profile.website_url || null;
      return null;
  }
}

export async function submitToGreenhouse(
  token: string,
  jobId: string,
  profile: ApplyProfile,
  resumeBlob: Blob,
  resumeFilename: string,
  coverLetter: string,
): Promise<{ ok: boolean; message?: string }> {
  const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs/${encodeURIComponent(jobId)}`;

  // 1. Fetch the application questions so we can fill required fields and detect
  //    any required custom question we can't answer (→ bail, let the agent try).
  let questions: GhQuestion[] = [];
  try {
    const infoRes = await fetch(`${base}?questions=true`, { signal: AbortSignal.timeout(15_000) });
    if (!infoRes.ok) return { ok: false, message: `Greenhouse job info ${infoRes.status}` };
    const job = (await infoRes.json()) as GhJob;
    questions = job.questions ?? [];
  } catch (e) {
    return { ok: false, message: `Greenhouse job info error: ${e instanceof Error ? e.message : e}` };
  }

  const form = new FormData();
  // Always-present standard fields.
  if (profile.first_name) form.append("first_name", profile.first_name);
  if (profile.last_name)  form.append("last_name", profile.last_name);
  if (profile.email)      form.append("email", profile.email);
  if (profile.phone)      form.append("phone", profile.phone);
  form.append("resume", new File([resumeBlob], resumeFilename, { type: resumeBlob.type }));

  // Fill mappable question fields; if a REQUIRED field is one we can't answer
  // (and isn't the resume/name/email we already set), bail to the agent rather
  // than submit an incomplete application that Greenhouse would reject anyway.
  const handled = new Set(["first_name", "last_name", "email", "phone", "resume"]);
  for (const q of questions) {
    for (const f of q.fields ?? []) {
      if (handled.has(f.name)) continue;
      const val = valueForField(f.name, profile, coverLetter);
      if (val != null) {
        form.append(f.name, val);
      } else if (q.required || f.required) {
        return { ok: false, message: `Unanswerable required question: ${q.label || f.name}` };
      }
    }
  }

  // 2. Submit the application (public boards accept this without a key; gated
  //    boards 401/403 → fall through to the browser agent).
  try {
    const res = await fetch(base, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return { ok: false, message: `Greenhouse submit ${res.status}: ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, message: `Greenhouse submit error: ${e instanceof Error ? e.message : e}` };
  }
}
