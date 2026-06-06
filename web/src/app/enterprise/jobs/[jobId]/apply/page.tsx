import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ApplyForm from "./apply-form";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export default async function PublicApplyPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, org_id, title, department, location, employment_type, description, responsibilities, qualifications, nice_to_have, salary_min, salary_max, salary_currency, status, published_at, created_at")
    .eq("id", jobId)
    .eq("status", "active")
    .maybeSingle();

  if (!job) notFound();

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, logo_url, brand_color, tagline, show_powered_by, slug, website")
    .eq("id", job.org_id)
    .maybeSingle();

  // Google for Jobs structured data — gets this role indexed into Google Jobs
  const empMap: Record<string, string> = { "full-time": "FULL_TIME", "part-time": "PART_TIME", contract: "CONTRACTOR", internship: "INTERN" };
  const descHtml = [job.description, job.responsibilities, job.qualifications, job.nice_to_have].filter(Boolean).join("<br><br>");
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: descHtml || job.title,
    datePosted: (job.published_at ?? job.created_at ?? new Date().toISOString()).slice(0, 10),
    employmentType: empMap[job.employment_type] ?? "FULL_TIME",
    hiringOrganization: {
      "@type": "Organization",
      name: org?.name ?? "Company",
      ...(org?.website ? { sameAs: org.website } : {}),
      ...(org?.logo_url ? { logo: org.logo_url } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: (job.location ?? "").split("·")[0].trim() || "Remote" },
    },
    ...((job.location ?? "").toLowerCase().includes("remote") ? { jobLocationType: "TELECOMMUTE" } : {}),
    ...(job.salary_min && job.salary_max ? {
      baseSalary: {
        "@type": "MonetaryAmount", currency: job.salary_currency ?? "USD",
        value: { "@type": "QuantitativeValue", minValue: job.salary_min, maxValue: job.salary_max, unitText: "YEAR" },
      },
    } : {}),
    directApply: true,
    url: `${APP_URL}/enterprise/jobs/${job.id}/apply`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
    </>
  );
}
