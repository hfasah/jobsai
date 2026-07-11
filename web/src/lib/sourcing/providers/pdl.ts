// People Data Labs adapter.
//   Search: POST /v5/person/search (Elasticsearch bool query; billed PER RECORD
//           RETURNED — keep `size` small, never auto-paginate).
//   Reveal/enrich: GET /v5/person (person enrichment; one call returns the full
//           profile incl. emails/phones — callers cache the payload on the
//           candidate row so email→phone reveals don't re-bill PDL).
//   Count estimate: size:1 search and read `total` (costs a single record).
// 15s AbortController per call, mirroring pdRequest in lib/pipedrive.ts.
import { dedupeStrings, normalizeLinkedinUrl } from "../normalize";
import type { CandidateRef, ProviderCallOpts, SourcingProvider } from "../provider";
import type { ExternalCandidate, ProviderSearchResult, RevealResult, SourcingFilters } from "../types";

const PDL_BASE = "https://api.peopledatalabs.com/v5";

interface PdlPerson {
  id?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  location_country?: string | null;
  location_locality?: string | null;
  skills?: string[] | null;
  inferred_years_experience?: number | null;
  industry?: string | null;
  education?: { school?: { name?: string | null } | null; degrees?: string[] | null; majors?: string[] | null; end_date?: string | null }[] | null;
  languages?: ({ name?: string | null } | string)[] | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  emails?: ({ address?: string | null } | string)[] | null;
  work_email?: string | null;
  recommended_personal_email?: string | null;
  phone_numbers?: string[] | null;
  mobile_phone?: string | null;
}

async function pdlFetch<T>(
  path: string,
  init: RequestInit,
  opts: ProviderCallOpts,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(`${PDL_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": opts.apiKey,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok && res.status !== 404) {
      throw new Error(json?.error?.message ?? `PDL ${res.status}`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// SourcingFilters -> Elasticsearch bool query for /v5/person/search.
function buildQuery(f: SourcingFilters): Record<string, unknown> {
  const must: unknown[] = [];
  const must_not: unknown[] = [];

  if (f.titles.length) {
    if (f.title_operator === "is_all_of") {
      for (const t of f.titles) must.push({ match: { job_title: t } });
    } else {
      must.push({ bool: { should: f.titles.map((t) => ({ match: { job_title: t } })), minimum_should_match: 1 } });
    }
  }
  for (const t of f.titles_exclude) must_not.push({ match: { job_title: t } });

  if (f.skills_any.length) {
    must.push({ bool: { should: f.skills_any.map((s) => ({ term: { skills: s.toLowerCase() } })), minimum_should_match: 1 } });
  }
  for (const s of f.skills_all) must.push({ term: { skills: s.toLowerCase() } });
  for (const s of f.skills_exclude) must_not.push({ term: { skills: s.toLowerCase() } });

  if (f.locations.length) {
    must.push({
      bool: {
        should: f.locations.map((l) =>
          l.locality
            ? { bool: { must: [{ term: { location_country: l.country.toLowerCase() } }, { term: { location_locality: l.locality.toLowerCase() } }] } }
            : { term: { location_country: l.country.toLowerCase() } },
        ),
        minimum_should_match: 1,
      },
    });
  }
  for (const l of f.locations_exclude) {
    must_not.push(
      l.locality
        ? { term: { location_locality: l.locality.toLowerCase() } }
        : { term: { location_country: l.country.toLowerCase() } },
    );
  }

  if (f.experience_years_min !== null || f.experience_years_max !== null) {
    const range: Record<string, number> = {};
    if (f.experience_years_min !== null) range.gte = f.experience_years_min;
    if (f.experience_years_max !== null) range.lte = f.experience_years_max;
    const rangeClause = { range: { inferred_years_experience: range } };
    if (f.include_unknown.experience) {
      must.push({
        bool: {
          should: [rangeClause, { bool: { must_not: [{ exists: { field: "inferred_years_experience" } }] } }],
          minimum_should_match: 1,
        },
      });
    } else {
      must.push(rangeClause);
    }
  }

  if (f.industries.length) {
    must.push({ bool: { should: f.industries.map((i) => ({ term: { industry: i.toLowerCase() } })), minimum_should_match: 1 } });
  }
  for (const i of f.industries_exclude) must_not.push({ term: { industry: i.toLowerCase() } });

  if (f.companies_include.length) {
    must.push({ bool: { should: f.companies_include.map((c) => ({ match: { job_company_name: c } })), minimum_should_match: 1 } });
  }
  for (const c of f.companies_exclude) must_not.push({ match: { job_company_name: c } });

  if (f.schools.length) {
    must.push({ bool: { should: f.schools.map((s) => ({ match: { "education.school.name": s } })), minimum_should_match: 1 } });
  }
  if (f.languages.length) {
    must.push({ bool: { should: f.languages.map((l) => ({ term: { "languages.name": l.toLowerCase() } })), minimum_should_match: 1 } });
  }
  if (f.keywords.length && !f.titles.length && !f.skills_any.length) {
    // free-text fallback when the structured criteria are empty
    must.push({ bool: { should: f.keywords.map((k) => ({ match: { job_title: k } })), minimum_should_match: 1 } });
  }

  if (f.contact_required.email) must.push({ exists: { field: "emails" } });
  if (f.contact_required.phone) must.push({ exists: { field: "phone_numbers" } });
  // Records without a linkedin profile are rarely actionable for recruiting
  // and can't be deduped reliably — require one.
  must.push({ exists: { field: "linkedin_url" } });

  return { bool: { must, must_not } };
}

function firstEmail(p: PdlPerson): string | null {
  if (p.work_email) return p.work_email;
  if (p.recommended_personal_email) return p.recommended_personal_email;
  const e = p.emails?.[0];
  if (!e) return null;
  return typeof e === "string" ? e : e.address ?? null;
}

function allEmails(p: PdlPerson): string[] {
  const out: string[] = [];
  if (p.work_email) out.push(p.work_email);
  if (p.recommended_personal_email) out.push(p.recommended_personal_email);
  for (const e of p.emails ?? []) {
    const v = typeof e === "string" ? e : e?.address;
    if (v) out.push(v);
  }
  return [...new Set(out.map((e) => e.toLowerCase()))];
}

function normalizePerson(p: PdlPerson, likelihood?: number | null): ExternalCandidate {
  return {
    provider_key: "pdl",
    provider_record_id: p.id ?? `pdl_${p.linkedin_url ?? p.full_name ?? "unknown"}`,
    source_type: "provider_api",
    permitted_use: "recruitment_outreach",
    confidence: likelihood != null ? likelihood / 10 : null, // PDL likelihood is 1-10
    full_name: p.full_name ?? null,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    job_title: p.job_title ?? null,
    company: p.job_company_name ?? null,
    location_country: p.location_country ?? null,
    location_locality: p.location_locality ?? null,
    skills: dedupeStrings(p.skills ?? []),
    experience_years: p.inferred_years_experience ?? null,
    industries: p.industry ? [p.industry] : [],
    education: (p.education ?? []).slice(0, 5).map((e) => ({
      school: e?.school?.name ?? undefined,
      degree: e?.degrees?.[0] ?? undefined,
      field: e?.majors?.[0] ?? undefined,
      end_year: e?.end_date ? parseInt(e.end_date.slice(0, 4), 10) || undefined : undefined,
    })),
    languages: dedupeStrings(
      (p.languages ?? []).map((l) => (typeof l === "string" ? l : l?.name ?? null)),
    ),
    linkedin_url: normalizeLinkedinUrl(p.linkedin_url),
    github_url: p.github_url ?? null,
    portfolio_url: null,
    has_email: (p.emails?.length ?? 0) > 0 || !!p.work_email || null,
    has_phone: (p.phone_numbers?.length ?? 0) > 0 || !!p.mobile_phone || null,
  };
}

interface PdlSearchResponse {
  status: number;
  data?: PdlPerson[];
  total?: number;
  error?: { message?: string };
}

interface PdlEnrichResponse {
  status: number | string;
  likelihood?: number;
  data?: PdlPerson;
  error?: { message?: string };
}

function enrichParams(ref: CandidateRef): URLSearchParams | null {
  const params = new URLSearchParams({ min_likelihood: "6" });
  if (ref.providerRecordId && !ref.providerRecordId.startsWith("pdl_")) {
    params.set("pdl_id", ref.providerRecordId);
  } else if (ref.linkedinUrl) {
    params.set("profile", ref.linkedinUrl);
  } else if (ref.email) {
    params.set("email", ref.email);
  } else {
    return null;
  }
  return params;
}

async function enrich(ref: CandidateRef, opts: ProviderCallOpts): Promise<PdlEnrichResponse | null> {
  const params = enrichParams(ref);
  if (!params) return null;
  return pdlFetch<PdlEnrichResponse>(`/person?${params.toString()}`, { method: "GET" }, opts);
}

export const pdlProvider: SourcingProvider = {
  key: "pdl",
  name: "People Data Labs",
  capabilities: {
    searchCandidates: true,
    countCandidates: true,
    enrichCandidate: true,
    revealContact: true,
  },

  async searchCandidates(filters, opts): Promise<ProviderSearchResult> {
    const body = {
      query: buildQuery(filters),
      size: Math.min(opts.limit, 100),
      ...(opts.offset ? { from: opts.offset } : {}),
      dataset: "resume",
      titlecase: true,
    };
    const res = await pdlFetch<PdlSearchResponse>("/person/search", { method: "POST", body: JSON.stringify(body) }, opts);
    if (res.status === 404) return { candidates: [], total: 0 };
    return {
      candidates: (res.data ?? []).map((p) => normalizePerson(p)),
      total: res.total ?? null,
    };
  },

  // size:1 keeps the estimate cost to a single billed record.
  async countCandidates(filters, opts): Promise<number | null> {
    const body = { query: buildQuery(filters), size: 1, dataset: "resume" };
    try {
      const res = await pdlFetch<PdlSearchResponse>("/person/search", { method: "POST", body: JSON.stringify(body) }, opts);
      if (res.status === 404) return 0;
      return res.total ?? null;
    } catch {
      return null;
    }
  },

  async enrichCandidate(ref, opts): Promise<ExternalCandidate | null> {
    const res = await enrich(ref, opts);
    if (!res?.data) return null;
    const candidate = normalizePerson(res.data, res.likelihood ?? null);
    candidate.raw = res.data as unknown as Record<string, unknown>;
    return candidate;
  },

  async revealContact(ref, type, opts): Promise<RevealResult> {
    const res = await enrich(ref, opts);
    const p = res?.data;
    if (!p) return { found: false, value: null, error: res ? undefined : "unresolvable reference" };
    const enriched = normalizePerson(p, res?.likelihood ?? null);
    enriched.raw = p as unknown as Record<string, unknown>;
    if (type === "email") {
      const value = firstEmail(p);
      return { found: !!value, value, extra: allEmails(p).filter((e) => e !== value), confidence: (res?.likelihood ?? 0) / 10, enriched };
    }
    const phone = p.mobile_phone ?? p.phone_numbers?.[0] ?? null;
    return { found: !!phone, value: phone, extra: (p.phone_numbers ?? []).filter((n) => n !== phone), confidence: (res?.likelihood ?? 0) / 10, enriched };
  },
};
