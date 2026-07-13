import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 60;
const PAGE_SIZE = 50;

// GET /api/enterprise/sourcing/leads?q=&offset=
// The client's OWNED lead inventory: every candidate they've paid to reveal
// (profile_unlocked = true), across all searches, decoupled from any single run
// or campaign. "Buy now, use later." Each lead carries a representative
// run-result id so the existing reveal/import machinery works unchanged.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  let query = supabaseAdmin
    .from("sourcing_external_candidates")
    .select(
      "id, full_name, job_title, company, location_country, location_locality, linkedin_url, emails, phones, enriched_at, updated_at, provider_key",
      { count: "exact" },
    )
    .eq("org_id", org.id)
    .eq("profile_unlocked", true)
    .eq("suppressed", false);

  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,company.ilike.%${safe}%,job_title.ilike.%${safe}%`);
  }

  const { data: rows, count } = await query
    .order("enriched_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const leads = (rows ?? []) as {
    id: string; full_name: string | null; job_title: string | null; company: string | null;
    location_country: string | null; location_locality: string | null; linkedin_url: string | null;
    emails: { value: string; verification_status?: string }[]; phones: { value: string }[];
    enriched_at: string | null; updated_at: string | null; provider_key: string;
  }[];

  const ids = leads.map((l) => l.id);
  // A representative run-result per candidate (reveal/import operate on result
  // ids), plus which of these leads are already in a campaign.
  const resultByCandidate = new Map<string, string>();
  const enrolledCandidates = new Set<string>();
  if (ids.length) {
    const [{ data: results }, { data: imports }] = await Promise.all([
      supabaseAdmin
        .from("sourcing_run_results")
        .select("id, external_candidate_id")
        .eq("org_id", org.id)
        .in("external_candidate_id", ids),
      supabaseAdmin
        .from("sourcing_imports")
        .select("external_candidate_id")
        .eq("org_id", org.id)
        .eq("target_type", "campaign")
        .in("external_candidate_id", ids),
    ]);
    for (const r of (results ?? []) as { id: string; external_candidate_id: string }[]) {
      if (!resultByCandidate.has(r.external_candidate_id)) resultByCandidate.set(r.external_candidate_id, r.id);
    }
    for (const im of (imports ?? []) as { external_candidate_id: string }[]) enrolledCandidates.add(im.external_candidate_id);
  }

  const data = leads.map((l) => ({
    id: l.id,
    result_id: resultByCandidate.get(l.id) ?? null,
    full_name: l.full_name,
    job_title: l.job_title,
    company: l.company,
    location: [l.location_locality, l.location_country].filter(Boolean).join(", ") || null,
    linkedin_url: l.linkedin_url,
    email: l.emails?.[0]?.value ?? null,
    email_status: l.emails?.[0]?.verification_status ?? null,
    phone: l.phones?.[0]?.value ?? null,
    revealed_at: l.enriched_at ?? l.updated_at,
    provider_key: l.provider_key,
    in_campaign: enrolledCandidates.has(l.id),
  }));

  return NextResponse.json({
    data,
    total: count ?? data.length,
    offset,
    page_size: PAGE_SIZE,
    has_more: (count ?? 0) > offset + PAGE_SIZE,
  });
}
