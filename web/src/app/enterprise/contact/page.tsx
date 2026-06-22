import Link from "next/link";
import type { Metadata } from "next";
import { Mail, MessageSquare, Clock, Phone, CalendarCheck, ArrowRight } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { EnterpriseContactForm } from "@/components/enterprise/contact-form";

export const metadata: Metadata = {
  title: "Contact JobsAI Enterprise — talk to sales or support",
  description:
    "Talk to the JobsAI Enterprise team about the platform, pricing, security, or rolling it out to your hiring team.",
};

export default function EnterpriseContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border px-4 py-16 text-center sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <MessageSquare className="h-3.5 w-3.5" /> Contact
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Let&apos;s talk about your <span className="bg-gradient-brand bg-clip-text text-transparent">hiring</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Questions about the platform, pricing, security, or rolling JobsAI Enterprise out to your team?
            Send us a message and we&apos;ll get back to you within one business day.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-3">
        {/* Info column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold">Book a live demo</h3>
            <p className="mt-1 text-sm text-muted-foreground">See the platform tailored to your hiring workflow.</p>
            <Link href="/enterprise/demo" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              Schedule a walkthrough <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold">Email us</h3>
            <p className="mt-1 text-sm text-muted-foreground">For sales, support, or partnerships.</p>
            <a href="mailto:support@jobsai.work" className="mt-2 block text-sm font-medium text-primary hover:underline">
              support@jobsai.work
            </a>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold">Call, text or WhatsApp</h3>
            <p className="mt-1 text-sm text-muted-foreground">Reach our team directly.</p>
            <a href="tel:+12895415966" className="mt-2 block text-sm font-medium text-primary hover:underline">1-289-541-5966</a>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="https://wa.me/12895415966" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a href="sms:+12895415966" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                <MessageSquare className="h-3.5 w-3.5" /> Text
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold">Response time</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We typically respond within one business day. Customers on Business and Enterprise plans get priority support.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Office location</h3>
            <a
              href="https://maps.google.com/?q=3800+Confederation+Pkwy,+Mississauga,+ON+L5B+4M6,+Canada"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm text-muted-foreground hover:text-foreground"
            >
              3800 Confederation Pkwy,<br />Mississauga, ON L5B 4M6, Canada
            </a>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2">
          <EnterpriseContactForm />
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
