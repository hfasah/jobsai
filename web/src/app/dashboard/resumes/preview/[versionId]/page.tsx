import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ResumePreviewClient } from "@/components/resume/resume-preview-client";
import type { ResumeData } from "@/components/resume/resume-preview-client";
import type { ParsedJson, ParsedExperience } from "@/types/resume";

type ExpWithBullets = ParsedExperience & { bullets?: string[] };

function bulletsFrom(e: ExpWithBullets): string[] {
  if (e.bullets?.length) return e.bullets;
  if (e.description) {
    return e.description.split("\n").map((l) => l.replace(/^[•\-\s]+/, "").trim()).filter(Boolean);
  }
  return [];
}

export default async function ResumeVersionPreviewPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;
  const { userId } = await auth();
  if (!userId) notFound();

  // Verify ownership: version → document → user.
  const { data: ver } = await supabaseAdmin
    .from("resume_versions")
    .select("document_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!ver) notFound();

  const { data: doc } = await supabaseAdmin
    .from("resume_documents")
    .select("user_id")
    .eq("id", ver.document_id)
    .maybeSingle();
  if (!doc || doc.user_id !== userId) notFound();

  const { data: prof } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("full_name, email, phone, location, links, parsed_json")
    .eq("version_id", versionId)
    .maybeSingle();
  if (!prof) notFound();

  const pj = (prof.parsed_json ?? {}) as ParsedJson;
  const links = (prof.links ?? pj.links ?? {}) as Record<string, string>;

  const data: ResumeData = {
    name: prof.full_name ?? pj.name ?? "",
    headline: pj.headline ?? "",
    summary: pj.summary ?? "",
    contactParts: [prof.email ?? pj.email, prof.phone ?? pj.phone, prof.location ?? pj.location].filter(Boolean) as string[],
    linkParts: Object.entries(links).filter(([, v]) => v).map(([label, url]) => ({ label, url })),
    experience: (pj.experience ?? []).map((e) => ({
      title: e.title,
      company: e.company,
      start_date: e.start_date,
      end_date: e.end_date,
      is_current: e.is_current,
      bullets: bulletsFrom(e as ExpWithBullets),
    })),
    education: (pj.education ?? []).map((ed) => ({
      school: ed.school,
      degree: ed.degree,
      field_of_study: ed.field_of_study,
      start_date: ed.start_date,
      end_date: ed.end_date,
    })),
    skills: (pj.skills ?? []).map((s) => s.skill),
  };

  return <ResumePreviewClient backHref="/dashboard/resumes" data={data} />;
}
