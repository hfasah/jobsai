import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { DEMO_ORG_COOKIE } from "@/lib/enterprise";

export const dynamic = "force-dynamic";

// POST { org_id } — super-admin "Open workspace": set a cookie so the admin
// enters that org's workspace directly (no invite/membership). Admin-only; the
// cookie is ignored server-side for non-admins.
export async function POST(req: NextRequest) {
  const admin = await requireAdminPerm("users.impersonate");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { org_id } = await req.json().catch(() => ({}));
  if (!org_id || typeof org_id !== "string") {
    return NextResponse.json({ error: "org_id required" }, { status: 400 });
  }

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("id,slug").eq("id", org_id).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true, slug: org.slug });
  res.cookies.set(DEMO_ORG_COOKIE, org.id, {
    httpOnly: false, // a thin client banner reads it to show "exit demo view"
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}

// DELETE — stop impersonating (exit the demo view).
export async function DELETE() {
  const admin = await requireAdminPerm("users.impersonate");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DEMO_ORG_COOKIE);
  return res;
}
