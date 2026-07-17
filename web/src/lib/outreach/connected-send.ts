// Send a campaign email from a recruiter's OWN connected mailbox (Gmail or
// Outlook), instead of via Resend on an org sending domain. This is the "easy"
// sending model: no DNS, and replies thread straight back into the recruiter's
// inbox (no separate reply-to routing). SERVER-ONLY.
//
// The token owner is the mailbox's created_by (the user who connected it). The
// domain rotation pool excludes kind gmail/microsoft, so these never collide
// with Resend sending.
import { supabaseAdmin } from "@/lib/supabase";
import { sendFromRecruiterGmail } from "@/lib/recruiter-gmail";
import { sendFromMicrosoft } from "@/lib/microsoft";

export interface ConnectedMailbox {
  id: string;
  kind: "gmail" | "microsoft";
  address: string;
  created_by: string; // clerk userId whose OAuth token sends the mail
}

// All active connected mailboxes in the org (Gmail/Outlook).
export async function getConnectedMailboxes(orgId: string): Promise<ConnectedMailbox[]> {
  const { data } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id, kind, address, created_by")
    .eq("org_id", orgId)
    .in("kind", ["gmail", "microsoft"])
    .eq("status", "active");
  return (data ?? []) as ConnectedMailbox[];
}

// The org's active connected sender, if any. Prefer the campaign creator's own
// connected mailbox so the From address matches who built the campaign; else
// fall back to any active connected mailbox in the org.
export async function getConnectedSender(
  orgId: string,
  preferUserId?: string | null,
): Promise<ConnectedMailbox | null> {
  const rows = await getConnectedMailboxes(orgId);
  if (rows.length === 0) return null;
  if (preferUserId) {
    const mine = rows.find((r) => r.created_by === preferUserId);
    if (mine) return mine;
  }
  return rows[0];
}

// Send via the connected mailbox's provider API. Returns ok=false on any
// failure so the caller can treat it like a bounce (never silently drop).
export async function sendViaConnectedMailbox(
  mailbox: ConnectedMailbox,
  opts: { to: string; subject: string; html: string; fromName?: string; replyTo?: string | null; inReplyTo?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  if (mailbox.kind === "gmail") {
    return sendFromRecruiterGmail(mailbox.created_by, {
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      fromName: opts.fromName,
      replyTo: opts.replyTo,
      inReplyTo: opts.inReplyTo ?? undefined,
    });
  }
  return sendFromMicrosoft(mailbox.created_by, {
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
}
