import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { discoverJobs } from "@/lib/job-discovery";
import type { UserPreferences } from "@/types/preferences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

// GET /api/admin/discovery-probe?userId=user_… — runs the REAL discovery code
// live for one user and reports each stage, so "no jobs are being imported for
// me" is answerable in one request:
//   1. the cron's own telemetry (last_discovery_at / count — did the cron even
//      reach this user, and when?)
//   2. a live discoverJobs() call — what the providers return RIGHT NOW for
//      their prefs (counts, sources, errors, top matches)
//   3. dedupe preview — how many of those URLs this user already has
//   4. a global pulse — imports across ALL users, and how many users the last
//      cron run actually reached (a platform-wide dead cron looks identical to
//      a personal problem without this).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Pass ?userId=user_…" }, { status: 400 });

  const { data: prefsRow } = await supabaseAdmin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!prefsRow) return NextResponse.json({ error: `No user_preferences for ${userId} — wrong ID?` }, { status: 404 });
  const prefs = prefsRow as UserPreferences & { last_discovery_at?: string | null; last_discovery_count?: number | null };

  // Live provider run with the user's actual prefs.
  const live = await discoverJobs(prefs).catch((e) => ({ jobs: [], sources: [], errors: [String(e)] }));

  // Dedupe preview: which of the top discovered URLs already exist for them.
  const topUrls = live.jobs.slice(0, 10).map((j) => j.url).filter(Boolean);
  let alreadyImported = 0;
  if (topUrls.length) {
    const { count } = await supabaseAdmin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("source_url", topUrls);
    alreadyImported = count ?? 0;
  }

  // Global pulse.
  const h26 = new Date(Date.now() - 26 * 3600_000).toISOString();
  const d1 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ count: globalImports26h }, { count: usersDiscoveredToday }, { count: usersWithPrefs }] = await Promise.all([
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).gte("created_at", h26),
    supabaseAdmin.from("user_preferences").select("user_id", { count: "exact", head: true }).gte("last_discovery_at", d1),
    supabaseAdmin.from("user_preferences").select("user_id", { count: "exact", head: true }).not("job_titles", "eq", "{}"),
  ]);

  return NextResponse.json({
    data: {
      cron_telemetry: {
        last_discovery_at: prefs.last_discovery_at ?? null,
        last_discovery_count: prefs.last_discovery_count ?? null,
        note: "null/old last_discovery_at = the discover cron isn't reaching this user; recent with count 0 = it runs but finds/imports nothing.",
      },
      live_discovery: {
        jobs_found: live.jobs.length,
        sources: live.sources,
        errors: live.errors,
        top_matches: live.jobs.slice(0, 8).map((j) => ({ title: j.title, company: j.company, source: j.source, url: j.url })),
      },
      dedupe_preview: { top_urls_checked: topUrls.length, already_imported: alreadyImported },
      global_pulse: {
        jobs_imported_all_users_26h: globalImports26h ?? 0,
        users_discovered_last_24h: usersDiscoveredToday ?? 0,
        users_with_job_titles: usersWithPrefs ?? 0,
        note: "If users_discovered_last_24h is 0 while users_with_job_titles > 0, the discover cron is dead platform-wide.",
      },
    },
  });
}
