import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";

// GET — comparative overview across an agency's client workspaces. Only
// meaningful when the caller's current org is an agency parent. Counts are
// per-workspace (each is its own org, so a plain org_id count per child).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "agency_workspaces");
  if (gate) return gate;

  const org = (await getMyOrg(userId)) as { id: string; name: string; parent_org_id?: string | null } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  // Roll up the parent even if the caller is currently inside a client.
  const parentId = org.parent_org_id ?? org.id;

  const { data: children } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug, created_at")
    .eq("parent_org_id", parentId)
    .order("created_at", { ascending: true });
  const clients = (children ?? []) as { id: string; name: string; slug: string | null; created_at: string }[];

  // Include the agency parent itself as a row so its own book of business shows.
  const { data: parent } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug")
    .eq("id", parentId)
    .maybeSingle();
  const orgRows = [
    ...(parent ? [{ ...(parent as { id: string; name: string; slug: string | null }), is_parent: true }] : []),
    ...clients.map((c) => ({ ...c, is_parent: false })),
  ];

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Per-workspace metrics. Head-count queries keep payload tiny; one small
  // fan-out per workspace (agencies have tens of clients, not thousands).
  const rows = await Promise.all(
    orgRows.map(async (o) => {
      const [openJobs, activeCandidates, liveCampaigns, positiveReplies, newReplies30] = await Promise.all([
        supabaseAdmin.from("enterprise_jobs").select("id", { count: "exact", head: true }).eq("org_id", o.id).eq("status", "active"),
        supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", o.id).not("stage", "in", "(hired,rejected)"),
        supabaseAdmin.from("enterprise_campaigns").select("id", { count: "exact", head: true }).eq("org_id", o.id).eq("status", "active"),
        supabaseAdmin.from("inbox_threads").select("id", { count: "exact", head: true }).eq("org_id", o.id).in("intent", ["interested", "meeting_requested"]),
        supabaseAdmin.from("inbox_threads").select("id", { count: "exact", head: true }).eq("org_id", o.id).gte("last_inbound_at", since30),
      ]);
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        is_parent: o.is_parent,
        open_jobs: openJobs.count ?? 0,
        active_candidates: activeCandidates.count ?? 0,
        live_campaigns: liveCampaigns.count ?? 0,
        positive_replies: positiveReplies.count ?? 0,
        replies_30d: newReplies30.count ?? 0,
      };
    }),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      open_jobs: acc.open_jobs + r.open_jobs,
      active_candidates: acc.active_candidates + r.active_candidates,
      live_campaigns: acc.live_campaigns + r.live_campaigns,
      positive_replies: acc.positive_replies + r.positive_replies,
      replies_30d: acc.replies_30d + r.replies_30d,
    }),
    { open_jobs: 0, active_candidates: 0, live_campaigns: 0, positive_replies: 0, replies_30d: 0 },
  );

  return NextResponse.json({ data: { workspaces: rows, totals, client_count: clients.length } });
}
