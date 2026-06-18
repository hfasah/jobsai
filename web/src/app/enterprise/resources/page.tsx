import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { ROLES } from "@/lib/interview-questions";

export const metadata: Metadata = {
  title: "Recruiting Resources | JobsAI Enterprise",
  description: "Free recruiting resources — interview questions by role and more — from the JobsAI Enterprise team.",
  alternates: { canonical: "/enterprise/resources" },
};

const HUBS = [
  {
    icon: MessagesSquare,
    title: "Interview questions by role",
    desc: `Screening, technical, behavioral, and situational questions for ${ROLES.length}+ roles.`,
    href: "/enterprise/resources/interview-questions",
    cta: "Browse questions",
  },
];

export default function ResourcesIndex() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Resources</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Free recruiting resources</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Practical, ready-to-use tools for hiring teams — built by the JobsAI Enterprise team.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HUBS.map((h) => (
            <Link key={h.href} href={h.href} className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white"><h.icon className="h-5 w-5" /></span>
              <h2 className="mt-4 font-bold">{h.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.desc}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">{h.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
