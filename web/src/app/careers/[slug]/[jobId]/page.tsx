import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Briefcase, ArrowLeft, Building2, Clock } from "lucide-react";
import { CareerApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export default async function CareerJobPage({
  params,
}: {
  params: Promise<{ slug: string; jobId: string }>;
}) {
  const { slug, jobId } = await params;

  const [{ data: org }, { data: job }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_orgs")
      .select("id,name,slug,logo_url,brand_color,tagline,careers_intro,show_powered_by,website")
      .eq("slug", slug)
      .maybeSingle(),
    supabaseAdmin
      .from("enterprise_jobs")
      .select("id,org_id,title,department,location,employment_type,description,responsibilities,qualifications,salary_min,salary_max,salary_currency,status")
      .eq("id", jobId)
      .maybeSingle(),
  ]);

  if (!org || !job || job.org_id !== org.id || job.status !== "active") notFound();

  const brand = (org.brand_color as string) || "#2563eb";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Topbar */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href={`/careers/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            All openings
          </Link>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-7 object-contain" />
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: brand }}>
              <Building2 className="h-4 w-4" />
              {org.name}
            </div>
          )}
          <a
            href="#apply"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: brand }}
          >
            Apply now
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-slate-100 px-4 py-10 sm:px-6 text-center" style={{ background: `linear-gradient(180deg, ${brand}12, transparent)` }}>
        <p className="mb-2 text-sm font-semibold" style={{ color: brand }}>{org.name}</p>
        <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>
          )}
          <span className="flex items-center gap-1.5 capitalize"><Briefcase className="h-4 w-4" />{job.employment_type}</span>
          {job.department && (
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{job.department}</span>
          )}
          {job.salary_min && job.salary_max && (
            <span className="font-medium text-slate-700">
              {job.salary_currency} {(job.salary_min as number).toLocaleString()}–{(job.salary_max as number).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Left — job details */}
          <div className="lg:col-span-3 space-y-6">
            {job.description && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">About the role</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{job.description}</p>
              </section>
            )}
            {job.responsibilities && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Responsibilities</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{job.responsibilities}</p>
              </section>
            )}
            {job.qualifications && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Requirements</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{job.qualifications}</p>
              </section>
            )}
          </div>

          {/* Right — apply form */}
          <div id="apply" className="lg:col-span-2">
            <div className="sticky top-20">
              <CareerApplyForm
                jobId={job.id}
                jobTitle={job.title}
                orgName={org.name}
                brand={brand}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <Link href={`/careers/${slug}`} className="font-medium hover:underline" style={{ color: brand }}>
          View all {org.name} openings →
        </Link>
        {org.show_powered_by !== false && (
          <p className="mt-2">
            Powered by <a href="https://jobsai.work" target="_blank" rel="noopener noreferrer" className="hover:underline">JobsAI.Work</a>
          </p>
        )}
      </footer>
    </div>
  );
}
