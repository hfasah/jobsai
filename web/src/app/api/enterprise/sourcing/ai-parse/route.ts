import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { parseQueryToFilters } from "@/lib/sourcing/nl-parse";
import { hasSearchableCriteria } from "@/lib/sourcing/filters";

export const maxDuration = 30;

// Natural language -> editable structured filters. Free (no credits): the
// recruiter reviews/edits the interpretation before the search executes.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { query } = await req.json().catch(() => ({}));
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required." }, { status: 400 });
  }

  const parsed = await parseQueryToFilters(query.trim(), { orgId: org.id, userId });
  return NextResponse.json({
    data: {
      filters: parsed.filters,
      dropped_criteria: parsed.dropped_criteria,
      searchable: hasSearchableCriteria(parsed.filters),
    },
  });
}
