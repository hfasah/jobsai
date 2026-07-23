import Link from "next/link";
import { Check, Building2, Sparkles } from "lucide-react";
import { PlanComparison } from "@/components/enterprise/plan-comparison";
import { EnterprisePricingCards } from "@/components/enterprise/pricing-cards";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { RoiCalculator } from "@/components/enterprise/roi-calculator";
import { PLANS, monthlyEquiv, annualTotal } from "@/lib/enterprise-plans";
import { sanityFetch } from "@/lib/sanity";

export const metadata = {
  title: "JobsAI Enterprise pricing: plans, billing & free trial",
  description: "JobsAI Enterprise pricing: monthly or annual billing (save 20%), plans from $299/mo ($239/mo billed annually), each with a 14-day free trial.",
};

const BOOK_DEMO = "/enterprise/demo";

// Add-ons sell OUTCOMES first — the feature list is supporting detail.
const ADDONS = [
  { name: "AI Interview Suite", price: "+$199/mo", outcome: "Reduce screening time by up to 80%", features: ["AI voice interviews", "AI avatar interviews", "Auto scoring", "Transcripts"] },
  { name: "Autonomous Recruiting Agent", price: "+$499/mo", outcome: "Your AI recruiter that never sleeps", features: ["24/7 sourcing", "Outreach & follow-ups", "Talent rediscovery", "Recommendations"] },
  { name: "SMS & WhatsApp", price: "+$99/mo", outcome: "Reach candidates where they respond fastest", features: ["Instant messaging", "Automated reminders", "Fewer no-shows"] },
  { name: "White Label Plus", price: "+$199/mo", outcome: "Make JobsAI look like your platform", features: ["Custom domain", "Branding removal", "Custom email branding"] },
  { name: "Additional Recruiters", price: "+$29/user/mo", outcome: "Scale your recruiting team instantly", features: ["Extra seats anytime", "Own workspace & pipeline per recruiter"] },
];

const WHY = ["ATS", "Recruiting CRM", "AI Sourcing", "AI Screening", "AI Interviews", "Workflow Automation", "Offer Management", "Analytics", "Compliance", "Enterprise Security"];

const INTEGRATIONS = ["Google Workspace", "Microsoft 365", "Workday", "Greenhouse", "Lever", "Ashby", "BambooHR", "ADP", "Pipedrive", "Stripe"];

// Honest competitive matrix — based on publicly available information; the
// footnote says so. This is also the page's best organic-search asset.
const COMPETITORS = ["JobsAI", "Ashby", "Greenhouse", "Loxo", "Pin"];
const COMPETE_ROWS: { label: string; v: boolean[] }[] = [
  { label: "Applicant Tracking System", v: [true, true, true, true, false] },
  { label: "AI Interviews (voice & avatar)", v: [true, false, false, false, false] },
  { label: "Recruiting CRM", v: [true, false, false, true, false] },
  { label: "AI Sourcing & Outreach", v: [true, false, false, true, true] },
  { label: "Workflow Automation", v: [true, true, true, false, false] },
  { label: "White Label & Client Portal", v: [true, false, false, false, false] },
  { label: "Autonomous Recruiting Agent", v: [true, false, false, false, false] },
];

const FAQS: { q: string; a: string }[] = [
  { q: "Can I upgrade my plan anytime?", a: "Yes. Upgrades apply immediately and the price difference is prorated automatically by Stripe. Your team, data, and settings carry over untouched." },
  { q: "Can I downgrade?", a: "Yes, from Billing at any time. Downgrades take effect at the end of your current billing period so you keep everything you've paid for." },
  { q: "What happens after my 14-day free trial?", a: "Your selected plan starts automatically on the card you added at signup. Cancel before the trial ends and you won't be charged at all." },
  { q: "Can I cancel?", a: "Anytime, in one click from Billing. You keep access until the end of the period you've paid for, and your data can be exported before you go." },
  { q: "Can I switch to annual billing later?", a: "Yes. Switch from Billing whenever you like and the 20% annual discount (two months free) applies from your next cycle." },
  { q: "How are add-ons billed?", a: "Add-ons are added or removed from inside your workspace and are prorated onto your existing subscription immediately, with no separate invoice." },
];

// Marketing-editable copy (Sanity pricingCopy singleton). Copy ONLY: prices,
// plan names, and limits stay sourced from PLANS/Stripe — the numbers a
// customer is charged must never come from a CMS. Unset fields fall back to
// the hardcoded copy, so the page is identical until marketing edits it.
interface PricingCopy {
  heroHeading?: string;
  heroSubheading?: string;
  trialNote?: string;
  faqs?: { q?: string; a?: string }[];
}
const PRICING_QUERY = `*[_type == "pricingCopy"][0]{heroHeading, heroSubheading, trialNote, faqs}`;

export default async function PublicPricingPage() {
  const cms = await sanityFetch<PricingCopy>(PRICING_QUERY, {}, { tags: ["sanity:pricingCopy"], revalidate: 3600 });
  const faqs = cms?.faqs?.filter((f): f is { q: string; a: string } => Boolean(f.q && f.a)) ?? [];
  const faqList = faqs.length ? faqs : FAQS;
  // Product + OfferCatalog structured data, generated from the same PLANS data
  // the cards render (so prices in search can't drift from what's shown).
  const APP = "https://app.jobsai.work";
  const offers: { "@type": "ListItem"; position: number; item: Record<string, unknown> }[] = [];
  let pos = 0;
  for (const p of PLANS) {
    const slug = p.name.toLowerCase();
    if (p.monthly === null) {
      offers.push({ "@type": "ListItem", position: ++pos, item: { "@type": "Offer", url: `${APP}/enterprise/pricing#${slug}`, name: `${p.name} Plan (custom)`, description: p.sub, availability: "https://schema.org/PreOrder", priceCurrency: "USD" } });
    } else {
      offers.push({ "@type": "ListItem", position: ++pos, item: { "@type": "Offer", url: `${APP}/enterprise/pricing#${slug}-monthly`, name: `${p.name} Plan (monthly)`, price: p.monthly, priceCurrency: "USD", availability: "https://schema.org/InStock", description: p.sub } });
      offers.push({ "@type": "ListItem", position: ++pos, item: { "@type": "Offer", url: `${APP}/enterprise/pricing#${slug}-annual`, name: `${p.name} Plan (annual)`, price: annualTotal(p.monthly), priceCurrency: "USD", availability: "https://schema.org/InStock", description: `Billed annually ($${monthlyEquiv(p.monthly)}/mo). Save 20% vs monthly.` } });
    }
  }
  const pricingLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${APP}/enterprise/pricing#product`,
    name: "JobsAI Enterprise",
    brand: { "@type": "Brand", name: "JobsAI" },
    description: "AI-powered talent acquisition operating system for sourcing, engaging, screening, interviewing, and hiring in one platform.",
    offers: { "@type": "OfferCatalog", name: "Plans", url: `${APP}/enterprise/pricing`, itemListElement: offers },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqList.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <PublicEnterpriseHeader />
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand"><Building2 className="h-6 w-6 text-white" /></div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">JobsAI Enterprise</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{cms?.heroHeading ?? "The AI-Powered Talent Acquisition Operating System"}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{cms?.heroSubheading ?? "Source. Engage. Screen. Interview. Hire. All in one platform."}</p>
        <p className="mt-1 text-sm text-muted-foreground">{cms?.trialNote ?? "All plans include a 14-day free trial."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial</Link>
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      {/* Plan cards + monthly/annual toggle */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <EnterprisePricingCards />
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <h2 className="mb-6 text-center text-2xl font-bold">Compare every plan</h2>
        <PlanComparison />
      </section>

      {/* Add-ons — outcome first, features as supporting detail */}
      <section className="border-y border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center text-2xl font-bold">Need more? Premium add-ons</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">Available on any plan. Add or remove anytime from inside your workspace, prorated automatically.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ADDONS.map((a) => (
              <div key={a.name} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <p className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-primary">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  {a.outcome}
                </p>
                <h3 className="mt-3 text-sm font-semibold">{a.name}</h3>
                <p className="mt-0.5 text-sm font-bold">{a.price}</p>
                <ul className="mt-3 space-y-1">
                  {a.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-4xl px-6 py-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Integrates with</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {INTEGRATIONS.map((i) => (
            <span key={i} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground">{i}</span>
          ))}
        </div>
      </section>

      {/* ROI calculator */}
      <section className="border-t border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold">What is JobsAI worth to your team?</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">A transparent estimate from automating sourcing, screening, and scheduling.</p>
          <RoiCalculator />
        </div>
      </section>

      {/* Why JobsAI — competitive matrix */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h2 className="mb-2 text-center text-2xl font-bold">Why JobsAI?</h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-muted-foreground">Most recruiting teams juggle separate tools for sourcing, screening, interviewing, scheduling, analytics, and compliance. JobsAI brings it all into one AI-powered platform.</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold">Capability</th>
                {COMPETITORS.map((c, i) => (
                  <th key={c} className={`px-4 py-3 text-center font-semibold ${i === 0 ? "text-primary" : ""}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETE_ROWS.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2.5 text-left text-muted-foreground">{r.label}</td>
                  {r.v.map((on, j) => (
                    <td key={j} className="px-4 py-2.5 text-center">
                      {on ? <Check className={`mx-auto h-4 w-4 ${j === 0 ? "text-primary" : "text-emerald-500"}`} /> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">Based on publicly available information, July 2026. Features and packaging change, verify details with each vendor.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {WHY.map((w) => <span key={w} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-sm"><Check className="h-3.5 w-3.5 text-emerald-500" />{w}</span>)}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/20 px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqList.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">{f.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to modernize your hiring?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Join recruiting agencies, staffing firms, and HR teams using AI to hire faster.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise-login" className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Start free trial</Link>
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-muted">Book a demo</a>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
