"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Check, Sparkles, Send, Copy, ExternalLink, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolPref } from "@/lib/enterprise-intake";
import {
  computeQuote, minPlanForFeatures, fmtUSD, INTAKE_TO_CATALOG, EXTRA_RECRUITER_PRICE,
  type Catalog,
} from "@/lib/enterprise-quote";

export type QuoteLead = {
  id: string;
  company: string;
  contact_name: string;
  contact_email: string;
  num_recruiters: number | null;
  tool_prefs: Record<string, ToolPref>;
  suggested_plan: string | null;
};

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

export function QuoteBuilder({ lead, onClose, onConverted }: { lead: QuoteLead; onClose: () => void; onConverted?: () => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);

  // Bundled features the admin wants. The plan is derived as the smallest tier
  // covering them, so checking/unchecking is fully reversible.
  const [wantedKeys, setWantedKeys] = useState<Set<string>>(new Set());
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [addons, setAddons] = useState<Record<string, number>>({});
  const [extraRecruiters, setExtraRecruiters] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [founding, setFounding] = useState(false);
  const [override, setOverride] = useState("");
  const [notes, setNotes] = useState("");

  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [quoteToken, setQuoteToken] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | "draft" | "send" | "convert">(null);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Load catalog + pre-fill from the lead's selections.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/admin/enterprise/catalog");
      const c = (await res.json()) as Catalog;
      if (!alive) return;
      setCatalog(c);

      const addonKeys = new Set(c.features.filter((f) => f.is_addon).map((f) => f.feature_key));
      const wantedBundled: string[] = [];
      const wantedAddons: Record<string, number> = {};
      for (const [intakeKey, pref] of Object.entries(lead.tool_prefs ?? {})) {
        if (pref !== "need" && pref !== "want") continue;
        for (const fk of INTAKE_TO_CATALOG[intakeKey] ?? []) {
          if (addonKeys.has(fk)) wantedAddons[fk] = 1;
          else wantedBundled.push(fk);
        }
      }
      setAddons(wantedAddons);

      // Start on the higher of (suggested plan, min plan covering wanted
      // features) and pre-check that tier's features.
      const order = (slug: string) => c.plans.find((p) => p.slug === slug)?.sort_order ?? 0;
      const byFeatures = minPlanForFeatures(wantedBundled, c);
      const suggested = lead.suggested_plan ?? "agency";
      const initialPlan = order(byFeatures) >= order(suggested) ? byFeatures : suggested;
      setWantedKeys(new Set(c.planFeatures[initialPlan] ?? []));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [lead]);

  // Plan is the smallest tier covering the wanted features.
  const planSlug = useMemo(
    () => (catalog ? minPlanForFeatures([...wantedKeys], catalog) : "agency"),
    [catalog, wantedKeys],
  );

  const result = useMemo(() => {
    if (!catalog) return null;
    return computeQuote({
      planSlug, billingPeriod: billing,
      addons: Object.entries(addons).map(([feature_key, quantity]) => ({ feature_key, quantity })),
      extraRecruiters, discountPct, founding,
      priceOverrideMonthlyCents: override ? Math.round(Number(override) * 100) : null,
    }, catalog);
  }, [catalog, planSlug, billing, addons, extraRecruiters, discountPct, founding, override]);

  if (loading || !catalog || !result) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </Overlay>
    );
  }

  const plansAsc = [...catalog.plans].sort((a, b) => a.sort_order - b.sort_order);
  const included = new Set(catalog.planFeatures[planSlug] ?? []);
  const unlockTier = (key: string) => plansAsc.find((p) => (catalog.planFeatures[p.slug] ?? []).includes(key));
  const toggleFeature = (key: string) =>
    setWantedKeys((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const selectPlanFeatures = (slug: string) => setWantedKeys(new Set(catalog.planFeatures[slug] ?? []));
  const bundled = catalog.features.filter((f) => !f.is_addon);
  const addonFeatures = catalog.features.filter((f) => f.is_addon && f.feature_key !== "extra_recruiter");
  const categories = [...new Set(bundled.map((f) => f.category ?? "Other"))];

  const toggleAddon = (key: string) =>
    setAddons((a) => { const n = { ...a }; if (n[key]) delete n[key]; else n[key] = 1; return n; });

  const bodyForSave = () => ({
    id: quoteId ?? undefined,
    lead_id: lead.id,
    company: lead.company,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    plan_slug: planSlug,
    billing_period: billing,
    addons: Object.entries(addons).map(([feature_key, quantity]) => ({ feature_key, quantity })),
    extra_recruiters: extraRecruiters,
    discount_pct: discountPct,
    founding,
    price_override_monthly_cents: override ? Math.round(Number(override) * 100) : null,
    notes,
  });

  const save = async (): Promise<string | null> => {
    const res = await fetch("/api/admin/enterprise/quote", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyForSave()),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? "Could not save."); return null; }
    setQuoteId(json.quote.id);
    setQuoteToken(json.quote.token);
    return json.quote.id;
  };

  const onSaveDraft = async () => { setSaving("draft"); setMsg(""); const id = await save(); if (id) setMsg("Draft saved."); setSaving(null); };

  const onSend = async () => {
    setSaving("send"); setMsg("");
    const id = await save();
    if (!id) { setSaving(null); return; }
    const res = await fetch(`/api/admin/enterprise/quote/${id}`, { method: "POST" });
    setMsg(res.ok ? `Quote emailed to ${lead.contact_email}.` : "Saved, but the email failed.");
    setSaving(null);
  };

  const onConvert = async () => {
    setSaving("convert"); setMsg("");
    await save();
    const res = await fetch("/api/admin/enterprise", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: lead.company, owner_email: lead.contact_email, contact_name: lead.contact_name,
        plan_slug: planSlug, access_status: "trialing",
        admin_notes: `From quote. ${notes}`.trim(),
      }),
    });
    if (res.ok) {
      await fetch(`/api/admin/enterprise/quote/${quoteId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "accepted" }),
      }).catch(() => {});
      setMsg("Account created 🎉");
      onConverted?.();
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error ?? "Could not create the account.");
    }
    setSaving(null);
  };

  const quoteUrl = quoteToken ? `${window.location.origin}/enterprise/quote/${quoteToken}` : null;

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-primary" /> Build a quote</h2>
          <p className="text-sm text-muted-foreground">{lead.company} · {lead.contact_email}</p>
        </div>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
      </div>

      <div className="grid max-h-[70vh] gap-0 overflow-hidden lg:grid-cols-[1fr_340px]">
        {/* Left: configuration */}
        <div className="space-y-6 overflow-y-auto p-5">
          {/* Plan + billing */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Plan</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {plansAsc.map((p) => (
                <button key={p.slug} onClick={() => selectPlanFeatures(p.slug)}
                  className={cn("rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                    planSlug === p.slug ? "border-primary bg-primary text-white shadow-glow" : "border-border text-foreground hover:border-primary/50 hover:bg-muted")}>
                  {p.name}
                  <span className={cn("block text-xs font-medium", planSlug === p.slug ? "text-white/80" : "text-muted-foreground")}>{p.price_monthly != null ? `$${p.price_monthly}/mo` : "Custom"}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 inline-flex rounded-lg border border-border p-0.5 text-sm">
              {(["monthly", "yearly"] as const).map((b) => (
                <button key={b} onClick={() => setBilling(b)}
                  className={cn("rounded-md px-3 py-1 font-medium capitalize", billing === b ? "bg-primary text-white" : "text-muted-foreground")}>
                  {b}{b === "yearly" && " (−20%)"}
                </button>
              ))}
            </div>
          </div>

          {/* Features */}
          <div>
            <label className="mb-1 block text-sm font-bold text-foreground">Features</label>
            <p className="mb-2 text-xs text-muted-foreground">Check to add, uncheck to remove — the plan and price update automatically.</p>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/70">{cat}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {bundled.filter((f) => (f.category ?? "Other") === cat).map((f) => {
                      const wanted = wantedKeys.has(f.feature_key);
                      const incl = included.has(f.feature_key);
                      const tier = unlockTier(f.feature_key);
                      // Freebie: covered by the plan because a higher-tier feature
                      // pulled the plan up. Shown for clarity, not toggleable.
                      if (incl && !wanted) {
                        return (
                          <div key={f.feature_key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 shrink-0 text-emerald-500/50" />
                            <span>{f.name} <span className="text-[11px] text-muted-foreground/70">· included</span></span>
                          </div>
                        );
                      }
                      return (
                        <button key={f.feature_key} onClick={() => toggleFeature(f.feature_key)}
                          className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                            wanted ? "font-medium text-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                          {wanted
                            ? <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-primary text-white"><Check className="h-3 w-3" /></span>
                            : <span className="h-4 w-4 shrink-0 rounded border-2 border-muted-foreground/50" />}
                          <span>{f.name}{!incl && tier && <span className="ml-1 text-[11px] font-medium text-primary/80">{tier.name}+</span>}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div>
            <label className="mb-2 block text-sm font-semibold">Add-ons</label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {addonFeatures.map((f) => (
                <button key={f.feature_key} onClick={() => toggleAddon(f.feature_key)}
                  className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", addons[f.feature_key] ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}>
                  <span className="flex items-center gap-2">{addons[f.feature_key] ? <Check className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-muted-foreground" />}{f.name}</span>
                  <span className="text-xs text-muted-foreground">{fmtUSD((f.price_monthly ?? 0) * 100)}/mo</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label className="text-sm">Additional recruiters</label>
              <input type="number" min={0} value={extraRecruiters} onChange={(e) => setExtraRecruiters(Math.max(0, Number(e.target.value) || 0))} className={cn(inputCls, "w-24")} />
              <span className="text-xs text-muted-foreground">${EXTRA_RECRUITER_PRICE}/seat/mo</span>
            </div>
          </div>

          {/* Pricing knobs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={founding} onChange={(e) => setFounding(e.target.checked)} /> Founding 50% (1st yr)</label>
            <div><label className="mb-1 block text-xs text-muted-foreground">Custom discount %</label><input type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className={inputCls} /></div>
            <div><label className="mb-1 block text-xs text-muted-foreground">Override $/mo</label><input type="number" min={0} placeholder="auto" value={override} onChange={(e) => setOverride(e.target.value)} className={inputCls} /></div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Notes shown on the quote</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(inputCls, "resize-none")} placeholder="Custom terms, scope notes…" />
          </div>
        </div>

        {/* Right: live summary */}
        <aside className="flex flex-col border-t border-border bg-muted/20 p-5 lg:border-l lg:border-t-0">
          <p className="text-sm font-semibold text-muted-foreground">{result.plan.name} · {billing}</p>
          {result.custom ? (
            <p className="mt-2 text-sm text-amber-500">Enterprise is custom — set an Override $/mo.</p>
          ) : (
            <div className="mt-1 flex items-end gap-1">
              <span className="text-3xl font-bold">{billing === "yearly" ? fmtUSD(result.yearlyTotalCents) : fmtUSD(result.monthlyTotalCents)}</span>
              <span className="mb-1 text-sm text-muted-foreground">/{billing === "yearly" ? "yr" : "mo"}</span>
            </div>
          )}
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
            <Row label="Monthly" value={`${fmtUSD(result.monthlyTotalCents)}/mo`} />
            <Row label="Yearly" value={`${fmtUSD(result.yearlyTotalCents)}/yr`} />
            {result.yearlySavingsCents > 0 && <Row label="Yearly saving" value={fmtUSD(result.yearlySavingsCents)} accent />}
            {result.discountPct > 0 && <Row label={`Discount ${result.discountPct}%`} value="applied" />}
            {founding && <Row label="Founding 1st yr" value={`−${fmtUSD(result.foundingSavingsCents)}`} accent />}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>First year</span><span>{fmtUSD(result.firstYearCents)}</span></div>
          </div>

          {quoteUrl && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background p-2 text-xs">
              <span className="truncate text-muted-foreground">{quoteUrl}</span>
              <button onClick={() => { navigator.clipboard.writeText(quoteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="shrink-0">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button>
              <a href={quoteUrl} target="_blank" rel="noreferrer" className="shrink-0"><ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          )}
          {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}

          <div className="mt-auto space-y-2 pt-4">
            <button onClick={onSend} disabled={!!saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
              {saving === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Email quote to client
            </button>
            <div className="flex gap-2">
              <button onClick={onSaveDraft} disabled={!!saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft
              </button>
              <button onClick={onConvert} disabled={!!saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-60">
                {saving === "convert" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />} Convert
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={cn("flex justify-between", accent ? "text-emerald-600" : "text-muted-foreground")}><span>{label}</span><span className={cn("font-medium", !accent && "text-foreground")}>{value}</span></div>;
}
