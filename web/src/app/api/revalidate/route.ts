import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// Sanity publish webhook → instant content refresh. Configured in Sanity
// (API → Webhooks) to POST here on create/update/delete with the document's
// _type and slug in the projection. Secret-authed via ?secret= so only Sanity
// can trigger revalidation. Content publishes therefore never need a deploy.

export async function POST(req: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  if (req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { _type?: string; slug?: { current?: string } | string };
  const type = typeof body._type === "string" ? body._type : null;
  const slug = typeof body.slug === "string" ? body.slug : body.slug?.current;

  const tags: string[] = [];
  if (type) {
    tags.push(`sanity:${type}`);
    if (typeof slug === "string" && slug) tags.push(`sanity:${type}:${slug}`);
  }
  for (const tag of tags) revalidateTag(tag);
  console.log("[revalidate] refreshed:", tags.join(", ") || "(nothing — missing _type)");

  return NextResponse.json({ ok: true, revalidated: tags });
}
