import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { UseCaseDetail } from "@/components/enterprise/use-case-detail";
import { PERSONAS, getPersona } from "@/lib/enterprise-personas";

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>;
}): Promise<Metadata> {
  const { persona } = await params;
  const p = getPersona(persona);
  if (!p) return { title: "Built For — JobsAI Enterprise" };
  return { title: `For ${p.name} — JobsAI Enterprise`, description: p.intro };
}

export default async function PersonaPage({
  params,
}: {
  params: Promise<{ persona: string }>;
}) {
  const { persona } = await params;
  const p = getPersona(persona);
  if (!p) notFound();

  return (
    <UseCaseDetail
      item={p}
      others={PERSONAS.filter((x) => x.slug !== p.slug)}
      basePath="/enterprise/built-for"
      eyebrow={`Built for ${p.name}`}
      othersLabel="Also built for"
    />
  );
}
