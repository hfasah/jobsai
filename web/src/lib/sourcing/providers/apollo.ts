// Apollo.io provider adapter. Its billing model fits ours natively: people
// SEARCH is FREE (no credits), and you only spend credits to REVEAL a contact.
//   Search: POST /api/v1/mixed_people/api_search  (free; no email/phone returned)
//   Reveal: POST /api/v1/people/match  (reveal_personal_emails -> ~1 credit, sync)
//   Phone:  delivered asynchronously via webhook (reveal_phone_number) — NOT yet
//           wired here, so phone reveals fall through to "no data" for now.
// SERVER-ONLY. Auth via X-Api-Key (Apollo master API key).
import { dedupeStrings, normalizeLinkedinUrl } from "../normalize";
import type { CandidateRef, ProviderCallOpts, SourcingProvider } from "../provider";
import type { ExternalCandidate, ProviderSearchResult, RevealResult, SourcingFilters } from "../types";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

// Our seniority values -> Apollo person_seniorities.
const SENIORITY_MAP: Record<string, string> = {
  entry: "entry", senior: "senior", manager: "manager", director: "director",
  vp: "vp", cxo: "c_suite", owner: "owner", partner: "partner",
};
// Our company_sizes ("1-10") -> Apollo organization_num_employees_ranges ("1,10").
function sizeRange(bucket: string): string | null {
  const m = bucket.match(/^(\d+)-(\d+)$/);
  if (m) return `${m[1]},${m[2]}`;
  if (bucket === "10001+") return "10001,1000000";
  return null;
}

interface ApolloPerson {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  headline?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  email?: string | null;
  email_status?: string | null;
  personal_emails?: string[] | null;
  phone_numbers?: ({ sanitized_number?: string | null; raw_number?: string | null } | string)[] | null;
  organization?: { name?: string | null; estimated_num_employees?: number | null; industry?: string | null } | null;
  employment_history?: unknown[] | null;
  functions?: string[] | null;
}

interface ApolloSearchResponse {
  people?: ApolloPerson[];
  pagination?: { total_entries?: number; page?: number; per_page?: number };
  error?: string;
  error_message?: string;
}
interface ApolloMatchResponse {
  person?: ApolloPerson;
  error?: string;
  error_message?: string;
}

async function apolloFetch<T>(path: string, body: unknown, opts: ProviderCallOpts): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(`${APOLLO_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": opts.apiKey, "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string; error_message?: string };
    if (!res.ok) throw new Error(json?.error_message ?? json?.error ?? `Apollo ${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// SourcingFilters -> Apollo people-search params.
function buildSearchBody(f: SourcingFilters, page: number, perPage: number): Record<string, unknown> {
  const body: Record<string, unknown> = { page, per_page: perPage };
  if (f.titles.length) body.person_titles = f.titles;
  if (f.titles_exclude.length) body.person_not_titles = f.titles_exclude;
  if (f.locations.length) {
    body.person_locations = f.locations.map((l) => (l.locality ? `${l.locality}, ${l.country}` : l.country));
  }
  const seniorities = [...new Set(f.seniority.map((s) => SENIORITY_MAP[s]).filter(Boolean))];
  if (seniorities.length) body.person_seniorities = seniorities;
  if (f.company_sizes.length) {
    const ranges = f.company_sizes.map(sizeRange).filter(Boolean);
    if (ranges.length) body.organization_num_employees_ranges = ranges;
  }
  if (f.companies_include.length) body.organization_names = f.companies_include;
  // Apollo people-search has no dedicated skills field — fold skills + free
  // keywords into the keyword query.
  const kw = [...f.skills_any, ...f.skills_all, ...f.keywords, ...f.industries].filter(Boolean);
  if (kw.length) body.q_keywords = kw.join(" ");
  return body;
}

function firstPhone(p: ApolloPerson): string | null {
  const first = p.phone_numbers?.[0];
  if (!first) return null;
  return typeof first === "string" ? first : first.sanitized_number ?? first.raw_number ?? null;
}

function normalize(p: ApolloPerson): ExternalCandidate {
  const location = [p.city, p.state, p.country].filter(Boolean);
  return {
    provider_key: "apollo",
    provider_record_id: p.id ?? `apollo_${p.linkedin_url ?? p.name ?? "unknown"}`,
    source_type: "provider_api",
    permitted_use: "recruitment_outreach",
    confidence: null,
    full_name: p.name ?? ([p.first_name, p.last_name].filter(Boolean).join(" ") || null),
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    job_title: p.title ?? p.headline ?? null,
    company: p.organization?.name ?? null,
    company_size: p.organization?.estimated_num_employees != null ? String(p.organization.estimated_num_employees) : null,
    location_country: p.country ?? null,
    location_locality: p.city ?? (location.length ? location[0] : null),
    skills: [],
    experience_years: null,
    industries: p.organization?.industry ? [p.organization.industry] : [],
    education: [],
    languages: [],
    linkedin_url: normalizeLinkedinUrl(p.linkedin_url),
    github_url: p.github_url ?? null,
    portfolio_url: null,
    // Apollo search reports an email STATUS (verified/likely) without unlocking
    // the address — so availability is known even though the value isn't.
    has_email: p.email_status ? true : (p.email ? true : null),
    has_phone: (p.phone_numbers?.length ?? 0) > 0 ? true : null,
  };
}

// Match by the Apollo id captured at search time (else name + company / linkedin).
function matchBody(ref: CandidateRef, reveal: { email?: boolean; phone?: boolean }): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (ref.providerRecordId && !ref.providerRecordId.startsWith("apollo_")) body.id = ref.providerRecordId;
  else if (ref.linkedinUrl) body.linkedin_url = ref.linkedinUrl;
  else if (ref.email) body.email = ref.email;
  if (reveal.email) body.reveal_personal_emails = true;
  if (reveal.phone) body.reveal_phone_number = true;
  return body;
}

export const apolloProvider: SourcingProvider = {
  key: "apollo",
  name: "Apollo",
  capabilities: {
    searchCandidates: true,
    countCandidates: true,
    enrichCandidate: true,
    revealContact: true,
  },

  async searchCandidates(filters, opts): Promise<ProviderSearchResult> {
    const perPage = Math.min(opts.limit, 100);
    const page = opts.offset ? Math.floor(opts.offset / perPage) + 1 : 1;
    const res = await apolloFetch<ApolloSearchResponse>("/mixed_people/api_search", buildSearchBody(filters, page, perPage), opts);
    return {
      candidates: (res.people ?? []).map(normalize),
      total: res.pagination?.total_entries ?? null,
    };
  },

  // Free: a 1-result search just to read pagination.total_entries.
  async countCandidates(filters, opts): Promise<number | null> {
    try {
      const res = await apolloFetch<ApolloSearchResponse>("/mixed_people/api_search", buildSearchBody(filters, 1, 1), opts);
      return res.pagination?.total_entries ?? null;
    } catch {
      return null;
    }
  },

  async enrichCandidate(ref, opts): Promise<ExternalCandidate | null> {
    try {
      const res = await apolloFetch<ApolloMatchResponse>("/people/match", matchBody(ref, { email: true }), opts);
      if (!res.person) return null;
      const candidate = normalize(res.person);
      candidate.raw = res.person as unknown as Record<string, unknown>;
      return candidate;
    } catch {
      return null;
    }
  },

  async revealContact(ref, type, opts): Promise<RevealResult> {
    // Phone reveal is delivered async via webhook (reveal_phone_number) — not
    // wired yet. Return no-data so the caller refunds and doesn't charge.
    if (type === "phone") {
      const res = await apolloFetch<ApolloMatchResponse>("/people/match", matchBody(ref, {}), opts).catch(() => null);
      const phone = res?.person ? firstPhone(res.person) : null;
      return { found: !!phone, value: phone };
    }
    const res = await apolloFetch<ApolloMatchResponse>("/people/match", matchBody(ref, { email: true }), opts).catch(() => null);
    const p = res?.person;
    if (!p) return { found: false, value: null, error: "unresolvable reference" };
    const enriched = normalize(p);
    enriched.raw = p as unknown as Record<string, unknown>;
    const emails = dedupeStrings([p.email ?? null, ...(p.personal_emails ?? [])]);
    const value = emails[0] ?? null;
    return { found: !!value, value, extra: emails.slice(1), enriched };
  },
};
