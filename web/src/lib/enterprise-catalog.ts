// Server-side loader for the pricing catalog (plans, features, plan→feature map).
// Shared by the admin catalog API, quote save, and the public quote page.
import { supabaseAdmin } from "@/lib/supabase";
import type { Catalog, QuotePlan, CatalogFeature } from "@/lib/enterprise-quote";

export async function loadCatalog(): Promise<Catalog> {
  const [{ data: plans }, { data: features }, { data: pf }] = await Promise.all([
    supabaseAdmin.from("plans").select("slug,name,price_monthly,price_yearly,sort_order").eq("active", true).order("sort_order"),
    supabaseAdmin.from("features").select("feature_key,name,category,is_addon,price_monthly").order("category"),
    supabaseAdmin.from("plan_features").select("plan:plans(slug),feature:features(feature_key)"),
  ]);

  const planFeatures: Record<string, string[]> = {};
  // PostgREST types embedded relations as arrays; these are to-one at runtime.
  for (const row of (pf ?? []) as unknown as { plan: { slug: string } | null; feature: { feature_key: string } | null }[]) {
    const slug = row.plan?.slug;
    const key = row.feature?.feature_key;
    if (!slug || !key) continue;
    (planFeatures[slug] ??= []).push(key);
  }

  return {
    plans: (plans ?? []) as QuotePlan[],
    features: (features ?? []) as CatalogFeature[],
    planFeatures,
  };
}
