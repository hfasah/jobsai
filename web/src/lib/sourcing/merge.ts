// Cross-provider result merge. With a single live provider this is mostly a
// pass-through, but the seam exists so adding a second provider needs no
// schema or route changes: records describing the same person collapse into
// one, keeping the higher-confidence copy and unioning list fields.
import { dedupeStrings, linkedinHandle, nameCompanyKey } from "./normalize";
import type { ExternalCandidate } from "./types";

function mergePair(a: ExternalCandidate, b: ExternalCandidate): ExternalCandidate {
  // keep the higher-confidence record as the base
  const [base, other] =
    (b.confidence ?? 0) > (a.confidence ?? 0) ? [b, a] : [a, b];
  return {
    ...base,
    full_name: base.full_name ?? other.full_name,
    first_name: base.first_name ?? other.first_name,
    last_name: base.last_name ?? other.last_name,
    job_title: base.job_title ?? other.job_title,
    company: base.company ?? other.company,
    location_country: base.location_country ?? other.location_country,
    location_locality: base.location_locality ?? other.location_locality,
    skills: dedupeStrings([...base.skills, ...other.skills]),
    experience_years: base.experience_years ?? other.experience_years,
    industries: dedupeStrings([...base.industries, ...other.industries]),
    education: base.education.length ? base.education : other.education,
    languages: dedupeStrings([...base.languages, ...other.languages]),
    linkedin_url: base.linkedin_url ?? other.linkedin_url,
    github_url: base.github_url ?? other.github_url,
    portfolio_url: base.portfolio_url ?? other.portfolio_url,
    has_email: base.has_email || other.has_email ? true : base.has_email ?? other.has_email,
    has_phone: base.has_phone || other.has_phone ? true : base.has_phone ?? other.has_phone,
  };
}

export function mergeCandidates(candidates: ExternalCandidate[]): ExternalCandidate[] {
  const byKey = new Map<string, ExternalCandidate>();
  const keyless: ExternalCandidate[] = [];

  for (const c of candidates) {
    const key =
      linkedinHandle(c.linkedin_url) ??
      nameCompanyKey(c.full_name, c.company);
    if (!key) {
      keyless.push(c);
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergePair(existing, c) : c);
  }

  return [...byKey.values(), ...keyless];
}
