import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { ResumePreviewClient } from "@/components/resume/resume-preview-client";
import type { ResumeData } from "@/components/resume/resume-preview-client";
import type { TailoredJson } from "@/types/phase3";
import type { ParsedJson } from "@/types/resume";
import { fillExperienceDates } from "@/lib/resume-dates";
import { getUserBilling } from "@/lib/billing";

export default async function ResumePreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { userId } = await auth();
  if (!userId) notFound();

  const billing = await getUserBilling(userId);
  const isPaid = billing.plan !== "free";

  const { data: tailored } = await supabaseAdmin
    .from("tailored_resumes")
    .select("tailored_json, source_resume_version_id, headline, summary")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tailored) notFound();

  const tj = tailored.tailored_json as TailoredJson;

  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("full_name, email, phone, location, links, parsed_json")
    .eq("version_id", tailored.source_resume_version_id)
    .maybeSingle();

  const pj = profile?.parsed_json as ParsedJson | undefined;

  const links = (profile?.links ?? pj?.links ?? {}) as Record<string, string>;

  const data: ResumeData = {
    name:         profile?.full_name ?? pj?.name ?? "",
    headline:     tj.headline ?? tailored.headline ?? pj?.headline ?? "",
    summary:      tj.summary  ?? tailored.summary  ?? pj?.summary  ?? "",
    contactParts: [profile?.email ?? pj?.email, profile?.phone ?? pj?.phone, profile?.location ?? pj?.location].filter(Boolean) as string[],
    linkParts:    Object.entries(links).filter(([, v]) => v).map(([k, v]) => ({ label: k, url: v })),
    experience:   fillExperienceDates(tj.experience ?? [], pj?.experience ?? []),
    education:    (pj?.education ?? []).map((e) => ({
      school:       e.school,
      degree:       e.degree,
      field_of_study: e.field_of_study,
      start_date:   e.start_date,
      end_date:     e.end_date,
    })),
    skills: tj.skills ?? pj?.skills?.map((s) => s.skill) ?? [],
  };

  return <ResumePreviewClient backHref={`/dashboard/jobs/${jobId}`} data={data} isPaid={isPaid} />;
}
