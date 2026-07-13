import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";

const PAGE_SIZE = 25;

// A run + one page of its results. External contact VALUES never leave this
// endpoint unless the profile has been unlocked/revealed — only availability
// flags (has_email / has_phone) are public to the UI.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10) || 0);

  const { data: run } = await supabaseAdmin
    .from("sourcing_search_runs")
    .select("id, search_id, mode, query_text, filters, weights, providers, status, result_count, external_count, internal_count, credits_charged, error, duration_ms, created_at")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const from = page * PAGE_SIZE;
  const { data: results } = await supabaseAdmin
    .from("sourcing_run_results")
    .select(
      `id, origin, internal_ref_id, match_score, score_breakdown, fit_reason, dedup_status, dedup_matches, not_relevant, position,
       external:sourcing_external_candidates (
         id, provider_key, provider_record_id, source_type, permitted_use, collected_at, confidence,
         full_name, first_name, last_name, job_title, company, location_country, location_locality,
         skills, experience_years, industries, education, languages,
         linkedin_url, github_url, portfolio_url,
         has_email, has_phone, emails, phones, profile_unlocked, enriched_at, suppressed
       )`,
    )
    .eq("run_id", id)
    .eq("org_id", org.id)
    .eq("not_relevant", false)
    .order("position", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  // Field-level lockdown: a locked profile must not leak ANY reachable channel
  // in the payload (not just the UI). Expose availability flags, blank the real
  // values until the org unlocks the profile.
  const rows = ((results ?? []) as Record<string, unknown>[]).map((r) => {
    const ext = r.external as Record<string, unknown> | null;
    if (ext) {
      ext.has_linkedin = !!ext.linkedin_url;
      ext.has_github = !!ext.github_url;
      ext.has_portfolio = !!ext.portfolio_url;
      if (!ext.profile_unlocked) {
        ext.emails = [];
        ext.phones = [];
        ext.linkedin_url = null;
        ext.github_url = null;
        ext.portfolio_url = null;
      }
    }
    return r;
  });

  return NextResponse.json({
    data: {
      run,
      results: rows,
      page,
      page_size: PAGE_SIZE,
      has_more: rows.length === PAGE_SIZE,
    },
  });
}
