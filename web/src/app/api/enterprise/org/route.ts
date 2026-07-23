import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, uniqueSlug } from "@/lib/enterprise";
import { attributeOrgToPartner, PARTNER_REF_COOKIE } from "@/lib/partner-program";
import { ghlTrackEvent } from "@/lib/ghl";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  return NextResponse.json({ data: org });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getMyOrg(userId);
  if (existing) return NextResponse.json({ data: existing });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "Organization name is required." }, { status: 400 });

  const slug = await uniqueSlug(name);

  const { data: org, error } = await supabaseAdmin
    .from("enterprise_orgs")
    .insert({
      name,
      slug,
      industry: body.industry ?? null,
      size: body.size ?? null,
      website: body.website ?? null,
      phone: body.phone ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("enterprise_members").insert({
    org_id: org.id,
    user_id: userId,
    role: "owner",
  });

  // Credit a referring partner if this signup carried an attribution cookie.
  try {
    const code = (await cookies()).get(PARTNER_REF_COOKIE)?.value;
    await attributeOrgToPartner(org.id, code, { createdByUserId: userId });
  } catch {
    // Attribution is best-effort — never block workspace creation.
  }

  // Marketing milestone → GHL, so the agency's nurture reflects real product
  // progress. after() so it never delays or fails the response.
  after(async () => {
    try {
      const user = await (await clerkClient()).users.getUser(userId);
      await ghlTrackEvent(user.emailAddresses[0]?.emailAddress, "product-org-created", {
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      });
    } catch (e) {
      console.error("[org] ghl milestone failed:", e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ data: org }, { status: 201 });
}
