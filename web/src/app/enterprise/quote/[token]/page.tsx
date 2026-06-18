import { Check, X, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { supabaseAdmin } from "@/lib/supabase";
import { loadCatalog } from "@/lib/enterprise-catalog";
import { fmtUSD } from "@/lib/enterprise-quote";
import { AcceptButton } from "./accept-button";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your quote — JobsAI Enterprise",
  robots: { index: false, follow: false },
};

export default async function QuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ print?: string }> }) {
  const { token } = await params;
  const autoPrint = (await searchParams).print === "1";
  const { data: q } = await supabaseAdmin.from("enterprise_quotes").select("*").eq("token", token).maybeSingle();
  if (!q) notFound();

  const catalog = await loadCatalog();
  const plan = catalog.plans.find((p) => p.slug === q.plan_slug);
  const planName = plan?.name ?? (q.plan_slug as string);

  // Lowest tier that unlocks each bundled feature (for "not included" labels).
  const plansAsc = [...catalog.plans].sort((a, b) => a.sort_order - b.sort_order);
  const unlockTier = (key: string) =>
    plansAsc.find((p) => (catalog.planFeatures[p.slug] ?? []).includes(key))?.name ?? "Enterprise";

  const included = new Set(catalog.planFeatures[q.plan_slug] ?? []);
  const bundled = catalog.features.filter((f) => !f.is_addon);
  const byCategory = new Map<string, typeof bundled>();
  for (const f of bundled) {
    const cat = f.category ?? "Other";
    (byCategory.get(cat) ?? byCategory.set(cat, []).get(cat)!).push(f);
  }

  const addonRows = (q.addons as { feature_key: string; quantity: number }[] ?? [])
    .map((a) => catalog.features.find((f) => f.feature_key === a.feature_key))
    .filter((f): f is NonNullable<typeof f> => !!f);

  const yearlySavings = Math.max(0, q.monthly_cents * 12 - q.yearly_cents);
  const isYearly = q.billing_period === "yearly";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="no-print"><PublicEnterpriseHeader /></div>

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Your personalized quote</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {q.company ? `Prepared for ${q.company}` : "Your JobsAI Enterprise quote"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          The <strong className="text-foreground">{planName}</strong> plan, tailored to your team. Here&apos;s exactly what&apos;s included and what it costs.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* What you get / don't get */}
          <div className="space-y-8">
            {[...byCategory.entries()].map(([cat, feats]) => (
              <div key={cat}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{cat}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {feats.map((f) => {
                    const has = included.has(f.feature_key);
                    return (
                      <li key={f.feature_key} className={`flex items-center gap-2 text-sm ${has ? "" : "text-muted-foreground/70"}`}>
                        {has
                          ? <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                          : <X className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
                        <span>{f.name}{!has && <span className="ml-1 text-xs text-muted-foreground/60">({unlockTier(f.feature_key)}+)</span>}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {addonRows.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">Add-ons</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {addonRows.map((f) => (
                    <li key={f.feature_key} className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                      {f.name} <span className="text-muted-foreground">— {fmtUSD((f.price_monthly ?? 0) * 100)}/mo</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Price card */}
          <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-primary/30 bg-card p-6 shadow-lg shadow-primary/5">
            <p className="text-sm font-semibold text-muted-foreground">{planName} plan</p>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-bold">{isYearly ? fmtUSD(q.yearly_cents) : fmtUSD(q.monthly_cents)}</span>
              <span className="mb-1 text-sm text-muted-foreground">/{isYearly ? "yr" : "mo"}</span>
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Monthly</span><span className="font-medium text-foreground">{fmtUSD(q.monthly_cents)}/mo</span></div>
              <div className="flex justify-between"><span>Yearly</span><span className="font-medium text-foreground">{fmtUSD(q.yearly_cents)}/yr</span></div>
              {yearlySavings > 0 && <div className="flex justify-between text-emerald-600"><span>Save with yearly</span><span className="font-medium">{fmtUSD(yearlySavings)}</span></div>}
              {q.founding && (
                <div className="flex justify-between text-primary"><span>Founding offer (1st year)</span><span className="font-medium">50% off</span></div>
              )}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-foreground"><span>First year</span><span>{fmtUSD(q.first_year_cents)}</span></div>
            </div>
            {q.notes && <p className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">{q.notes}</p>}
            <div className="mt-5 space-y-2">
              <div className="no-print"><AcceptButton token={token} accepted={q.status === "accepted"} /></div>
              <PrintButton auto={autoPrint} />
            </div>
            <p className="no-print mt-3 text-center text-xs text-muted-foreground">
              Questions? <Link href="/enterprise/demo" className="font-semibold text-primary hover:underline">Talk to our team <ArrowRight className="inline h-3 w-3" /></Link>
            </p>
          </aside>
        </div>
      </section>

      <div className="no-print"><PublicEnterpriseFooter /></div>
    </main>
  );
}
