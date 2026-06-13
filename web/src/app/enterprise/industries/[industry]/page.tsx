import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UseCaseDetail } from "@/components/enterprise/use-case-detail";
import { INDUSTRIES, getIndustry } from "@/lib/enterprise-personas";

export function generateStaticParams() {
  return INDUSTRIES.map((p) => ({ industry: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ industry: string }>;
}): Promise<Metadata> {
  const { industry } = await params;
  const p = getIndustry(industry);
  if (!p) return { title: "Industries — JobsAI Enterprise" };
  return { title: `${p.name} — JobsAI Enterprise`, description: p.intro };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ industry: string }>;
}) {
  const { industry } = await params;
  const p = getIndustry(industry);
  if (!p) notFound();

  return (
    <UseCaseDetail
      item={p}
      others={INDUSTRIES.filter((x) => x.slug !== p.slug)}
      basePath="/enterprise/industries"
      eyebrow={`For ${p.name}`}
      othersLabel="More industries"
    />
  );
}
