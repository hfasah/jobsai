import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { createLinkToken, mergeConfigured } from "@/lib/merge";

export async function POST() {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const gated = await requireFeature(userId, "ats_integration");
  if (gated) return gated;

  if (!mergeConfigured()) {
    return NextResponse.json(
      { error: "ATS integration is not configured yet. Add MERGE_API_KEY to enable it." },
      { status: 503 },
    );
  }

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    `${org.slug ?? org.id}@jobsai.work`;

  try {
    const linkToken = await createLinkToken({ orgId: org.id, orgName: org.name ?? "Organization", email });
    return NextResponse.json({ link_token: linkToken });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to start ATS connection." }, { status: 502 });
  }
}
