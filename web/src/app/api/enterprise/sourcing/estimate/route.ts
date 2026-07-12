import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { sanitizeFilters, hasSearchableCriteria } from "@/lib/sourcing/filters";
import { getProvidersForOrg } from "@/lib/sourcing/registry";
import { ensureMonthlyGrant, getCreditCosts, getCreditState } from "@/lib/sourcing/credits";

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

  // Apply this month's plan credits (idempotent) so the balance shown here
  // matches what the search will actually spend against.
  await ensureMonthlyGrant(org.id);
  const [providers, costs, state] = await Promise.all([
    getProvidersForOrg(org.id),
    getCreditCosts(org.id),
    getCreditState(org.id),
  ]);

  const counting = providers.filter((p) => p.provider.capabilities.countCandidates);
  const counts = await Promise.allSettled(
    counting.map((p) => p.provider.countCandidates!(filters, { apiKey: p.apiKey, timeoutMs: 10000 })),
  );
  let total: number | null = null;
  for (const c of counts) {
    if (c.status === "fulfilled" && typeof c.value === "number") {
      total = (total ?? 0) + c.value;
    }
  }

  // Diagnostic: which provider(s) answered and what each returned — makes a
  // "0 candidates" estimate traceable (mock vs PDL vs a failing count call).
  console.info("[sourcing/estimate] summary", {
    providers: providers.map((p) => p.provider.key),
    counts: counts.map((c) => (c.status === "fulfilled" ? c.value : `err:${String(c.reason).slice(0, 80)}`)),
    total,
  });

  return NextResponse.json({
    data: {
      total,
      searchable: true,
      search_cost: costs.search,
      costs,
      balance: state.balance,
      // Whether any provider can serve the search — never expose which one.
      has_provider: providers.length > 0,
    },
  });
}
