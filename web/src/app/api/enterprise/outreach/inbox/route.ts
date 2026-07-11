import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";

const PAGE_SIZE = 30;

// GET — master inbox thread list with filters:
//   ?status=open|snoozed|done  ?intent=<intent>  ?assignee=me|<userId>|unassigned
//   ?unread=1  ?q=<search>  ?page=N
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const p = req.nextUrl.searchParams;
  const page = Math.max(0, parseInt(p.get("page") ?? "0", 10) || 0);

  let q = supabaseAdmin
    .from("inbox_threads")
    .select("id, candidate_email, candidate_name, application_id, intent, intent_confidence, intent_manual, ai_summary, status, assignee_user_id, last_inbound_at, reply_count, unread, updated_at")
    .eq("org_id", org.id);

  const status = p.get("status");
  if (status && ["open", "snoozed", "done"].includes(status)) q = q.eq("status", status);
  const intent = p.get("intent");
  if (intent) q = q.eq("intent", intent);
  if (p.get("unread") === "1") q = q.eq("unread", true);
  const assignee = p.get("assignee");
  if (assignee === "me") q = q.eq("assignee_user_id", userId);
  else if (assignee === "unassigned") q = q.is("assignee_user_id", null);
  else if (assignee) q = q.eq("assignee_user_id", assignee);
  const search = p.get("q");
  if (search) q = q.or(`candidate_email.ilike.%${search}%,candidate_name.ilike.%${search}%`);

  const from = page * PAGE_SIZE;
  const { data } = await q
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const rows = data ?? [];

  // Lightweight counts for the filter rail (open + unread).
  const [{ count: openCount }, { count: unreadCount }] = await Promise.all([
    supabaseAdmin.from("inbox_threads").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("status", "open"),
    supabaseAdmin.from("inbox_threads").select("id", { count: "exact", head: true }).eq("org_id", org.id).eq("unread", true),
  ]);

  return NextResponse.json({
    data: {
      threads: rows,
      page,
      has_more: rows.length === PAGE_SIZE,
      counts: { open: openCount ?? 0, unread: unreadCount ?? 0 },
      me: userId,
    },
  });
}

// Ensure the caller has an inbox at all (used by the page for empty-state copy).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await getMyMembership(userId);
  return NextResponse.json({ data: { member: !!member } });
}
