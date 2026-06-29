import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SoroBlog } from "@/components/marketing/soro-blog";

export const metadata: Metadata = {
  title: "Blog — JobsAI",
  description: "Practical, no-fluff articles on job search, resumes, interviews, and landing your next role — from the JobsAI team.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Blog</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Land your next role, faster</h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Practical, no-fluff articles on job search, resumes, interviews, and getting hired.
        </p>
      </section>

      {/* Soro-hosted blog */}
      <SoroBlog />

      <SiteFooter />
    </main>
  );
}
