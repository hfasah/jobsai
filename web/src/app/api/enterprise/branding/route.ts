import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  return NextResponse.json({ data: {
    name: org.name, slug: org.slug,
    logo_url: org.logo_url, brand_color: (org as { brand_color?: string }).brand_color ?? "#2563eb",
    tagline: (org as { tagline?: string }).tagline ?? null,
    careers_intro: (org as { careers_intro?: string }).careers_intro ?? null,
    show_powered_by: (org as { show_powered_by?: boolean }).show_powered_by ?? true,
    website: org.website,
  } });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can edit branding." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const f of ["logo_url", "brand_color", "tagline", "careers_intro", "show_powered_by", "website"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  const { data, error } = await supabaseAdmin.from("enterprise_orgs").update(update).eq("id", org.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
