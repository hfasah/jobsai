import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Briefcase, ArrowRight, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id,name,slug,logo_url,brand_color,tagline,careers_intro,show_powered_by,website,cover_image_url,culture_text,benefits,social_links")
    .eq("slug", slug)
    .maybeSingle();

  if (!org) notFound();

  const { data: jobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id,title,department,location,employment_type,salary_min,salary_max,salary_currency")
    .eq("org_id", org.id)
    .eq("status", "active")
    .eq("is_intake_pool", false) // never expose the internal General Applications pool
    .order("created_at", { ascending: false });

  const brand = (org.brand_color as string) || "#2563eb";
  const list = jobs ?? [];
  const benefits: string[] = Array.isArray(org.benefits) ? (org.benefits as string[]) : [];
  const socialLinks: Record<string, string> = (org.social_links as Record<string, string>) ?? {};

  // group by department
  const byDept: Record<string, typeof list> = {};
  for (const j of list) {
    const d = j.department ?? "Other";
    (byDept[d] ??= []).push(j);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Cover image hero */}
      {org.cover_image_url ? (
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <img src={org.cover_image_url as string} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${brand}33, ${brand}99)` }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="mb-3 h-12 object-contain drop-shadow-lg" />
            ) : (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white drop-shadow-md">{org.name}</h1>
            {org.tagline && <p className="mt-1 text-white/90 drop-shadow">{org.tagline}</p>}
          </div>
        </div>
      ) : (
        <header className="border-b border-slate-200" style={{ background: `linear-gradient(180deg, ${brand}0d, transparent)` }}>
          <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="mx-auto mb-4 h-14 object-contain" />
            ) : (
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: brand }}>
                <Building2 className="h-7 w-7 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
            {org.tagline && <p className="mt-2 text-lg" style={{ color: brand }}>{org.tagline}</p>}
          </div>
        </header>
      )}

      {/* Intro text */}
      {(org.careers_intro || org.cover_image_url) && (
        <div className="border-b border-slate-100 bg-white px-4 py-8 text-center sm:px-6">
          {org.cover_image_url && (
            <div className="mx-auto mb-4">
              {!org.logo_url ? null : (
                <img src={org.logo_url} alt={org.name} className="mx-auto mb-3 h-10 object-contain" />
              )}
              <h1 className="text-2xl font-bold">{org.name}</h1>
              {org.tagline && <p className="mt-1 text-base" style={{ color: brand }}>{org.tagline}</p>}
            </div>
          )}
          <p className="mx-auto max-w-xl text-slate-600">
            {org.careers_intro ?? `Open roles at ${org.name}. Join our team.`}
          </p>
        </div>
      )}

      {/* Culture section */}
      {org.culture_text && (
        <section className="border-b border-slate-100 px-4 py-10 sm:px-6" style={{ background: `${brand}08` }}>
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 text-xl font-bold">Why work here</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-slate-600">{org.culture_text as string}</p>
          </div>
        </section>
      )}

      {/* Benefits */}
      {benefits.length > 0 && (
        <section className="border-b border-slate-100 px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-xl font-bold">Perks & benefits</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: brand }}>
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><path d="M6.5 12L2 7.5l1.4-1.4 3.1 3.1 6.1-6.1L14 4.4z"/></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Jobs */}
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-slate-500">
            No open positions right now. Check back soon.
          </div>
        ) : (
          <div className="space-y-8">
            <p className="text-sm text-slate-500">{list.length} open {list.length === 1 ? "position" : "positions"}</p>
            {Object.entries(byDept).map(([dept, deptJobs]) => (
              <section key={dept}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{dept}</h2>
                <div className="space-y-3">
                  {deptJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/careers/${slug}/${job.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold group-hover:underline">{job.title}</p>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                          <span className="flex items-center gap-1 capitalize"><Briefcase className="h-3.5 w-3.5" />{job.employment_type}</span>
                          {job.salary_min && job.salary_max && (
                            <span>${(job.salary_min as number).toLocaleString()}–${(job.salary_max as number).toLocaleString()} {job.salary_currency}</span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: brand }}>
                        View <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center">
        {/* Social links */}
        {Object.keys(socialLinks).length > 0 && (
          <div className="mb-4 flex items-center justify-center gap-3">
            {Object.entries(socialLinks).map(([platform, url]) => url ? (
              <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 capitalize hover:border-slate-300 hover:bg-slate-50">
                {platform}
              </a>
            ) : null)}
          </div>
        )}
        {org.website && (
          <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium" style={{ color: brand }}>
            {org.name} website →
          </a>
        )}
        {org.show_powered_by !== false && (
          <p className="mt-2 text-xs text-slate-400">
            Powered by <a href="https://jobsai.work" target="_blank" rel="noopener noreferrer" className="hover:underline">JobsAI.Work</a>
          </p>
        )}
      </footer>
    </div>
  );
}
