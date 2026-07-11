import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getMyWorkspaces, ACTIVE_WORKSPACE_COOKIE } from "@/lib/enterprise";

// POST { workspace_id } — set the active workspace cookie. Only accepts a
// workspace the caller can actually access, so the cookie can never grant
// access it doesn't already have (resolveActiveOrg re-validates anyway).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id : "";
  if (!workspaceId) return NextResponse.json({ error: "workspace_id is required." }, { status: 400 });

  const accessible = await getMyWorkspaces(userId);
  if (!accessible.some((w) => w.id === workspaceId)) {
    return NextResponse.json({ error: "You don't have access to that workspace." }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
  });
  return NextResponse.json({ data: { active_workspace_id: workspaceId } });
}
