import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getProvidersForOrg, getEmailVerifier } from "@/lib/sourcing/registry";
import { ensureMonthlyGrant, getCreditState } from "@/lib/sourcing/credits";
import { revealEmailForResult, type BulkRevealOutcome } from "@/lib/sourcing/reveal";
import { syncLeadToCrm } from "@/lib/sourcing/crm-sync";

export const maxDuration = 60;
const MAX_BULK = 100; // reveal up to 100 in one pass; the UI shows the credit cost first

// POST /api/enterprise/sourcing/bulk-reveal { resultIds: string[] }
// Reveals email for each selected result. Credits are spent per successful
// reveal (refunded on no-data). Stops early if credits run out, returning what
// was done. The recruiter then reviews and enrolls whichever they want.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  for (const feature of ["global_sourcing", "contact_reveal"] as const) {
    const gate = await requireFeature(userId, feature);
    if (gate) return gate;
  }
  const denied = await requirePermission(userId, "can_reveal_contacts");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  await ensureMonthlyGrant(org.id);

  const body = await req.json().catch(() => ({}));
  const resultIds: string[] = Array.isArray(body.resultIds)
    ? body.resultIds.filter((x: unknown): x is string => typeof x === "string").slice(0, MAX_BULK)
    : [];
  if (resultIds.length === 0) return NextResponse.json({ error: "resultIds is required." }, { status: 400 });

  const providers = await getProvidersForOrg(org.id);
  const verifier = getEmailVerifier();

  const outcomes: BulkRevealOutcome[] = [];
  let ranOut = false;
  for (const resultId of resultIds) {
    const outcome = await revealEmailForResult({ orgId: org.id, userId, resultId, providers, verifier });
    outcomes.push(outcome);
    if (outcome.status === "insufficient") { ranOut = true; break; }
  }

  const summary = {
    revealed: outcomes.filter((o) => o.status === "revealed").length,
    already: outcomes.filter((o) => o.status === "already").length,
    no_data: outcomes.filter((o) => o.status === "no_data").length,
    suppressed: outcomes.filter((o) => o.status === "suppressed").length,
    failed: outcomes.filter((o) => o.status === "error").length,
    credits_spent: outcomes.reduce((sum, o) => sum + (o.creditsCharged ?? 0), 0),
    ran_out: ranOut,
  };
  const state = await getCreditState(org.id);

  after(async () => {
    // Mirror every freshly-revealed lead into the Recruiting CRM (best-effort).
    for (const o of outcomes) {
      if (o.status === "revealed" && o.externalCandidateId) {
        await syncLeadToCrm(org.id, userId, o.externalCandidateId).catch((e) => console.error("[sourcing] CRM sync failed", e));
      }
    }
    audit({
      org_id: org.id, user_id: userId, action: "sourcing.contact_revealed",
      resource_type: "sourcing_bulk_reveal", metadata: { requested: resultIds.length, ...summary },
    });
  });

  return NextResponse.json({ data: { ...summary, balance: state.balance } });
}
