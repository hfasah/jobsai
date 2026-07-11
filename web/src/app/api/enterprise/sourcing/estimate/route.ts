import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { sanitizeFilters, hasSearchableCriteria } from "@/lib/sourcing/filters";
import { getProvidersForOrg } from "@/lib/sourcing/registry";
import { getCreditCosts, getCreditState } from "@/lib/sourcing/credits";

export const maxDuration = 30;

// Live match-count + cost estimate for the current filters — powers the
// "X candidates match · this search will use Y credits" banner BEFORE any
// spend. Count calls are cheap (mock: free; PDL: size-1 probe).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const filters = sanitizeFilters(body.filters);
  if (!hasSearchableCriteria(filters)) {
    return NextResponse.json({ data: { total: 0, searchable: false } });
  }

  const [providers, costs, state] = await Promise.all([
    getProvidersForOrg(org.id),
    getCreditCosts(org.id),
    getCreditState(org.id),
  ]);

  const counts = await Promise.allSettled(
    providers
      .filter((p) => p.provider.capabilities.countCandidates)
      .map((p) => p.provider.countCandidates!(filters, { apiKey: p.apiKey, timeoutMs: 10000 })),
  );
  let total: number | null = null;
  for (const c of counts) {
    if (c.status === "fulfilled" && typeof c.value === "number") {
      total = (total ?? 0) + c.value;
    }
  }

  return NextResponse.json({
    data: {
      total,
      searchable: true,
      search_cost: costs.search,
      balance: state.balance,
      providers: providers.map((p) => p.provider.key),
    },
  });
}
