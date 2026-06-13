import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Rocket } from "lucide-react";
import { GuideLayout } from "@/components/enterprise/guide-layout";
import { GUIDE, getGuideArticle } from "@/lib/enterprise-guide";

export const metadata: Metadata = {
  title: "Guide — JobsAI Enterprise",
  description:
    "How-to guides for JobsAI Enterprise — set up your workspace, source and screen candidates, run outreach campaigns, interview, and hire.",
};

export default function GuideIndexPage() {
  const gettingStarted = getGuideArticle("welcome");

  return (
    <GuideLayout>
      {/* Hero */}
      <header>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <BookOpen className="h-3.5 w-3.5" /> Guide
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">JobsAI Enterprise Guide</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Everything you need to get the most out of JobsAI Enterprise — from setting up your workspace
          to sourcing, screening, interviewing, and hiring. Pick a topic, or start at the beginning.
        </p>
        {gettingStarted && (
          <Link
            href="/enterprise/guide/welcome"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
          >
            <Rocket className="h-4 w-4" /> Start with the basics <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </header>

      {/* Category sections */}
      <div className="mt-12 space-y-10">
        {GUIDE.map((category) => (
          <section key={category.id}>
            <h2 className="text-xl font-bold tracking-tight">{category.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {category.articles.map((a) => (
                <Link
                  key={a.slug}
                  href={`/enterprise/guide/${a.slug}`}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span className="text-xl">{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block font-medium group-hover:text-primary">{a.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{a.summary}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </GuideLayout>
  );
}
