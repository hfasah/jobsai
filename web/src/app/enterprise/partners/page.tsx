import Link from "next/link";
import { ArrowRight, Handshake, Check, Sparkles, TrendingUp, Crown, Star, Link2, BarChart3, Megaphone, Headphones, Users, Rocket, Banknote, Wallet } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import {
  PARTNER_BENEFITS,
  COMMISSION_TABLE,
  PARTNER_TIERS,
  PARTNER_RULES,
  PARTNER_FAQ,
  STACKING_EXAMPLE,
  PROGRAM_COMPARISON,
  PARTNER_BASE_RATE,
  PARTNER_COMMISSION_MONTHS,
  FOUNDING_PARTNER_RATE,
  FOUNDING_PARTNER_LIMIT,
} from "@/lib/enterprise-partners";

export const metadata = {
  title: "Partner Program — JobsAI Enterprise",
  description: `Refer recruiting agencies, staffing firms, and HR teams to JobsAI Enterprise and earn ${PARTNER_BASE_RATE}–30% recurring cash commission for ${PARTNER_COMMISSION_MONTHS} months. Paid monthly via Stripe.`,
};

const APPLY = "/enterprise/partners/dashboard";
const BENEFIT_ICONS = [Banknote, Wallet, BarChart3, Link2, Megaphone, Headphones, Users, Rocket];
const TIER_ICONS = [Star, TrendingUp, Crown];

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Handshake className="h-6 w-6 text-white" /></div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Partner Program</p>
        <h1 className="mx-auto mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Turn your network into recurring cash</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Refer recruiting agencies, staffing firms, HR departments, and talent acquisition teams to JobsAI Enterprise — and earn {PARTNER_BASE_RATE}–30% recurring <strong>cash</strong> commission for {PARTNER_COMMISSION_MONTHS} months, paid monthly via Stripe.
        </p>
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Founding Partners: first {FOUNDING_PARTNER_LIMIT} lock {FOUNDING_PARTNER_RATE}% for {PARTNER_COMMISSION_MONTHS} months
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={APPLY} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Become a partner <ArrowRight className="h-4 w-4" /></Link>
          <a href="#how-it-works" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">See how it works</a>
        </div>
      </section>

      {/* Two programs, two audiences */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="mb-2 text-center text-2xl font-bold">Two programs, two audiences</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">Choose the one that fits — partners are paid in cash, customers earn account credits.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PROGRAM_COMPARISON.map((p) => {
            const cash = p.rewardType === "Cash";
            return (
              <div key={p.name} className={`flex flex-col rounded-2xl border bg-card p-6 ${cash ? "border-primary/50 shadow-glow" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cash ? "bg-gradient-brand" : "bg-primary/10"}`}>
                    {cash ? <Banknote className="h-5 w-5 text-white" /> : <Wallet className="h-5 w-5 text-primary" />}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${cash ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{p.rewardType}</span>
                </div>
                <h3 className="mt-3 font-bold">{p.name}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{p.audience}</p>
                <p className="mt-3 text-lg font-bold text-primary">{p.reward}</p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="mb-2 text-center text-2xl font-bold">Partner benefits</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">Everything you need to refer with confidence and get paid.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNER_BENEFITS.map((b, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
            return (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Commission structure */}
      <section id="how-it-works" className="border-y border-border bg-muted/20 px-6 py-14 scroll-mt-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold">How commission works</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Earn cash — a percentage of what your referred customers actually pay — every month, for a year.</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Customer plan</th>
                  <th className="px-5 py-3 font-semibold">Monthly fee</th>
                  <th className="px-5 py-3 text-right font-semibold">You earn ({PARTNER_BASE_RATE}%)</th>
                </tr>
              </thead>
              <tbody>
                {COMMISSION_TABLE.map((r) => (
                  <tr key={r.plan} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-semibold">{r.plan}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.monthly}/mo</td>
                    <td className="px-5 py-3 text-right font-bold text-primary">{r.earns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Illustrative, at the entry 20% rate on list price. Higher tiers earn up to 30%. Commission is always calculated on collected revenue.</p>
        </div>
      </section>

      {/* Stacking with the Lifetime Offer */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8">
          <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Stacks with the Lifetime Offer</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">
            The <strong>Lifetime Offer</strong> is the customer&apos;s discount (50% off for life). The <strong>Partner Program</strong> is your commission. They stack — and you earn on what the customer actually pays, which keeps it sustainable.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              { k: "Referred plan", v: `${STACKING_EXAMPLE.plan} (${STACKING_EXAMPLE.list}/mo)` },
              { k: "Customer pays", v: `${STACKING_EXAMPLE.customerPays}/mo`, hl: true },
              { k: `Your ${STACKING_EXAMPLE.rate}% commission`, v: `${STACKING_EXAMPLE.partnerMonthly}/mo`, hl: true },
              { k: `Over ${PARTNER_COMMISSION_MONTHS} months`, v: STACKING_EXAMPLE.partnerTotal },
            ].map((c) => (
              <div key={c.k} className={`rounded-xl border bg-card p-4 ${c.hl ? "border-primary/40" : "border-border"}`}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{c.k}</p>
                <p className={`mt-1 text-lg font-bold ${c.hl ? "text-primary" : ""}`}>{c.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Commission on the {STACKING_EXAMPLE.customerPays} they pay — not the {STACKING_EXAMPLE.list} list price.</p>
        </div>
      </section>

      {/* Tiers */}
      <section className="border-y border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-2xl font-bold">Partner tiers</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Your rate climbs as your active customers grow.</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {PARTNER_TIERS.map((t, i) => {
              const Icon = TIER_ICONS[i];
              const featured = t.level === 2;
              return (
                <div key={t.name} className={`flex flex-col rounded-2xl border bg-card p-6 ${featured ? "border-primary/50 shadow-glow" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                    <span className="text-3xl font-bold text-primary">{t.rate}%</span>
                  </div>
                  <h3 className="mt-3 font-bold">{t.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.requirement}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{t.blurb}</p>
                  <ul className="mt-4 space-y-2">
                    {t.perks.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{p}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h2 className="mb-2 text-center text-2xl font-bold">The rules, kept simple</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">Clear and fair, so partners and customers both win.</p>
        <div className="space-y-3">
          {PARTNER_RULES.map((r) => (
            <div key={r.label} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold">{r.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold">Partner FAQ</h2>
          <div className="space-y-3">
            {PARTNER_FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-border bg-card p-5">
                <p className="font-semibold">{f.q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-bold">Ready to partner with JobsAI?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Tell us about your audience and we&apos;ll get you set up with a referral link and partner dashboard.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={APPLY} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">Become a partner <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/enterprise/guide/partner-program" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">Read the guide</Link>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
