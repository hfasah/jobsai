import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ApplyForm from "./apply-form";

export default async function PublicApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, org_id, title, department, location, employment_type, description, responsibilities, qualifications, salary_min, salary_max, salary_currency, status")
    .eq("id", jobId)
    .eq("status", "active")
    .maybeSingle();

  if (!job) notFound();

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, logo_url, brand_color, tagline, show_powered_by, slug")
    .eq("id", job.org_id)
    .maybeSingle();

  return (
    <ApplyForm
      job={job}
      orgName={org?.name ?? "the company"}
      branding={{
        logo_url: org?.logo_url ?? null,
        brand_color: org?.brand_color ?? "#2563eb",
        tagline: org?.tagline ?? null,
        show_powered_by: org?.show_powered_by ?? true,
        slug: org?.slug ?? null,
      }}
    />
  );
}
