// Interactive multi-region job search.
//   • Default engine: Adzuna (US/CA/UK/EU/ZA — real totals, location, pagination).
//   • Africa non-Adzuna (NG/KE/GH/EG/RW/MA): JSearch, which covers LinkedIn/Indeed globally.
//   • Job Sites chips (Indeed/LinkedIn/Glassdoor/ZipRecruiter/Google): JSearch.
//   • No keys at all: free fallback (RemoteOK + Arbeitnow) so it's never empty.

export type RegionGroup = "USA" | "Canada" | "Britain" | "EU" | "Africa";

export interface SearchCountry {
  code: string;
  label: string;
  currency: string;
  region: RegionGroup;
  flag: string;
}

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
  // Africa — ZA via Adzuna; others via JSearch
  { code: "za", label: "South Africa", currency: "ZAR", region: "Africa", flag: "🇿🇦" },
  { code: "ng", label: "Nigeria", currency: "NGN", region: "Africa", flag: "🇳🇬" },
  { code: "ke", label: "Kenya", currency: "KES", region: "Africa", flag: "🇰🇪" },
  { code: "gh", label: "Ghana", currency: "GHS", region: "Africa", flag: "🇬🇭" },
  { code: "eg", label: "Egypt", currency: "EGP", region: "Africa", flag: "🇪🇬" },
  { code: "rw", label: "Rwanda", currency: "RWF", region: "Africa", flag: "🇷🇼" },
  { code: "ma", label: "Morocco", currency: "MAD", region: "Africa", flag: "🇲🇦" },
];

const COUNTRY_BY_CODE = new Map(SEARCH_COUNTRIES.map((c) => [c.code, c]));

// Publisher chips (JSearch). id is matched case-insensitively against job_publisher.
export const JOB_SITES = [
  { id: "indeed", label: "Indeed" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "glassdoor", label: "Glassdoor" },
  { id: "ziprecruiter", label: "ZipRecruiter" },
  { id: "google", label: "Google" },
] as const;

export const EMPLOYMENT_TYPES = [
  { id: "fulltime", label: "Fulltime" },
  { id: "internship", label: "Internship" },
  { id: "contract", label: "Contract" },
  { id: "hybrid", label: "Hybrid" },
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["id"];

export interface SearchJob {
  id: string;
  source: string;
  publisher: string | null;
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
  logo: string | null;
  blocked?: boolean;
}

export type SortKey = "relevance" | "date" | "salary";
export type Provider = "adzuna" | "jsearch" | "free";

export interface SearchParams {
  what: string;
  where?: string;
  country: string;
  page?: number;
  sort?: SortKey;
  salaryMin?: number;
  employmentTypes?: EmploymentType[];
  remote?: boolean;
  jobSites?: string[];
  maxDaysOld?: number;
}

export interface SearchResult {
  jobs: SearchJob[];
  count: number;
  totalKnown: boolean;   // Adzuna gives a real grand total; JSearch/free don't
  page: number;
  perPage: number;
  provider: Provider;
  configured: boolean;   // a real provider (not the free fallback)
  sources: string[];
}

export const PER_PAGE = 20;

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function companyLogoUrl(company: string): string | null {
  if (!company || company === "—") return null;
  const domain = company
    .replace(/\s*[,.]?\s*(inc\.?|llc\.?|corp\.?|ltd\.?|plc|gmbh|ag|s\.a\.|nv|co\.?|group|company|technologies|tech|solutions|services|systems)\s*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") + ".com";
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

// ─── Adzuna (default engine) ───────────────────────────────────────────────────

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
  const et = new Set(p.employmentTypes ?? []);

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(PER_PAGE),
    "content-type": "application/json",
  });
  let what = p.what.trim();
  if (et.has("internship")) what = `${what} intern`.trim();
  if (p.remote) what = `${what} remote`.trim();
  if (et.has("hybrid")) what = `${what} hybrid`.trim();
  if (what) params.set("what", what);
  if (p.where?.trim()) params.set("where", p.where.trim());
  if (p.salaryMin) params.set("salary_min", String(p.salaryMin));
  if (et.has("fulltime")) params.set("full_time", "1");
  if (et.has("contract")) params.set("contract", "1");
  if (p.maxDaysOld) params.set("max_days_old", String(p.maxDaysOld));
  params.set("sort_by", p.sort === "date" ? "date" : p.sort === "salary" ? "salary" : "relevance");

  const url = `https://api.adzuna.com/v1/api/jobs/${country.code}/search/${page}?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);

  const data = (await res.json()) as { count?: number; results?: AdzunaJob[] };
  const jobs: SearchJob[] = (data.results ?? []).map((j) => {
    const loc = j.location?.display_name ?? country.label;
    return {
      id: `adzuna-${j.id}`,
      source: "Adzuna",
      publisher: null,
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
      logo: null,
    };
  });

  return {
    jobs,
    count: data.count ?? jobs.length,
    totalKnown: true,
    page,
    perPage: PER_PAGE,
    provider: "adzuna",
    configured: true,
    sources: ["Adzuna"],
  };
}

// ─── JSearch (publisher / Job Sites engine) ────────────────────────────────────

interface JSearchJob {
  job_id: string;
  employer_name?: string;
  employer_logo?: string;
  job_title?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
}

const EMP_TO_JSEARCH: Record<EmploymentType, string> = {
  fulltime: "FULLTIME",
  internship: "INTERN",
  contract: "CONTRACTOR",
  hybrid: "FULLTIME",
};

async function searchJSearch(p: SearchParams): Promise<SearchResult | null> {
  const key = process.env.JSEARCH_RAPIDAPI_KEY;
  if (!key) return null;

  const country = COUNTRY_BY_CODE.get(p.country) ?? SEARCH_COUNTRIES[0];
  const uiPage = Math.max(1, p.page ?? 1);
  // Each UI page = 2 JSearch pages (~20 results) for cleaner pagination.
  const jsPage = (uiPage - 1) * 2 + 1;

  const query = [p.what.trim() || "jobs", p.where?.trim() ? `in ${p.where.trim()}` : ""].join(" ").trim();
  const params = new URLSearchParams({
    query,
    page: String(jsPage),
    num_pages: "2",
    country: country.code,
    date_posted: p.maxDaysOld ? "week" : "all",
  });
  if (p.remote) params.set("work_from_home", "true");
  if (p.employmentTypes?.length) {
    params.set("employment_types", p.employmentTypes.map((e) => EMP_TO_JSEARCH[e]).join(","));
  }

  const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 120 },
  });
  if (!res.ok) throw new Error(`JSearch ${res.status}`);

  const data = (await res.json()) as { data?: JSearchJob[] };
  let jobs: SearchJob[] = (data.data ?? []).map((j) => {
    const loc = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : country.label);
    return {
      id: `jsearch-${j.job_id}`,
      source: "JSearch",
      publisher: j.job_publisher ?? null,
      title: j.job_title ?? "Untitled role",
      company: j.employer_name ?? "—",
      location: loc,
      salaryMin: j.job_min_salary ?? null,
      salaryMax: j.job_max_salary ?? null,
      currency: j.job_salary_currency ?? country.currency,
      description: stripHtml(j.job_description).slice(0, 1200),
      url: j.job_apply_link ?? "",
      postedAt: j.job_posted_at_datetime_utc ?? null,
      contractTime: j.job_employment_type ?? null,
      remote: Boolean(j.job_is_remote),
      category: null,
      logo: j.employer_logo ?? null,
    };
  });

  // Filter to the selected publishers (Job Sites chips).
  const sites = (p.jobSites ?? []).map((s) => s.toLowerCase());
  if (sites.length) {
    jobs = jobs.filter((j) => {
      const pub = (j.publisher ?? "").toLowerCase();
      return sites.some((s) => pub.includes(s));
    });
  }

  if (p.sort === "date") {
    jobs.sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
  }

  return {
    jobs: jobs.filter((j) => j.url),
    count: jobs.length,
    totalKnown: false,
    page: uiPage,
    perPage: PER_PAGE,
    provider: "jsearch",
    configured: true,
    sources: ["JSearch"],
  };
}

// ─── Free, key-less fallback ───────────────────────────────────────────────────

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
    publisher: "RemoteOK",
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
    logo: null,
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
    publisher: "Arbeitnow",
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
    logo: null,
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
    totalKnown: false,
    page,
    perPage: PER_PAGE,
    provider: "free",
    configured: false,
    sources,
  };
}

// Countries Adzuna natively supports (all others fall back to JSearch).
const ADZUNA_COUNTRIES = new Set(["us", "ca", "gb", "de", "fr", "nl", "es", "it", "pl", "at", "be", "za"]);

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function searchJobs(p: SearchParams): Promise<SearchResult> {
  // Job Sites chips OR non-Adzuna countries (African markets) → JSearch.
  const needsJSearch = (p.jobSites?.length ?? 0) > 0 || !ADZUNA_COUNTRIES.has(p.country);
  if (needsJSearch) {
    try {
      const js = await searchJSearch(p);
      if (js) return js;
    } catch (err) {
      console.error("JSearch failed, falling back:", err);
    }
  }
  if (ADZUNA_COUNTRIES.has(p.country)) {
    try {
      const adzuna = await searchAdzuna(p);
      if (adzuna) return adzuna;
    } catch (err) {
      console.error("Adzuna search failed, falling back to free sources:", err);
    }
  }
  return searchFreeSources(p);
}
