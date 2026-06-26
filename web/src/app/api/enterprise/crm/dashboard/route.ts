import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

// GET — aggregate stats + actionable lists for the CRM dashboard. Volumes are
// small per org, so we fetch and compute in JS rather than running many queries.
export async function GET() {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const orgId = ctx.org.id;

  const [companiesRes, contactsRes, tasksRes, jobOrdersRes, dealsRes] = await Promise.all([
    supabaseAdmin.from("crm_companies").select("id, name, status, owner_id, last_activity_at, next_follow_up_at, created_at").eq("org_id", orgId),
    supabaseAdmin.from("crm_contacts").select("id, first_name, last_name, company_id, relationship_status, last_contacted_at, next_follow_up_at").eq("org_id", orgId),
    supabaseAdmin.from("crm_tasks").select("*, company:crm_companies(id, name), contact:crm_contacts(id, first_name, last_name)").eq("org_id", orgId).eq("status", "open"),
    supabaseAdmin.from("crm_job_orders").select("id, title, status, priority, placement_value, company:crm_companies(id, name)").eq("org_id", orgId),
    supabaseAdmin.from("crm_deals").select("id, name, stage, value, expected_close_at, company:crm_companies(id, name)").eq("org_id", orgId),
  ]);

  const companies = companiesRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const openTasks = tasksRes.data ?? [];
  const jobOrders = jobOrdersRes.data ?? [];
  const deals = dealsRes.data ?? [];

  const OPEN_JOB_STATUSES = ["intake", "open", "sourcing", "submitted", "interviewing", "offer"];
  const openJobOrders = jobOrders.filter((j) => OPEN_JOB_STATUSES.includes(j.status));
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const jobOrdersNeedingAction = openJobOrders
    .filter((j) => j.priority === "high" || j.priority === "urgent")
    .slice(0, 8);
  const activeDeals = [...openDeals]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .slice(0, 8);

  const now = Date.now();
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const eod = endOfToday.getTime();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const ts = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);

  const byStatus = (s: string) => companies.filter((c) => c.status === s).length;

  const overdueTasks = openTasks.filter((t) => { const d = ts(t.due_at); return d !== null && d < now; });
  const tasksDueToday = openTasks.filter((t) => { const d = ts(t.due_at); return d !== null && d >= now && d <= eod; });

  const companyFollowupsToday = companies.filter((c) => { const d = ts(c.next_follow_up_at); return d !== null && d <= eod; });
  const contactFollowupsToday = contacts.filter((c) => { const d = ts(c.next_follow_up_at); return d !== null && d <= eod; });

  const recentlyActive = [...companies]
    .filter((c) => c.last_activity_at)
    .sort((a, b) => (ts(b.last_activity_at)! - ts(a.last_activity_at)!))
    .slice(0, 6);

  const recentCompanies = [...companies]
    .sort((a, b) => (ts(b.created_at)! - ts(a.created_at)!))
    .slice(0, 6);

  const dormantCompanies = companies.filter((c) => c.status === "dormant").slice(0, 6);

  // Active relationships that have gone quiet (no contact in 14+ days), worth a nudge.
  const staleContacts = contacts
    .filter((c) => c.relationship_status !== "do_not_contact")
    .filter((c) => { const d = ts(c.last_contacted_at); return d === null || d < fourteenDaysAgo; })
    .slice(0, 8);

  return NextResponse.json({
    stats: {
      prospects: byStatus("prospect"),
      activeClients: byStatus("active_client"),
      pastClients: byStatus("past_client"),
      dormant: byStatus("dormant"),
      totalCompanies: companies.length,
      totalContacts: contacts.length,
      openTasks: openTasks.length,
      overdueTasks: overdueTasks.length,
      followupsDueToday: tasksDueToday.length + companyFollowupsToday.length + contactFollowupsToday.length,
      openJobOrders: openJobOrders.length,
      dealsInPipeline: openDeals.length,
      pipelineValue,
    },
    lists: {
      tasksDueToday,
      overdueTasks: overdueTasks.slice(0, 8),
      recentlyActive,
      recentCompanies,
      dormantCompanies,
      staleContacts,
      jobOrdersNeedingAction,
      activeDeals,
    },
  });
}
