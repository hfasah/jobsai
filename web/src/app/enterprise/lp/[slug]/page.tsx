import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { CmsBanner } from "@/components/enterprise/cms-banner";
import { MarketingBlocks, type MarketingBlock } from "@/components/enterprise/marketing-blocks";
import { sanityFetch } from "@/lib/sanity";

// CMS-composed campaign landing pages: marketing creates a landingPage document
// in Sanity Studio, composes it from whitelisted blocks, publishes, and it is
// live here within seconds — no deploy, no engineer. This route renders content
// only; it has no access to application data or auth beyond the shared header.

interface LandingPageDoc {
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  noIndex?: boolean;
  blocks?: MarketingBlock[];
}

const PAGE_QUERY = `*[_type == "landingPage" && slug.current == $slug][0]{
  title, seoTitle, seoDescription, noIndex, blocks
}`;

function getPage(slug: string) {
  return sanityFetch<LandingPageDoc>(PAGE_QUERY, { slug }, {
    tags: ["sanity:landingPage", `sanity:landingPage:${slug}`],
    revalidate: 3600,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.seoTitle ?? page.title ?? "JobsAI Enterprise",
    description: page.seoDescription,
    alternates: { canonical: `/enterprise/lp/${slug}` },
    ...(page.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page?.blocks?.length) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CmsBanner />
      <PublicEnterpriseHeader />
      <main>
        <MarketingBlocks blocks={page.blocks} />
      </main>
      <PublicEnterpriseFooter />
    </div>
  );
}
