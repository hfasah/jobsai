import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg, getMyWorkspaces, uniqueSlug } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

// GET — the workspaces the caller can switch between (agency parent + clients).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaces = await getMyWorkspaces(userId);
  return NextResponse.json({ data: workspaces });
}

// POST { name } — create a client workspace under the caller's current org
// (which becomes/stays the agency parent). Requires the agency_workspaces
// feature + settings permission. The creator is added as owner of the new
// workspace; it inherits the parent's plan/access via the entitlement rollup.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "agency_workspaces");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const parent = (await getMyOrg(userId)) as
    | ({ id: string; parent_org_id?: string | null; access_status?: string | null; plan_id?: string | null })
    | null;
  if (!parent) return NextResponse.json({ error: "No organization." }, { status: 404 });
  // Workspaces nest one level only — you can't create a client under a client.
  if (parent.parent_org_id) {
    return NextResponse.json({ error: "You're inside a client workspace. Switch to your agency to add clients." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (!name) return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });

  const slug = await uniqueSlug(name);
  const { data: created, error } = await supabaseAdmin
    .from("enterprise_orgs")
    .insert({
      name,
      slug,
      parent_org_id: parent.id,
      // Child inherits the agency's access status so it's usable immediately;
      // plan/entitlements resolve through the parent (no own plan_id).
      access_status: parent.access_status ?? "active",
      created_by: userId,
    })
    .select("id, name, slug")
    .single();
  if (error || !created) {
    return NextResponse.json({ error: "Could not create the workspace." }, { status: 500 });
  }
  const workspace = created as { id: string; name: string; slug: string };

  // The agency admin who created it is an explicit owner (other agency
  // owner/admins reach it via inherited access).
  await supabaseAdmin.from("enterprise_members").insert({ org_id: workspace.id, user_id: userId, role: "owner" });

  audit({
    org_id: parent.id,
    user_id: userId,
    action: "workspace.created",
    resource_type: "enterprise_org",
    resource_id: workspace.id,
    metadata: { name, slug },
  });

  return NextResponse.json({ data: workspace });
}
