import { supabaseAdmin } from "@/lib/supabase";

// Thread store for the recruiter<>candidate email conversation. Keeps the chain
// inside JobsAI: every outbound send and every captured inbound reply is logged
// here, threaded to the candidate's application.

export interface LogMessageInput {
  orgId: string;
  applicationId?: string | null;
  outreachId?: string | null;
  direction: "outbound" | "inbound";
  fromEmail?: string | null;
  toEmail?: string | null;
  subject?: string | null;
  body?: string | null;
  channel?: string;
  sentVia?: string | null;   // 'ai_sdr' when an AI SDR reply; null otherwise
}

export async function logMessage(m: LogMessageInput): Promise<void> {
  await supabaseAdmin.from("enterprise_messages").insert({
    org_id: m.orgId,
    application_id: m.applicationId ?? null,
    outreach_id: m.outreachId ?? null,
    direction: m.direction,
    from_email: m.fromEmail ?? null,
    to_email: m.toEmail ?? null,
    subject: m.subject ?? null,
    body: m.body ?? null,
    channel: m.channel ?? "email",
    sent_via: m.sentVia ?? null,
  });
}

// The most recent application for a candidate email within an org — used to
// thread an inbound reply back to the right candidate.
export async function findApplicationIdByEmail(orgId: string, email: string): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id")
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

// Mark any open sourcing-outreach rows for this candidate as replied, so the
// follow-up sequence stops once they answer.
export async function markOutreachReplied(orgId: string, email: string): Promise<void> {
  if (!email) return;
  await supabaseAdmin
    .from("enterprise_sourcing_outreach")
    .update({ replied_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .is("replied_at", null);
}
