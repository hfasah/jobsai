import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SoroBlog } from "@/components/marketing/soro-blog";

export const metadata: Metadata = {
  title: "Blog — JobsAI",
  description: "Practical, no-fluff articles on job search, resumes, interviews, and landing your next role — from the JobsAI team.",
};

// The blog is hosted by Soro, which renders the article into the embed based on
// the URL, so every /blog/* path serves the same embed and Soro routes it.
export default function BlogPostPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <SoroBlog />
      <SiteFooter />
    </main>
  );
}
