import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { audit } from "@/lib/enterprise-audit";
import { getPipedriveIntegration, syncAllToPipedrive } from "@/lib/pipedrive";

export const maxDuration = 60;

// POST — push all CRM companies + contacts to Pipedrive now ("Sync now").
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "crm");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can run a sync." }, { status: 403 });
  }

  if (!(await getPipedriveIntegration(org.id))) {
    return NextResponse.json({ error: "Pipedrive isn't connected." }, { status: 400 });
  }

  const summary = await syncAllToPipedrive(org.id);
  await audit({ org_id: org.id, user_id: userId, action: "integration.synced", resource_type: "integration", metadata: { provider: "pipedrive", companies: summary.companies, contacts: summary.contacts } });
  return NextResponse.json({ data: summary });
}
