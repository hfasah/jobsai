import { NextRequest, NextResponse } from "next/server";
import { ghlUpsertContact, type GhlAttribution } from "@/lib/ghl";

// Public lead-capture endpoint for CMS marketing pages. Forwards the lead into
// GoHighLevel server-side (the token never reaches the browser) with
// first-touch attribution. Content-only surface: no database, no auth.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    firstName?: string; email?: string; phone?: string; tag?: string;
    website?: string; attribution?: GhlAttribution | null;
  };

  // Honeypot: bots fill the invisible "website" field. Tell them it worked.
  if (body.website) return NextResponse.json({ ok: true });

  const email = (body.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const tag = (body.tag ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 40);
  const ok = await ghlUpsertContact({
    email,
    firstName: (body.firstName ?? "").trim().slice(0, 80) || undefined,
    phone: (body.phone ?? "").trim().slice(0, 30) || undefined,
    tags: ["jobsai-lead", ...(tag ? [tag] : [])],
    source: "jobsai-lp",
    attribution: body.attribution ?? undefined,
  });

  // ok=false covers both "GHL rejected it" and "GHL not configured yet" —
  // either way the visitor shouldn't see a failure for our plumbing.
  if (!ok) console.warn("[marketing/lead] lead not delivered to GHL:", email);
  return NextResponse.json({ ok: true });
}
