import type { UserPreferences } from "@/types/preferences";

export interface DiscoveredJob {
  id: string;
  source: "remoteok" | "adzuna";
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  description: string;
  url: string;
  tags: string[];
  posted_at?: string;
  employment_type?: string;
}

// ─── Shared filter ────────────────────────────────────────────────────────────

function passesFilters(job: DiscoveredJob, prefs: UserPreferences): boolean {
  // Excluded companies
  const company = job.company.toLowerCase();
  if (prefs.excluded_companies.some((c) => company.includes(c.toLowerCase()))) return false;

  // Salary floor (only filter if job has a salary_max)
  if (
    prefs.min_salary &&
    job.salary_max != null &&
    job.salary_max < prefs.min_salary * 0.8 // 20% tolerance
  )
    return false;

  return true;
}

// ─── Relevance score (for sorting) ───────────────────────────────────────────

function relevanceScore(job: DiscoveredJob, prefs: UserPreferences): number {
  const haystack = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  let score = 0;

  for (const t of prefs.job_titles) {
    const words = t.toLowerCase().split(/\s+/);
    if (words.every((w) => haystack.includes(w))) score += 3;
    else if (words.some((w) => haystack.includes(w))) score += 1;
  }
  for (const k of prefs.keywords) {
    if (haystack.includes(k.toLowerCase())) score += 1;
  }

  return score;
}

// ─── RemoteOK ─────────────────────────────────────────────────────────────────

interface RemoteOKJob {
  id: string;
  position: string;
  company: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  url: string;
  tags?: string[];
  date?: string;
}

function isRemoteOKJob(v: unknown): v is RemoteOKJob {
  return typeof v === "object" && v !== null && "position" in v && "company" in v;
}

export async function fetchRemoteOK(prefs: UserPreferences): Promise<DiscoveredJob[]> {
  // Build tag query from job titles + keywords
  const terms = [...prefs.job_titles, ...prefs.keywords]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 6);

  const qs = terms.length ? `?tags=${encodeURIComponent(terms.join(","))}` : "";
  const url = `https://remoteok.com/api${qs}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "JobsAI/1.0 (jobsai.app)" },
    signal: AbortSignal.timeout(20_000),
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!res.ok) throw new Error(`RemoteOK error: ${res.status}`);

  const raw = (await res.json()) as unknown[];
  return (raw as unknown[])
    .filter(isRemoteOKJob)
    .map(
      (j): DiscoveredJob => ({
        id: `remoteok-${j.id}`,
        source: "remoteok",
        title: j.position,
        company: j.company,
        location: j.location ?? "Remote",
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        currency: "USD",
        description: j.description
          ? j.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
          : "",
        url: j.url,
        tags: j.tags ?? [],
        posted_at: j.date,
        employment_type: "full-time",
      })
    )
    .filter((j) => passesFilters(j, prefs));
}

// ─── Adzuna ──────────────────────────────────────────────────────────────────

const CURRENCY_COUNTRY: Record<string, string> = {
  USD: "us", GBP: "gb", EUR: "de", CAD: "ca",
  AUD: "au", SGD: "sg", INR: "in",
};

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  description: string;
  redirect_url: string;
  created: string;
  contract_time?: string;
}

export async function fetchAdzuna(prefs: UserPreferences): Promise<DiscoveredJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const what =
    prefs.job_titles.length > 0
      ? prefs.job_titles.join(" OR ")
      : prefs.keywords.slice(0, 3).join(" OR ");

  if (!what.trim()) return [];

  const country = CURRENCY_COUNTRY[prefs.salary_currency] ?? "us";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: prefs.location_type === "remote" ? `${what} remote` : what,
    "content-type": "application/json",
  });

  if (prefs.min_salary) params.set("salary_min", String(prefs.min_salary));
  if (prefs.employment_types.includes("full-time")) params.set("full_time", "1");
  if (prefs.employment_types.includes("contract")) params.set("contract", "1");
  if (prefs.employment_types.includes("part-time")) params.set("part_time", "1");
  if (prefs.locations.length && prefs.location_type !== "remote") {
    params.set("where", prefs.locations[0]);
  }

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: AdzunaJob[] };
  return (data.results ?? [])
    .map(
      (j): DiscoveredJob => ({
        id: `adzuna-${j.id}`,
        source: "adzuna",
        title: j.title,
        company: j.company.display_name,
        location: j.location.display_name,
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        currency: prefs.salary_currency,
        description: j.description?.replace(/<[^>]+>/g, " ").trim().slice(0, 400) ?? "",
        url: j.redirect_url,
        tags: [],
        posted_at: j.created,
        employment_type: j.contract_time ?? undefined,
      })
    )
    .filter((j) => passesFilters(j, prefs));
}

// ─── Combined discovery ───────────────────────────────────────────────────────

export async function discoverJobs(prefs: UserPreferences): Promise<{
  jobs: DiscoveredJob[];
  sources: string[];
  errors: string[];
}> {
  const results = await Promise.allSettled([
    fetchRemoteOK(prefs),
    fetchAdzuna(prefs),
  ]);

  const jobs: DiscoveredJob[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  const [remoteOK, adzuna] = results;

  if (remoteOK.status === "fulfilled" && remoteOK.value.length > 0) {
    jobs.push(...remoteOK.value);
    sources.push("RemoteOK");
  } else if (remoteOK.status === "rejected") {
    errors.push("RemoteOK unavailable");
  }

  if (adzuna.status === "fulfilled" && adzuna.value.length > 0) {
    jobs.push(...adzuna.value);
    sources.push("Adzuna");
  }
  // Adzuna silently returns [] if no key — not an error

  // Dedupe by URL, sort by relevance then recency
  const seen = new Set<string>();
  const deduped = jobs.filter((j) => {
    const key = j.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    const scoreDiff = relevanceScore(b, prefs) - relevanceScore(a, prefs);
    if (scoreDiff !== 0) return scoreDiff;
    const da = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const db = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return db - da;
  });

  return { jobs: deduped.slice(0, 40), sources, errors };
}
