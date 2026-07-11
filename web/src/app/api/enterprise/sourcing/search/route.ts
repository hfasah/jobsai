import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { internalRediscoverySearch } from "@/lib/sourcing/internal-search";

export const maxDuration = 45;

// Internal "AI Talent Rediscovery" — ranks the org's own applicants + talent
// pool against a plain-English ask. Core logic lives in
// lib/sourcing/internal-search.ts, shared with Global Sourcing's Combined mode.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "ai_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { query, job_id, limit = 20 } = await req.json().catch(() => ({}));
  if (!query?.trim()) return NextResponse.json({ error: "query is required." }, { status: 400 });

  const result = await internalRediscoverySearch({
    orgId: org.id,
    userId,
    query,
    jobId: job_id ?? null,
    limit,
  });

  return NextResponse.json({
    data: {
      candidates: result.candidates,
      total_searched: result.total_searched,
      query,
    },
  });
}
