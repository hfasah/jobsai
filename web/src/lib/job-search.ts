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
  { code: "africa", label: "Africa", currency: "USD", region: "Africa", flag: "🌍" },
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
export type Provider = "adzuna" | "jsearch" | "free" | "blend";

// How many countries a single search may span. Bounds API fan-out/quota:
// each country = up to 1 Adzuna + 1 JSearch request when blending.
export const MAX_COUNTRIES = 3;

export interface SearchParams {
  what: string;
  where?: string;
  /** Primary country (back-compat). Prefer `countries`. */
  country: string;
  /** One or more countries to aggregate across. Falls back to [country]. */
  countries?: string[];
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

// Common acronyms expanded so sparse searches ("HPC") still match the many
// listings that spell the role out ("High Performance Computing"). Keyed by the
// whole query, lowercased — only fires when the query IS the acronym.
const ACRONYM_EXPANSIONS: Record<string, string> = {
  hpc: "high performance computing",
  ml: "machine learning",
  ai: "artificial intelligence",
  nlp: "natural language processing",
  qa: "quality assurance",
  sre: "site reliability engineer",
  swe: "software engineer",
  sde: "software development engineer",
  pm: "product manager",
  po: "product owner",
  ux: "user experience designer",
  ui: "user interface designer",
  ba: "business analyst",
  bi: "business intelligence",
  etl: "data engineer",
  dba: "database administrator",
  iam: "identity and access management",
  hr: "human resources",
  seo: "search engine optimization",
};

// JSearch free-text query, broadened for recognized acronyms. Adzuna already
// matches acronyms well, so only JSearch (the sparse one for niche terms) uses
// the expansion — keeping both the acronym and the spelled-out form.
function jsearchQuery(what: string): string {
  const raw = what.trim();
  if (!raw) return "jobs";
  const exp = ACRONYM_EXPANSIONS[raw.toLowerCase()];
  return exp ? `${raw} ${exp}` : raw;
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

async function searchJSearch(
  p: SearchParams,
  countryOverride?: string,
): Promise<SearchResult | null> {
  const key = process.env.JSEARCH_RAPIDAPI_KEY;
  if (!key) return null;

  const country = COUNTRY_BY_CODE.get(p.country) ?? SEARCH_COUNTRIES[0];
  const jsCountry = countryOverride ?? country.code;
  const uiPage = Math.max(1, p.page ?? 1);
  // Each UI page = 2 JSearch pages (~20 results) for cleaner pagination.
  const jsPage = (uiPage - 1) * 2 + 1;

  const query = [jsearchQuery(p.what), p.where?.trim() ? `in ${p.where.trim()}` : ""].join(" ").trim();
  const params = new URLSearchParams({
    query,
    page: String(jsPage),
    num_pages: "2",
    country: jsCountry,
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
    const loc = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : jsCountry.toUpperCase());
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

  // Narrow to the selected publishers (Job Sites chips) — but softly. JSearch
  // aggregates Google-for-Jobs and frequently labels Indeed/LinkedIn listings
  // under mirror/aggregator names (BeBee, Talent.com, Recruit.net, Jooble…), so
  // a hard publisher filter silently drops valid jobs and empties the board for
  // niche queries. So: skip filtering when every site is selected (= "all
  // sources"), and never let the filter zero out real results — if nothing
  // matches the chosen publishers, keep the full set instead of returning empty.
  const sites = (p.jobSites ?? []).map((s) => s.toLowerCase());
  const allSelected = sites.length >= JOB_SITES.length;
  if (sites.length && !allSelected) {
    const matched = jobs.filter((j) => {
      const pub = (j.publisher ?? "").toLowerCase();
      return sites.some((s) => pub.includes(s));
    });
    if (matched.length) jobs = matched;
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

async function searchAfrica(p: SearchParams): Promise<SearchResult | null> {
  const key = process.env.JSEARCH_RAPIDAPI_KEY;
  if (!key) return null;

  // Remote markets: biggest sources of remote-friendly roles open to Africans.
  const remoteMarkets = ["us", "gb", "ca", "au"];
  // African markets: jobs physically in Africa (remote + on-site).
  const africanMarkets = ["za", "ng", "ke", "gh", "eg"];

  const searches = await Promise.allSettled([
    ...remoteMarkets.map((code) =>
      searchJSearch({ ...p, country: "us", remote: true }, code),
    ),
    ...africanMarkets.map((code) =>
      searchJSearch({ ...p, country: "us" }, code),
    ),
  ]);

  const seen = new Set<string>();
  const allJobs: SearchJob[] = [];
  for (const r of searches) {
    if (r.status === "fulfilled" && r.value) {
      for (const job of r.value.jobs) {
        if (!seen.has(job.id)) { seen.add(job.id); allJobs.push(job); }
      }
    }
  }
  if (allJobs.length === 0) return null;

  const uiPage = Math.max(1, p.page ?? 1);
  return {
    jobs: allJobs,
    count: allJobs.length,
    totalKnown: false,
    page: uiPage,
    perPage: PER_PAGE,
    provider: "jsearch",
    configured: true,
    sources: ["JSearch"],
  };
}

// ─── Aggregation (blend across engines + countries) ────────────────────────────

const BLEND_MAX = 60;

function jobKey(j: SearchJob): string {
  return `${j.title.toLowerCase().trim()}|${j.company.toLowerCase().trim()}`;
}

// De-dupe the same role surfaced by multiple engines (e.g. a LinkedIn job that
// also appears in Adzuna), by title+company and by URL (sans query string).
function dedupeJobs(jobs: SearchJob[]): SearchJob[] {
  const seen = new Set<string>();
  const out: SearchJob[] = [];
  for (const j of jobs) {
    const k = jobKey(j);
    const urlKey = (j.url || "").split("?")[0].toLowerCase();
    if (seen.has(k) || (urlKey && seen.has(urlKey))) continue;
    seen.add(k);
    if (urlKey) seen.add(urlKey);
    out.push(j);
  }
  return out;
}

// Round-robin merge so the top of the list is a diverse mix of sources/countries
// (showcases the aggregation) rather than all-Adzuna then all-JSearch.
function interleave(lists: SearchJob[][]): SearchJob[] {
  const out: SearchJob[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

// The product's core value: one search, every source, across one or more
// countries. Fan out to Adzuna + JSearch per country, merge, de-dupe, interleave.
async function searchBlended(p: SearchParams, countries: string[]): Promise<SearchResult> {
  const tasks: Promise<SearchResult | null>[] = [];
  for (const c of countries) {
    if (c === "africa") {
      tasks.push(searchAfrica({ ...p, country: c }).catch(() => null));
    } else {
      tasks.push(searchAdzuna({ ...p, country: c }).catch(() => null));
      tasks.push(searchJSearch({ ...p, country: c }).catch(() => null));
    }
  }

  const settled = await Promise.allSettled(tasks);
  const lists: SearchJob[][] = [];
  const sources = new Set<string>();
  let configured = false;
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) {
      if (s.value.jobs.length) lists.push(s.value.jobs);
      s.value.sources.forEach((x) => sources.add(x));
      if (s.value.configured) configured = true;
    }
  }
  if (!lists.length) return searchFreeSources(p);

  let merged = dedupeJobs(interleave(lists));
  if (p.sort === "date") {
    merged.sort((a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0));
  } else if (p.sort === "salary") {
    merged.sort((a, b) => (b.salaryMax ?? b.salaryMin ?? 0) - (a.salaryMax ?? a.salaryMin ?? 0));
  }
  merged = merged.slice(0, BLEND_MAX);

  return {
    jobs: merged,
    count: merged.length,
    totalKnown: false,
    page: Math.max(1, p.page ?? 1),
    perPage: PER_PAGE,
    provider: "blend",
    configured,
    sources: [...sources],
  };
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function searchJobs(p: SearchParams): Promise<SearchResult> {
  const countries = (p.countries?.length ? p.countries : [p.country])
    .filter(Boolean)
    .slice(0, MAX_COUNTRIES);

  const hasJSearch = !!process.env.JSEARCH_RAPIDAPI_KEY;

  // Aggregation is the point: blend every configured source across the selected
  // countries whenever JSearch is available (so Indeed/LinkedIn always show
  // alongside Adzuna) or more than one country is chosen. searchBlended never
  // throws — it falls back to free sources internally.
  if (hasJSearch || countries.length > 1) {
    const blended = await searchBlended(p, countries);
    return blended;
  }

  // Single country, no JSearch key: original single-engine path (keeps Adzuna's
  // real grand total + pagination for that common case).
  const single = { ...p, country: countries[0] ?? p.country };
  if (single.country === "africa") {
    try {
      const africa = await searchAfrica(single);
      if (africa) return africa;
    } catch (err) {
      console.error("Africa search failed, falling back:", err);
    }
    return searchFreeSources(single);
  }
  try {
    const adzuna = await searchAdzuna(single);
    if (adzuna) return adzuna;
  } catch (err) {
    console.error("Adzuna search failed, falling back to free sources:", err);
  }
  return searchFreeSources(single);
}
