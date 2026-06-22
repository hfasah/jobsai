import Link from "next/link";
import {
  ShieldCheck, Lock, KeyRound, ScrollText, Database, Server, Globe,
  FileText, UserCheck, Trash2, ArrowRight, Check, CircleDot,
} from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";

export const metadata = {
  title: "Security & trust — how JobsAI Enterprise guards data",
  description: "How JobsAI Enterprise protects your data: encryption, access control, audit logs, retention, GDPR data-subject requests, and the infrastructure we run on.",
};

const CONTACT = "/enterprise/contact";

// Real, shipped controls — described plainly, no badges we haven't earned.
const CONTROLS = [
  {
    icon: Lock,
    title: "Encryption everywhere",
    body: "All data is encrypted in transit with TLS 1.2+ and at rest with AES-256 on our managed database. Secrets and API keys are stored encrypted, never in plaintext.",
  },
  {
    icon: KeyRound,
    title: "Access control & RBAC",
    body: "Authentication runs through Clerk with MFA support. Role-based access control enforces least privilege across recruiters, hiring managers, and admins. SAML / SSO and advanced RBAC are available on higher plans.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    body: "Sensitive actions — logins, role changes, exports, and candidate-data access — are recorded in an audit trail your admins can review.",
  },
  {
    icon: Trash2,
    title: "Retention & legal hold",
    body: "Configurable data-retention policies automatically age out data you no longer need, with legal hold to preserve records when required.",
  },
  {
    icon: UserCheck,
    title: "GDPR data-subject requests",
    body: "Access, export, and deletion requests are handled in the Compliance Center. We act as data processor on your instructions; you remain the controller of candidate data.",
  },
  {
    icon: FileText,
    title: "DPA & clear data handling",
    body: "A Data Processing Agreement is available on request. Our privacy policy spells out exactly what we process, why, and the sub-processors involved.",
  },
];

// FAQ pairs for the FAQPage schema — answers reuse the CONTROLS copy above (the
// page's actual, vetted security statements) so structured data stays accurate.
const FAQS = [
  { q: "What encryption does JobsAI Enterprise use?", a: CONTROLS[0].body },
  { q: "How does JobsAI Enterprise manage access control?", a: CONTROLS[1].body },
  { q: "How are audit logs handled?", a: CONTROLS[2].body },
  { q: "How are data retention and legal hold managed?", a: CONTROLS[3].body },
  { q: "How are GDPR data-subject requests handled?", a: CONTROLS[4].body },
  { q: "Is a Data Processing Agreement (DPA) available?", a: CONTROLS[5].body },
  { q: "Where is JobsAI Enterprise hosted and how is compliance maintained?", a: "Hosting, database, and authentication run on Vercel, Supabase, and Clerk — all SOC 2 Type II certified. Customer data is hosted in the US (EU/other residency on request for Enterprise), with per-organization isolation and encrypted, automated backups. Our own SOC 2 is on the roadmap, not yet certified." },
];

export default function EnterpriseSecurityPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Security &amp; Trust
        </span>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Built to protect the data you trust us with
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          You&apos;re handling candidates&apos; personal data and your company&apos;s hiring decisions. Here are the actual controls behind JobsAI Enterprise — described plainly, not as badges we haven&apos;t earned.
        </p>
      </section>

      {/* Controls */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white"><c.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Infrastructure */}
      <section className="border-y border-border bg-muted/20 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Infrastructure &amp; hosting</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              JobsAI runs on enterprise-grade cloud providers that are themselves independently audited — so our foundation is SOC 2-certified even as we pursue our own certification.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Server, title: "SOC 2-certified providers", body: "Hosting, database, and authentication run on Vercel, Supabase, and Clerk — all SOC 2 Type II certified." },
              { icon: Globe, title: "US data hosting", body: "Customer data is hosted in the United States. EU / other data-residency options are available on request for Enterprise." },
              { icon: Database, title: "Isolation & backups", body: "Per-organization data isolation with managed, encrypted, automated database backups." },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></span>
                <h3 className="mt-3 font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honest compliance status */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">Where we stand on compliance</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          We&apos;d rather tell you exactly where we are than show badges we haven&apos;t earned.
        </p>
        <ul className="mt-8 space-y-3">
          {[
            { done: true, text: "GDPR-aligned data handling — controller/processor model, DPA on request, and data-subject requests fulfilled in-product." },
            { done: true, text: "Encryption at rest (AES-256) and in transit (TLS 1.2+)." },
            { done: true, text: "Built on SOC 2 Type II-certified infrastructure (Vercel, Supabase, Clerk)." },
            { done: false, text: "Our own SOC 2 (Type I) — on our roadmap; not yet certified. We'll publish a target date once the audit is scheduled." },
            { done: false, text: "Contractual uptime SLA — available on the Enterprise plan; talk to us about your requirements." },
          ].map((row) => (
            <li key={row.text} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
              {row.done
                ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
              <span className={row.done ? "" : "text-muted-foreground"}>{row.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight">Need our DPA, sub-processor list, or a security review?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            We&apos;re happy to walk your security and legal teams through our controls and share documentation.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={CONTACT} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-7 py-3 text-sm font-semibold text-white shadow-glow">
              Contact our team <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/enterprise/privacy" className="rounded-xl border border-border bg-card px-7 py-3 text-sm font-semibold hover:bg-muted">
              Read the privacy policy
            </Link>
          </div>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
