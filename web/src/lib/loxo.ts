// Direct Loxo ATS integration (Loxo isn't on Merge). Auth is a Bearer API key
// the customer generates in Loxo → Settings → API Keys, scoped to their agency
// slug. Base URL: https://app.loxo.co/api/{agency}/…
//
// NOTE: Loxo's response shapes vary by endpoint/account. The extractors below
// are defensive (try several common keys) and the candidate pull is best-effort
// per job — verify field mapping against a live agency before relying on it.

const DEFAULT_HOST = "https://app.loxo.co";

function baseUrl(agency: string): string {
  const slug = agency.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // If they gave a full host (e.g. acme.app.loxo.co), use it; else the default.
  return slug.includes(".") ? `https://${slug.split("/")[0]}/api/${slug.split("/").pop() || slug}` : `${DEFAULT_HOST}/api/${slug}`;
}

async function loxoGet<T = unknown>(
  agency: string, apiKey: string, path: string, params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${baseUrl(agency)}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Loxo GET ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// Pull the first array we recognise from a Loxo payload.
function pickArray(json: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  const obj = (json ?? {}) as Record<string, unknown>;
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[];
  return [];
}
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) return String((v as { name?: unknown }).name ?? "");
  return v == null ? "" : String(v);
}

// Validate credentials by making one lightweight call.
export async function loxoTest(agency: string, apiKey: string): Promise<{ ok: true }> {
  await loxoGet(agency, apiKey, "/jobs", { per_page: "1" });
  return { ok: true };
}

export type LoxoJob = { id: string; title: string; status: string };

// Jobs use page-based pagination (page / per_page).
export async function listLoxoJobs(agency: string, apiKey: string, maxPages = 20): Promise<LoxoJob[]> {
  const out: LoxoJob[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await loxoGet(agency, apiKey, "/jobs", { page: String(page), per_page: "100" });
    const rows = pickArray(json, ["jobs", "results"]);
    if (rows.length === 0) break;
    for (const r of rows) {
      const id = str(r.id);
      if (!id) continue;
      out.push({
        id,
        title: str(r.title) || str(r.name) || "Untitled role",
        status: str(r.status) || (r.published_at ? "published" : "draft"),
      });
    }
    if (rows.length < 100) break;
  }
  return out;
}

export type LoxoCandidate = { externalId: string; name: string; email: string };

// Candidates on a job. Best-effort: tries the per-job candidates endpoint and a
// couple of common response shapes; returns [] (not throw) if unavailable so a
// missing/renamed endpoint never fails the whole sync.
export async function listLoxoJobCandidates(agency: string, apiKey: string, jobId: string): Promise<LoxoCandidate[]> {
  try {
    const json = await loxoGet(agency, apiKey, `/jobs/${jobId}/job_candidates`, { per_page: "100" });
    const rows = pickArray(json, ["job_candidates", "candidates", "results"]);
    const out: LoxoCandidate[] = [];
    for (const r of rows) {
      // The person can be nested (job_candidate.person) or flat.
      const person = (r.person ?? r.candidate ?? r) as Record<string, unknown>;
      const externalId = str(person.id) || str(r.id);
      if (!externalId) continue;
      const name = str(person.name) || [person.first_name, person.last_name].filter(Boolean).map(str).join(" ").trim();
      const emails = person.emails ?? person.email_addresses;
      const email = Array.isArray(emails)
        ? str((emails[0] as Record<string, unknown>)?.value ?? (emails[0] as Record<string, unknown>)?.email ?? emails[0])
        : str(person.email);
      if (!name && !email) continue;
      out.push({ externalId, name: name || email, email });
    }
    return out;
  } catch (e) {
    console.error(`Loxo candidates for job ${jobId} unavailable`, e);
    return [];
  }
}
