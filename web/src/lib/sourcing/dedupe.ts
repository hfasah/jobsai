// Internal-database dedup: does this external candidate already exist in the
// org's world? Batch-oriented (one query set per run, .in() chunks) so a
// 50-result search costs a handful of queries, not 250. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { linkedinHandle, nameCompanyKey, normEmail } from "./normalize";
import type { DedupMatch, DedupVerdict, ExternalCandidate } from "./types";

const CHUNK = 100;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface CandidateKeys {
  emails: string[];
  linkedin: string | null;
  nameCompany: string | null;
}

function keysFor(c: ExternalCandidate, revealedEmails: string[] = []): CandidateKeys {
  return {
    emails: revealedEmails.map(normEmail).filter((e): e is string => !!e),
    linkedin: linkedinHandle(c.linkedin_url),
    nameCompany: nameCompanyKey(c.full_name, c.company),
  };
}

export interface InternalIndex {
  applicationsByEmail: Map<string, { id: string; name: string | null; stage: string | null }>;
  applicationsByLinkedin: Map<string, { id: string; name: string | null; stage: string | null }>;
  poolByEmail: Map<string, { id: string; name: string | null }>;
  poolByLinkedin: Map<string, { id: string; name: string | null }>;
  importsByExternalId: Set<string>;
  contactedEmails: Set<string>;
  applicationsByNameCompany: Map<string, { id: string; name: string | null }>;
}

// One-shot load of the org's identity keys relevant to this batch of
// candidates. Queries are scoped to the keys present in the batch, not the
// whole org.
export async function loadInternalIndex(
  orgId: string,
  candidates: { candidate: ExternalCandidate; externalId?: string; revealedEmails?: string[] }[],
): Promise<InternalIndex> {
  const allEmails = new Set<string>();
  const allHandles = new Set<string>();
  const allExternalIds = new Set<string>();
  for (const { candidate, externalId, revealedEmails } of candidates) {
    const k = keysFor(candidate, revealedEmails ?? []);
    k.emails.forEach((e) => allEmails.add(e));
    if (k.linkedin) allHandles.add(k.linkedin);
    if (externalId) allExternalIds.add(externalId);
  }

  const index: InternalIndex = {
    applicationsByEmail: new Map(),
    applicationsByLinkedin: new Map(),
    poolByEmail: new Map(),
    poolByLinkedin: new Map(),
    importsByExternalId: new Set(),
    contactedEmails: new Set(),
    applicationsByNameCompany: new Map(),
  };

  const emailList = [...allEmails];
  const handleList = [...allHandles];

  // Applications by email
  for (const chunk of chunks(emailList, CHUNK)) {
    const { data } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id, candidate_name, candidate_email, stage")
      .eq("org_id", orgId)
      .in("candidate_email", chunk);
    for (const row of (data ?? []) as { id: string; candidate_name: string | null; candidate_email: string | null; stage: string | null }[]) {
      const e = normEmail(row.candidate_email);
      if (e) index.applicationsByEmail.set(e, { id: row.id, name: row.candidate_name, stage: row.stage });
    }
  }

  // Applications by linkedin handle (linkedin_url stored freeform — match on ilike batches)
  for (const chunk of chunks(handleList, 20)) {
    const orExpr = chunk.map((h) => `linkedin_url.ilike.%/in/${h}%`).join(",");
    const { data } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id, candidate_name, linkedin_url, stage")
      .eq("org_id", orgId)
      .or(orExpr);
    for (const row of (data ?? []) as { id: string; candidate_name: string | null; linkedin_url: string | null; stage: string | null }[]) {
      const h = linkedinHandle(row.linkedin_url);
      if (h) index.applicationsByLinkedin.set(h, { id: row.id, name: row.candidate_name, stage: row.stage });
    }
  }

  // Talent pool by email
  for (const chunk of chunks(emailList, CHUNK)) {
    const { data } = await supabaseAdmin
      .from("enterprise_talent_pool")
      .select("id, candidate_name, candidate_email, linkedin_url")
      .eq("org_id", orgId)
      .in("candidate_email", chunk);
    for (const row of (data ?? []) as { id: string; candidate_name: string | null; candidate_email: string | null; linkedin_url: string | null }[]) {
      const e = normEmail(row.candidate_email);
      if (e) index.poolByEmail.set(e, { id: row.id, name: row.candidate_name });
      const h = linkedinHandle(row.linkedin_url);
      if (h) index.poolByLinkedin.set(h, { id: row.id, name: row.candidate_name });
    }
  }
  // Talent pool by linkedin
  for (const chunk of chunks(handleList, 20)) {
    const orExpr = chunk.map((h) => `linkedin_url.ilike.%/in/${h}%`).join(",");
    const { data } = await supabaseAdmin
      .from("enterprise_talent_pool")
      .select("id, candidate_name, linkedin_url")
      .eq("org_id", orgId)
      .or(orExpr);
    for (const row of (data ?? []) as { id: string; candidate_name: string | null; linkedin_url: string | null }[]) {
      const h = linkedinHandle(row.linkedin_url);
      if (h) index.poolByLinkedin.set(h, { id: row.id, name: row.candidate_name });
    }
  }

  // Prior imports of these exact external candidates
  for (const chunk of chunks([...allExternalIds], CHUNK)) {
    const { data } = await supabaseAdmin
      .from("sourcing_imports")
      .select("external_candidate_id")
      .eq("org_id", orgId)
      .neq("dedup_decision", "skipped")
      .in("external_candidate_id", chunk);
    for (const row of (data ?? []) as { external_candidate_id: string }[]) {
      index.importsByExternalId.add(row.external_candidate_id);
    }
  }

  // Previously contacted (one-off sourcing outreach)
  for (const chunk of chunks(emailList, CHUNK)) {
    const { data } = await supabaseAdmin
      .from("enterprise_sourcing_outreach")
      .select("candidate_email")
      .eq("org_id", orgId)
      .in("candidate_email", chunk);
    for (const row of (data ?? []) as { candidate_email: string | null }[]) {
      const e = normEmail(row.candidate_email);
      if (e) index.contactedEmails.add(e);
    }
  }

  return index;
}

// Verdict for one candidate against a loaded index. Name+company matches are
// only ever "possible_duplicate" — too weak to call existing.
export function dedupeVerdict(
  candidate: ExternalCandidate,
  index: InternalIndex,
  opts: { externalId?: string; revealedEmails?: string[] } = {},
): DedupVerdict {
  const k = keysFor(candidate, opts.revealedEmails ?? []);
  const matches: DedupMatch[] = [];

  if (opts.externalId && index.importsByExternalId.has(opts.externalId)) {
    matches.push({ type: "import", id: opts.externalId, matched_on: "linkedin" });
  }

  for (const email of k.emails) {
    const app = index.applicationsByEmail.get(email);
    if (app) matches.push({ type: "application", id: app.id, matched_on: "email", label: app.name ?? undefined });
    const pool = index.poolByEmail.get(email);
    if (pool) matches.push({ type: "talent_pool", id: pool.id, matched_on: "email", label: pool.name ?? undefined });
    if (index.contactedEmails.has(email)) matches.push({ type: "outreach", id: email, matched_on: "email" });
  }

  if (k.linkedin) {
    const app = index.applicationsByLinkedin.get(k.linkedin);
    if (app) matches.push({ type: "application", id: app.id, matched_on: "linkedin", label: app.name ?? undefined });
    const pool = index.poolByLinkedin.get(k.linkedin);
    if (pool) matches.push({ type: "talent_pool", id: pool.id, matched_on: "linkedin", label: pool.name ?? undefined });
  }

  // Status priority: imported > previously_contacted > existing > possible > new
  if (opts.externalId && index.importsByExternalId.has(opts.externalId)) {
    return { status: "imported", matches };
  }
  if (matches.some((m) => m.type === "outreach")) {
    return { status: "previously_contacted", matches };
  }
  if (matches.some((m) => (m.type === "application" || m.type === "talent_pool") && (m.matched_on === "email" || m.matched_on === "linkedin"))) {
    return { status: "existing", matches };
  }

  if (k.nameCompany && index.applicationsByNameCompany.has(k.nameCompany)) {
    const m = index.applicationsByNameCompany.get(k.nameCompany)!;
    matches.push({ type: "application", id: m.id, matched_on: "name_company", label: m.name ?? undefined });
    return { status: "possible_duplicate", matches };
  }

  return { status: "new", matches };
}
