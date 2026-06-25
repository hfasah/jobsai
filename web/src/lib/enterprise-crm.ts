import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";

// Server-only CRM helpers. Client-safe constants/types live in lib/crm-shared.ts
// (re-exported here so server routes can import everything from one place).
export * from "@/lib/crm-shared";

// Shared server gate for every CRM API route. Resolves the caller, enforces the
// `crm` entitlement (requireFeature also requires an enterprise membership), and
// returns the caller's org. All CRM queries MUST scope by `org.id` — there is no
// RLS, scoping is enforced here in app code (the platform-wide pattern).
//
// Usage:
//   const ctx = await crmContext();
//   if (!ctx.ok) return ctx.res;
//   const { userId, org } = ctx;
type Org = NonNullable<Awaited<ReturnType<typeof getMyOrg>>>;
export type CrmContext =
  | { ok: true; userId: string; org: Org }
  | { ok: false; res: NextResponse };

export async function crmContext(): Promise<CrmContext> {
  const { userId } = await auth();
  if (!userId) return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "crm");
  if (gate) return { ok: false, res: gate };
  const org = await getMyOrg(userId);
  if (!org) return { ok: false, res: NextResponse.json({ error: "No organization found." }, { status: 404 }) };
  return { ok: true, userId, org };
}
