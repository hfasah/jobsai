import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const o = org as unknown as Record<string, unknown>;
  return NextResponse.json({ data: {
    name: org.name, slug: org.slug,
    logo_url: org.logo_url,
    brand_color: o.brand_color ?? "#2563eb",
    portal_title: o.portal_title ?? null,
    tagline: o.tagline ?? null,
    careers_intro: o.careers_intro ?? null,
    show_powered_by: o.show_powered_by ?? true,
    website: org.website,
    cover_image_url: o.cover_image_url ?? null,
    culture_text: o.culture_text ?? null,
    benefits: o.benefits ?? [],
    social_links: o.social_links ?? {},
    custom_domain: o.custom_domain ?? null,
    white_label_email_from: o.white_label_email_from ?? null,
  } });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "white_label");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can edit branding." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const f of ["logo_url", "brand_color", "tagline", "careers_intro", "show_powered_by", "website", "cover_image_url", "culture_text", "benefits", "social_links", "custom_domain", "white_label_email_from"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  const { data, error } = await supabaseAdmin.from("enterprise_orgs").update(update).eq("id", org.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // portal_title written separately and best-effort so core branding still saves
  // even on deployments where the column hasn't been added yet (migration 045).
  if (body.portal_title !== undefined) {
    const { error: ptErr } = await supabaseAdmin.from("enterprise_orgs").update({ portal_title: body.portal_title }).eq("id", org.id);
    if (ptErr) console.warn("portal_title not saved (run migration 045):", ptErr.message);
  }

  return NextResponse.json({ data });
}
