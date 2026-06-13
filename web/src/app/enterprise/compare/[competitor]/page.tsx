import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ComparisonDetail } from "@/components/enterprise/comparison-detail";
import { COMPARISONS, getComparison } from "@/lib/enterprise-comparisons";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ competitor: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>;
}): Promise<Metadata> {
  const { competitor } = await params;
  const c = getComparison(competitor);
  if (!c) return { title: "Compare — JobsAI Enterprise" };
  return {
    title: `${c.headline} — JobsAI Enterprise`,
    description: c.intro,
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ competitor: string }>;
}) {
  const { competitor } = await params;
  const c = getComparison(competitor);
  if (!c) notFound();

  return <ComparisonDetail item={c} others={COMPARISONS.filter((x) => x.slug !== c.slug)} />;
}
