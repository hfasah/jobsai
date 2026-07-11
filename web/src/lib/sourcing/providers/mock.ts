// Deterministic mock provider — the dev/test harness for the whole sourcing
// flow. Generates a stable synthetic talent pool from a seeded PRNG (same
// records every run, no network, no spend) and honors filters so searches
// return believable, differentiated results. Active when SOURCING_MOCK=1 or
// when no real provider key resolves.
import { normToken } from "../normalize";
import type { CandidateRef, ProviderCallOpts, SourcingProvider } from "../provider";
import type { ExternalCandidate, ProviderSearchResult, RevealResult, SourcingFilters } from "../types";

// Mulberry32 — tiny seeded PRNG, deterministic across runs.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Amara", "Boris", "Chidi", "Dana", "Elif", "Franck", "Grace", "Hassan", "Ines", "Jonas", "Kwame", "Lucia", "Mateo", "Ngozi", "Olga", "Pavel", "Quinn", "Rania", "Samuel", "Tomasz", "Uche", "Vera", "Wei", "Ximena", "Yusuf", "Zara"];
const LAST = ["Abanda", "Bergström", "Chen", "Diallo", "Eriksen", "Fowa", "García", "Haddad", "Ivanov", "Johnson", "Kamdem", "Lindqvist", "Moreau", "Nkoulou", "Okafor", "Petrov", "Quenum", "Rossi", "Schmidt", "Tanaka", "Umeh", "Vasquez", "Weber", "Yamamoto", "Zhang"];
const ROLES: { title: string; skills: string[]; industry: string }[] = [
  { title: "DevOps Engineer", skills: ["Kubernetes", "Terraform", "AWS", "Docker", "CI/CD"], industry: "Software" },
  { title: "Senior DevOps Engineer", skills: ["Kubernetes", "Terraform", "AWS", "GCP", "Helm", "ArgoCD"], industry: "Software" },
  { title: "Backend Engineer", skills: ["Go", "PostgreSQL", "Kubernetes", "gRPC", "Redis"], industry: "Software" },
  { title: "Senior Software Engineer", skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS"], industry: "Technology" },
  { title: "Frontend Engineer", skills: ["React", "TypeScript", "Next.js", "Tailwind", "GraphQL"], industry: "Technology" },
  { title: "Data Engineer", skills: ["Python", "Spark", "Airflow", "Snowflake", "dbt"], industry: "Technology" },
  { title: "Machine Learning Engineer", skills: ["Python", "PyTorch", "MLOps", "Kubernetes", "SageMaker"], industry: "Artificial Intelligence" },
  { title: "Registered Nurse", skills: ["Emergency Care", "Triage", "Patient Assessment", "ACLS", "Critical Care"], industry: "Healthcare" },
  { title: "Sales Director", skills: ["Enterprise Sales", "Salesforce", "Pipeline Management", "Negotiation"], industry: "Pharmaceuticals" },
  { title: "Recruiter", skills: ["Sourcing", "ATS", "Boolean Search", "Interviewing", "LinkedIn Recruiter"], industry: "Staffing & Recruiting" },
  { title: "Product Manager", skills: ["Roadmapping", "Agile", "SQL", "User Research", "Jira"], industry: "Technology" },
  { title: "Cloud Architect", skills: ["AWS", "Azure", "Terraform", "Networking", "Security"], industry: "Software" },
];
const LOCATIONS: { country: string; locality: string }[] = [
  { country: "canada", locality: "toronto" },
  { country: "canada", locality: "vancouver" },
  { country: "united states", locality: "new york" },
  { country: "united states", locality: "austin" },
  { country: "united kingdom", locality: "london" },
  { country: "germany", locality: "berlin" },
  { country: "france", locality: "paris" },
  { country: "cameroon", locality: "douala" },
  { country: "cameroon", locality: "yaoundé" },
  { country: "nigeria", locality: "lagos" },
  { country: "india", locality: "bangalore" },
  { country: "australia", locality: "sydney" },
];
const COMPANIES = ["Northwind Labs", "Acme Cloud", "Stellar Health", "FinEdge", "Yarabyte", "Deltaworks", "Nimbus AI", "CarePoint Group", "TalentBridge Agency", "Vertex Pharma", "BlueRiver Tech", "Obsec Technology Services"];

const POOL_SIZE = 200;

function buildPool(): ExternalCandidate[] {
  const rand = mulberry32(424242);
  const pool: ExternalCandidate[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const loc = LOCATIONS[Math.floor(rand() * LOCATIONS.length)];
    const company = COMPANIES[Math.floor(rand() * COMPANIES.length)];
    const years = Math.floor(rand() * 18) + 1;
    const handle = `${first}-${last}-${i}`.toLowerCase();
    // drop a random skill sometimes so partial matches exist
    const skills = role.skills.filter(() => rand() > 0.15);
    pool.push({
      provider_key: "mock",
      provider_record_id: `mock_${i}`,
      source_type: "provider_api",
      permitted_use: "recruitment_outreach",
      confidence: Math.round((0.7 + rand() * 0.3) * 100) / 100,
      full_name: `${first} ${last}`,
      first_name: first,
      last_name: last,
      job_title: years >= 8 && !role.title.startsWith("Senior") && rand() > 0.5 ? `Senior ${role.title}` : role.title,
      company,
      location_country: loc.country,
      location_locality: loc.locality,
      skills,
      experience_years: years,
      industries: [role.industry],
      education: rand() > 0.3 ? [{ school: "State University", degree: "BSc", field: "Computer Science", end_year: 2026 - years - 4 }] : [],
      languages: loc.country === "germany" ? ["german", "english"] : loc.country === "france" || loc.country === "cameroon" ? ["french", "english"] : ["english"],
      linkedin_url: `https://linkedin.com/in/${handle}`,
      github_url: role.industry === "Software" || role.industry === "Technology" ? `https://github.com/${handle}` : null,
      portfolio_url: null,
      has_email: rand() > 0.2,
      has_phone: rand() > 0.55,
    });
  }
  return pool;
}

let POOL: ExternalCandidate[] | null = null;
function pool(): ExternalCandidate[] {
  if (!POOL) POOL = buildPool();
  return POOL;
}

function matchesFilters(c: ExternalCandidate, f: SourcingFilters): boolean {
  const title = (c.job_title ?? "").toLowerCase();
  if (f.titles.length) {
    const hit = f.titles.some((t) => title.includes(t.toLowerCase()) || t.toLowerCase().includes(title));
    if (!hit) return false;
  }
  if (f.titles_exclude.length && f.titles_exclude.some((t) => title.includes(t.toLowerCase()))) return false;

  const skillSet = new Set(c.skills.map(normToken));
  if (f.skills_any.length && !f.skills_any.some((s) => skillSet.has(normToken(s)))) return false;
  if (f.skills_all.length && !f.skills_all.every((s) => skillSet.has(normToken(s)))) return false;
  if (f.skills_exclude.length && f.skills_exclude.some((s) => skillSet.has(normToken(s)))) return false;

  if (f.locations.length) {
    const hit = f.locations.some((l) => {
      const countryOk = (c.location_country ?? "").includes(l.country.toLowerCase());
      const localityOk = !l.locality || (c.location_locality ?? "").includes(l.locality.toLowerCase());
      return countryOk && localityOk;
    });
    if (!hit && !(f.include_unknown.location && !c.location_country)) return false;
  }
  if (f.locations_exclude.length) {
    const hit = f.locations_exclude.some((l) => (c.location_country ?? "").includes(l.country.toLowerCase()));
    if (hit) return false;
  }

  if (f.experience_years_min !== null || f.experience_years_max !== null) {
    if (c.experience_years === null) {
      if (!f.include_unknown.experience) return false;
    } else {
      if (f.experience_years_min !== null && c.experience_years < f.experience_years_min) return false;
      if (f.experience_years_max !== null && c.experience_years > f.experience_years_max) return false;
    }
  }

  if (f.industries.length) {
    const inds = c.industries.map((i) => i.toLowerCase());
    if (!f.industries.some((i) => inds.some((x) => x.includes(i.toLowerCase())))) return false;
  }
  if (f.companies_exclude.length && f.companies_exclude.some((co) => (c.company ?? "").toLowerCase().includes(co.toLowerCase()))) return false;
  if (f.companies_include.length && !f.companies_include.some((co) => (c.company ?? "").toLowerCase().includes(co.toLowerCase()))) return false;

  if (f.contact_required.email && !c.has_email) return false;
  if (f.contact_required.phone && !c.has_phone) return false;

  return true;
}

function mockEmail(c: ExternalCandidate): string {
  return `${(c.first_name ?? "x").toLowerCase()}.${(c.last_name ?? "x").toLowerCase()}@example-mock.com`;
}

export const mockProvider: SourcingProvider = {
  key: "mock",
  name: "Mock Provider (dev)",
  capabilities: {
    searchCandidates: true,
    countCandidates: true,
    enrichCandidate: true,
    revealContact: true,
  },

  async searchCandidates(filters, opts): Promise<ProviderSearchResult> {
    const all = pool().filter((c) => matchesFilters(c, filters));
    const offset = opts.offset ?? 0;
    return {
      candidates: all.slice(offset, offset + opts.limit).map((c) => ({ ...c })),
      total: all.length,
    };
  },

  async countCandidates(filters): Promise<number> {
    return pool().filter((c) => matchesFilters(c, filters)).length;
  },

  async enrichCandidate(ref: CandidateRef): Promise<ExternalCandidate | null> {
    const c = pool().find(
      (p) =>
        (ref.providerRecordId && p.provider_record_id === ref.providerRecordId) ||
        (ref.linkedinUrl && p.linkedin_url === ref.linkedinUrl),
    );
    return c ? { ...c, raw: { enriched: true } } : null;
  },

  async revealContact(ref: CandidateRef, type: "email" | "phone", _opts: ProviderCallOpts): Promise<RevealResult> {
    const c = pool().find(
      (p) =>
        (ref.providerRecordId && p.provider_record_id === ref.providerRecordId) ||
        (ref.linkedinUrl && p.linkedin_url === ref.linkedinUrl),
    );
    if (!c) return { found: false, value: null };
    if (type === "email") {
      return c.has_email
        ? { found: true, value: mockEmail(c), confidence: 0.95, enriched: { ...c } }
        : { found: false, value: null };
    }
    return c.has_phone
      ? { found: true, value: `+1555${c.provider_record_id.replace(/\D/g, "").padStart(7, "0")}`, confidence: 0.9, enriched: { ...c } }
      : { found: false, value: null };
  },
};
