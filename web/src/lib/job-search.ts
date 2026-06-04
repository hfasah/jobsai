// Interactive multi-region job search. Primary engine is Adzuna (US, Canada, UK,
// and EU countries — real totals + pagination + location). When Adzuna isn't
// configured, we fall back to free, key-less sources (RemoteOK + Arbeitnow) so
// the page is never empty, and the UI shows a "connect Adzuna" banner.

export type RegionGroup = "USA" | "Canada" | "Britain" | "EU";

export interface SearchCountry {
  code: string;       // Adzuna country code
  label: string;
  currency: string;
  region: RegionGroup;
  flag: string;
}

// Adzuna-supported countries grouped by the four target regions.
export const SEARCH_COUNTRIES: SearchCountry[] = [
  { code: "us", label: "United States", currency: "USD", region: "USA", flag: "🇺🇸" },
  { code: "ca", label: "Canada", currency: "CAD", region: "Canada", flag: "🇨🇦" },
  { code: "gb", label: "United Kingdom", currency: "GBP", region: "Britain", flag: "🇬🇧" },
  { code: "de", label: "Germany", currency: "EUR", region: "EU", flag: "🇩🇪" },
  { code: "fr", label: "France", currency: "EUR", region: "EU", flag: "🇫🇷" },
  { code: "nl", label: "Netherlands", currency: "EUR", region: "EU", flag: "🇳🇱" },
  { code: "es", label: "Spain", currency: "EUR", region: "EU", flag: "🇪🇸" },
  { code: "it", label: "Italy", currency: "EUR", region: "EU", flag: "🇮🇹" },
  { code: "pl", label: "Poland", currency: "PLN", region: "EU", flag: "🇵🇱" },
  { code: "at", label: "Austria", currency: "EUR", region: "EU", flag: "🇦🇹" },
  { code: "be", label: "Belgium", currency: "EUR", region: "EU", flag: "🇧🇪" },
];

const COUNTRY_BY_CODE = new Map(SEARCH_COUNTRIES.map((c) => [c.code, c]));

export interface SearchJob {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  description: string;
  url: string;
  postedAt: string | null;
  contractTime: string | null;
  remote: boolean;
  category: string | null;
}

export type SortKey = "relevance" | "date" | "salary";

export interface SearchParams {
  what: string;
  where?: string;
  country: string;
  page?: number;
  sort?: SortKey;
  salaryMin?: number;
  fullTime?: boolean;
  contract?: boolean;
  remote?: boolean;
  maxDaysOld?: number;
}

export interface SearchResult {
  jobs: SearchJob[];
  count: number;       // total matches (Adzuna total, or list length for free sources)
  page: number;
  perPage: number;
  configured: boolean; // is Adzuna configured?
  sources: string[];
}

export const PER_PAGE = 20;

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Adzuna (primary) ─────────────────────────────────────────────────────────

interface AdzunaJob {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  description?: string;
  redirect_url: string;
  created?: string;
  contract_time?: string;
  category?: { label?: string };
}

async function searchAdzuna(p: SearchParams): Promise<SearchResult | null> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;

  const country = COUNTRY_BY_CODE.get(p.country) ?? SEARCH_COUNTRIES[0];
  const page = Math.max(1, p.page ?? 1);

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(PER_PAGE),
    "content-type": "application/json",
  });
  const what = p.remote ? `${p.what} remote`.trim() : p.what.trim();
  if (what) params.set("what", what);
  if (p.where?.trim()) params.set("where", p.where.trim());
  if (p.salaryMin) params.set("salary_min", String(p.salaryMin));
  if (p.fullTime) params.set("full_time", "1");
  if (p.contract) params.set("contract", "1");
  if (p.maxDaysOld) params.set("max_days_old", String(p.maxDaysOld));
  if (p.sort === "date") params.set("sort_by", "date");
  else if (p.sort === "salary") params.set("sort_by", "salary");
  else params.set("sort_by", "relevance");

  const url = `https://api.adzuna.com/v1/api/jobs/${country.code}/search/${page}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);

  const data = (await res.json()) as { count?: number; results?: AdzunaJob[] };
  const jobs: SearchJob[] = (data.results ?? []).map((j) => {
    const loc = j.location?.display_name ?? country.label;
    return {
      id: `adzuna-${j.id}`,
      source: "Adzuna",
      title: j.title ?? "Untitled role",
      company: j.company?.display_name ?? "—",
      location: loc,
      salaryMin: j.salary_min ?? null,
      salaryMax: j.salary_max ?? null,
      currency: country.currency,
      description: stripHtml(j.description).slice(0, 1200),
      url: j.redirect_url,
      postedAt: j.created ?? null,
      contractTime: j.contract_time ?? null,
      remote: /remote/i.test(`${j.title} ${loc}`),
      category: j.category?.label ?? null,
    };
  });

  return {
    jobs,
    count: data.count ?? jobs.length,
    page,
    perPage: PER_PAGE,
    configured: true,
    sources: ["Adzuna"],
  };
}

// ─── Free, key-less fallback sources ──────────────────────────────────────────

interface RemoteOKJob {
  id?: string | number; position?: string; company?: string; location?: string;
  salary_min?: number; salary_max?: number; description?: string; url?: string;
  tags?: string[]; date?: string;
}

async function fetchRemoteOK(): Promise<SearchJob[]> {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "JobsAI/1.0 (jobsai.app)" },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as unknown[];
  return (raw.filter((j) => typeof j === "object" && j !== null && "position" in j) as RemoteOKJob[]).map((j) => ({
    id: `remoteok-${j.id}`,
    source: "RemoteOK",
    title: j.position ?? "Untitled role",
    company: j.company ?? "—",
    location: j.location || "Remote",
    salaryMin: j.salary_min ?? null,
    salaryMax: j.salary_max ?? null,
    currency: "USD",
    description: stripHtml(j.description).slice(0, 1200),
    url: j.url ?? "",
    postedAt: j.date ?? null,
    contractTime: "full_time",
    remote: true,
    category: j.tags?.[0] ?? null,
  }));
}

interface ArbeitnowJob {
  slug: string; company_name?: string; title?: string; description?: string;
  remote?: boolean; url?: string; tags?: string[]; location?: string; created_at?: number;
}

async function fetchArbeitnow(): Promise<SearchJob[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 600 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: ArbeitnowJob[] };
  return (data.data ?? []).map((j) => ({
    id: `arbeitnow-${j.slug}`,
    source: "Arbeitnow",
    title: j.title ?? "Untitled role",
    company: j.company_name ?? "—",
    location: j.location || (j.remote ? "Remote" : "Europe"),
    salaryMin: null,
    salaryMax: null,
    currency: "EUR",
    description: stripHtml(j.description).slice(0, 1200),
    url: j.url ?? "",
    postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    contractTime: null,
    remote: Boolean(j.remote),
    category: j.tags?.[0] ?? null,
  }));
}

function matchesQuery(job: SearchJob, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const hay = `${job.title} ${job.company} ${job.description} ${job.category ?? ""}`.toLowerCase();
  return terms.some((t) => hay.includes(t));
}

async function searchFreeSources(p: SearchParams): Promise<SearchResult> {
  const terms = p.what.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  const [ro, an] = await Promise.allSettled([fetchRemoteOK(), fetchArbeitnow()]);

  const sources: string[] = [];
  let all: SearchJob[] = [];
  if (ro.status === "fulfilled" && ro.value.length) { all.push(...ro.value); sources.push("RemoteOK"); }
  if (an.status === "fulfilled" && an.value.length) { all.push(...an.value); sources.push("Arbeitnow"); }

  all = all.filter((j) => j.url && matchesQuery(j, terms));
  if (p.sort === "date") {
    all.sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
  }

  const page = Math.max(1, p.page ?? 1);
  const start = (page - 1) * PER_PAGE;
  return {
    jobs: all.slice(start, start + PER_PAGE),
    count: all.length,
    page,
    perPage: PER_PAGE,
    configured: false,
    sources,
  };
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function searchJobs(p: SearchParams): Promise<SearchResult> {
  try {
    const adzuna = await searchAdzuna(p);
    if (adzuna) return adzuna;
  } catch (err) {
    console.error("Adzuna search failed, falling back to free sources:", err);
  }
  return searchFreeSources(p);
}
