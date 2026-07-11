// Deterministic, transparent match scoring. The LLM never touches the number —
// it only writes fit_reason prose later. Pure functions.
import { normToken } from "./normalize";
import type {
  ExternalCandidate,
  ScoreBreakdown,
  ScoreCategory,
  ScoreWeights,
  SourcingFilters,
} from "./types";
import { DEFAULT_WEIGHTS } from "./types";

function ratioCategory(
  weight: number,
  wanted: string[],
  have: string[],
): ScoreCategory {
  if (wanted.length === 0) {
    return { score: weight, weight, matched: [], missing: [], note: "no requirement" };
  }
  const haveSet = new Set(have.map(normToken));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const w of wanted) {
    if (haveSet.has(normToken(w))) matched.push(w);
    else missing.push(w);
  }
  return {
    score: Math.round((matched.length / wanted.length) * weight),
    weight,
    matched,
    missing,
  };
}

function titleCategory(weight: number, filters: SourcingFilters, candidate: ExternalCandidate): ScoreCategory {
  const wanted = filters.titles;
  if (wanted.length === 0) {
    return { score: weight, weight, matched: [], missing: [], note: "no requirement" };
  }
  const title = (candidate.job_title ?? "").toLowerCase();
  if (!title) return { score: 0, weight, matched: [], missing: wanted, note: "no current title" };

  let best = 0;
  let bestTitle: string | null = null;
  for (const w of wanted) {
    const wl = w.toLowerCase();
    let s = 0;
    if (title === wl) s = 1;
    else if (title.includes(wl) || wl.includes(title)) s = 0.85;
    else {
      // word-overlap fallback: "senior devops engineer" vs "devops engineer"
      const a = new Set(wl.split(/\s+/).map(normToken).filter(Boolean));
      const b = new Set(title.split(/\s+/).map(normToken).filter(Boolean));
      let hits = 0;
      for (const t of a) if (b.has(t)) hits++;
      s = a.size ? (hits / a.size) * 0.7 : 0;
    }
    if (s > best) { best = s; bestTitle = w; }
  }
  return {
    score: Math.round(best * weight),
    weight,
    matched: bestTitle && best > 0.3 ? [bestTitle] : [],
    missing: bestTitle && best > 0.3 ? [] : wanted,
  };
}

function experienceCategory(weight: number, filters: SourcingFilters, candidate: ExternalCandidate): ScoreCategory {
  const min = filters.experience_years_min;
  const max = filters.experience_years_max;
  if (min === null && max === null) {
    return { score: weight, weight, matched: [], missing: [], note: "no requirement" };
  }
  const years = candidate.experience_years;
  if (years === null || years === undefined) {
    const neutral = filters.include_unknown.experience ? 0.5 : 0;
    return { score: Math.round(neutral * weight), weight, matched: [], missing: [], note: "experience unknown" };
  }
  let s: number;
  if ((min === null || years >= min) && (max === null || years <= max)) {
    s = 1;
  } else if (min !== null && years < min) {
    s = Math.max(0, 1 - (min - years) / Math.max(min, 1)); // linear decay below range
  } else {
    s = 0.7; // overqualified is a soft miss, not a hard one
  }
  return {
    score: Math.round(s * weight),
    weight,
    matched: s >= 1 ? [`${years} yrs`] : [],
    missing: s < 1 ? [`${min ?? "any"}–${max ?? "any"} yrs (has ${years})`] : [],
  };
}

function locationCategory(weight: number, filters: SourcingFilters, candidate: ExternalCandidate): ScoreCategory {
  const wanted = filters.locations;
  if (wanted.length === 0) {
    return { score: weight, weight, matched: [], missing: [], note: "no requirement" };
  }
  const country = (candidate.location_country ?? "").toLowerCase();
  const locality = (candidate.location_locality ?? "").toLowerCase();
  if (!country && !locality) {
    const neutral = filters.include_unknown.location ? 0.5 : 0;
    return { score: Math.round(neutral * weight), weight, matched: [], missing: [], note: "location unknown" };
  }
  let best = 0;
  let bestLabel: string | null = null;
  for (const loc of wanted) {
    const wc = loc.country.toLowerCase();
    const wl = (loc.locality ?? "").toLowerCase();
    let s = 0;
    if (country && (country === wc || country.includes(wc) || wc.includes(country))) {
      s = 0.7;
      if (!wl) s = 1; // country-only requirement fully satisfied
      else if (locality && (locality === wl || locality.includes(wl) || wl.includes(locality))) s = 1;
    }
    if (s > best) { best = s; bestLabel = wl ? `${loc.locality}, ${loc.country}` : loc.country; }
  }
  return {
    score: Math.round(best * weight),
    weight,
    matched: best > 0 && bestLabel ? [bestLabel] : [],
    missing: best === 0 ? wanted.map((l) => (l.locality ? `${l.locality}, ${l.country}` : l.country)) : [],
  };
}

export function normalizeWeights(input: Partial<ScoreWeights> | null | undefined): ScoreWeights {
  const w = { ...DEFAULT_WEIGHTS, ...(input ?? {}) };
  const total = w.skills + w.title + w.experience + w.location + w.industry;
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  const scale = 100 / total;
  return {
    skills: Math.round(w.skills * scale),
    title: Math.round(w.title * scale),
    experience: Math.round(w.experience * scale),
    location: Math.round(w.location * scale),
    industry: Math.round(w.industry * scale),
  };
}

export function computeMatchScore(
  candidate: ExternalCandidate,
  filters: SourcingFilters,
  weightsInput?: Partial<ScoreWeights> | null,
): { score: number; breakdown: ScoreBreakdown } {
  const weights = normalizeWeights(weightsInput);
  const wantedSkills = [...filters.skills_any, ...filters.skills_all];
  const breakdown: ScoreBreakdown = {
    skills: ratioCategory(weights.skills, wantedSkills, candidate.skills),
    title: titleCategory(weights.title, filters, candidate),
    experience: experienceCategory(weights.experience, filters, candidate),
    location: locationCategory(weights.location, filters, candidate),
    industry: ratioCategory(weights.industry, filters.industries, candidate.industries),
  };
  const score = Math.min(
    100,
    breakdown.skills.score +
      breakdown.title.score +
      breakdown.experience.score +
      breakdown.location.score +
      breakdown.industry.score,
  );
  return { score, breakdown };
}
