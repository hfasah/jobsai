import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { ROLES, rolesByCategory } from "@/lib/interview-questions";

export const metadata: Metadata = {
  title: "Interview Questions by Role | JobsAI Enterprise",
  description: "Free, ready-to-use interview questions for every role — screening, technical, behavioral, and situational — plus AI screening to run them automatically.",
  alternates: { canonical: "/enterprise/resources/interview-questions" },
};

export default function InterviewQuestionsIndex() {
  const groups = rolesByCategory();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <Link href="/enterprise/resources" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Resources
        </Link>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Interview questions by role</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Ready-to-use screening, technical, behavioral, and situational questions for {ROLES.length}+ roles — free for your hiring team. Want them asked and scored automatically? JobsAI runs AI phone screens for you.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="space-y-10">
          {groups.map((g) => (
            <div key={g.category}>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.category}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.roles.map((r) => (
                  <Link key={r.slug} href={`/enterprise/resources/interview-questions/${r.slug}`}
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
                    <h3 className="flex items-center justify-between font-bold">{r.title} <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.blurb}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 text-center sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">Don&apos;t just ask — auto-screen</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">JobsAI&apos;s AI phone screens ask role-specific questions, score every answer, and rank candidates so your team meets only the best.</p>
          <Link href="/enterprise/demo" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow">Book a demo <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
