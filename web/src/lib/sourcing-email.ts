import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { linkifyHtml } from "@/lib/email-utils";

// Shared formatting + identity for recruiter outreach + follow-up emails, so
// candidate-facing mail looks professional and replies always reach the recruiter.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A friendly first name for the greeting. Many emailed candidates are stored
// with their email handle as the name (e.g. "hfasah", "dimmples038"); greeting
// those by handle looks like spam, so fall back to "there".
export function greetingName(name: string | undefined): string {
  const n = (name ?? "").trim();
  if (n.includes(" ")) return n.split(/\s+/)[0];                  // "Jane Doe" → "Jane"
  if (!n || /[0-9_]/.test(n) || n === n.toLowerCase()) return "there"; // handle-like
  return n;                                                        // already a proper single name
}

// Drop any AI-generated sign-off so we control a single, consistent signature.
// ONLY a sign-off at the END counts: the phrase may be followed by at most a
// couple of short name lines. The old greedy version matched the FIRST
// "Thanks…"/"Best…" anywhere and deleted the entire rest of the email — a body
// with a mid-message "Thanks for your interest!" arrived as just the greeting.
function stripSignoff(body: string): string {
  return body
    .trim()
    .replace(/\n+\s*(best regards|warm regards|kind regards|regards|best wishes|best|thanks|thank you|cheers|sincerely|yours)[,!.]?\s*(\n[^\n]{0,60}){0,3}\s*$/i, "")
    .trim();
}

/** Render plain outreach text into clean paragraphs + a recruiter signature. */
export function renderOutreachBody(body: string, recruiterName: string, orgName: string): string {
  const paras = stripSignoff(body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.65;font-size:15px;color:#0f172a">${linkifyHtml(esc(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const sigLines = ["Best regards,", recruiterName, orgName].map((l) => l.trim()).filter(Boolean).map(esc);
  const sig = `<p style="margin:24px 0 0;line-height:1.6;font-size:15px;color:#0f172a">${sigLines.join("<br>")}</p>`;
  return paras + sig;
}

/**
 * The recruiter's display name + the address replies should land in. Prefers a
 * connected mailbox (Google) — that's where outreach is sent from and where
 * replies will thread — falling back to the recruiter's account email.
 */
export async function getRecruiterIdentity(userId: string): Promise<{ name: string; email: string | null }> {
  let name = "";
  let email: string | null = null;
  try {
    const u = await (await clerkClient()).users.getUser(userId);
    name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
    email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null;
  } catch { /* fall through to OAuth mailbox */ }

  const { data: acct } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("email")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (acct?.email) email = acct.email as string;

  return { name, email };
}
