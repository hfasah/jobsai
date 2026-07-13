// PUBLIC unsubscribe endpoint — no auth. Reached from the footer link and the
// List-Unsubscribe / one-click (POST) header on every campaign email.
//
//   GET  ?t=<token>  → a confirmation page with a one-click "Unsubscribe" button
//   POST ?t=<token>  → performs the opt-out (also handles RFC-8058 one-click)
//
// The token is an opaque per-enrollment uuid, so no org/campaign/candidate id is
// ever exposed. Opting out records an org-wide Do-Not-Contact entry and stops
// every active sequence for that address.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { suppressEmail } from "@/lib/outreach/suppression";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function page(title: string, bodyHtml: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f7f9;color:#1a1d23;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;box-shadow:0 1px 3px rgba(16,24,40,.08);max-width:440px;width:100%;padding:32px;text-align:center}
h1{font-size:20px;margin:0 0 10px;letter-spacing:-.01em}p{color:#545a66;font-size:14px;line-height:1.55;margin:0 0 18px}
button{font:inherit;font-weight:600;font-size:14px;background:#c0392b;color:#fff;border:0;border-radius:10px;padding:11px 22px;cursor:pointer}
button:hover{background:#a93226}.muted{font-size:12px;color:#878e9a;margin:16px 0 0}b{color:#1a1d23}</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function lookup(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("org_id, candidate_email, org:enterprise_orgs(name)")
    .eq("unsubscribe_token", token)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const orgRel = data.org as { name?: string } | { name?: string }[] | null;
  const orgName = (Array.isArray(orgRel) ? orgRel[0]?.name : orgRel?.name) ?? "this recruiter";
  return {
    orgId: data.org_id as string,
    email: data.candidate_email as string,
    orgName,
  };
}

async function performUnsubscribe(orgId: string, email: string) {
  await suppressEmail({ orgId, email, reason: "explicit_unsubscribe", source: "recruiter_action", notes: "one-click unsubscribe" });
  // Stop every active sequence for this address in the org.
  await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .update({ status: "unsubscribed", next_send_at: null })
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .eq("status", "active");
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const rec = await lookup(token);
  if (!rec) return page("Unsubscribe", `<h1>Link not found</h1><p>This unsubscribe link is invalid or has expired. If you keep receiving emails, reply with “unsubscribe” and you'll be removed.</p>`);
  return page("Unsubscribe", `<h1>Unsubscribe from ${esc(rec.orgName)}</h1>
<p>Confirm you'd like to stop receiving recruiting emails at <b>${esc(rec.email)}</b>. This can't be undone by you, but the recruiter can re-add you on request.</p>
<form method="POST" action="/api/outreach/unsubscribe?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe me</button></form>
<p class="muted">You'll stop receiving all outreach from ${esc(rec.orgName)}.</p>`);
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const rec = await lookup(token);
  if (!rec) {
    // One-click clients expect a 200 even on a stale token.
    return page("Unsubscribed", `<h1>You're unsubscribed</h1><p>You won't receive further recruiting emails from this list.</p>`);
  }
  await performUnsubscribe(rec.orgId, rec.email);
  return page("Unsubscribed", `<h1>You're unsubscribed</h1><p><b>${esc(rec.email)}</b> has been removed. ${esc(rec.orgName)} won't email you again.</p>`);
}
