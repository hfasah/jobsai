import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { PrintButton } from "./print-button";
import type { TailoredJson } from "@/types/phase3";
import type { ParsedJson } from "@/types/resume";

export default async function ResumePreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { userId } = await auth();
  if (!userId) notFound();

  // Load tailored resume
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

  // Load parsed profile for contact info and education
  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("full_name, email, phone, location, links, parsed_json")
    .eq("version_id", tailored.source_resume_version_id)
    .maybeSingle();

  const pj = profile?.parsed_json as ParsedJson | undefined;

  const name = profile?.full_name ?? pj?.name ?? "";
  const email = profile?.email ?? pj?.email ?? "";
  const phone = profile?.phone ?? pj?.phone ?? "";
  const location = profile?.location ?? pj?.location ?? "";
  const links = (profile?.links ?? pj?.links ?? {}) as Record<string, string>;
  const headline = tj.headline ?? tailored.headline ?? pj?.headline ?? "";
  const summary = tj.summary ?? tailored.summary ?? pj?.summary ?? "";
  const education = pj?.education ?? [];
  const skills = tj.skills ?? pj?.skills?.map((s) => s.skill) ?? [];
  const experience = tj.experience ?? [];

  const contactParts = [email, phone, location].filter(Boolean);
  const linkParts = Object.entries(links)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ label: k, url: v }));

  function fmtDate(d?: string | null) {
    if (!d) return "";
    const [y, m] = d.split("-");
    if (!m) return y;
    const monthName = new Date(`${y}-${m}-01`).toLocaleDateString("en-US", { month: "short" });
    return `${monthName} ${y}`;
  }

  return (
    <>
      {/* Toolbar — hidden on print */}
      <div className="no-print fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        <Link
          href={`/dashboard/jobs/${jobId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>
        <span className="text-sm font-medium text-foreground">Resume Preview</span>
        <PrintButton />
      </div>

      {/* Resume document */}
      <main className="resume-page mx-auto max-w-[820px] bg-white px-12 pb-16 pt-20 text-[#1a1a1a]">

        {/* Header */}
        <header className="mb-6 border-b border-[#d0d0d0] pb-5">
          {name && (
            <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">{name}</h1>
          )}
          {headline && (
            <p className="mt-1 text-base font-medium text-[#444]">{headline}</p>
          )}
          {(contactParts.length > 0 || linkParts.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#555]">
              {contactParts.map((c, i) => (
                <span key={i}>{c}</span>
              ))}
              {linkParts.map(({ label, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2b4dbf] hover:underline capitalize"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </header>

        {/* Summary */}
        {summary && (
          <section className="mb-5">
            <h2 className="resume-section-heading">Summary</h2>
            <p className="text-[15px] leading-relaxed text-[#333]">{summary}</p>
          </section>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <section className="mb-5">
            <h2 className="resume-section-heading">Experience</h2>
            <div className="space-y-5">
              {experience.map((exp, i) => {
                const start = fmtDate(exp.start_date);
                const end = exp.is_current ? "Present" : fmtDate(exp.end_date);
                const dateRange = start || end ? `${start}${start && end ? " – " : ""}${end}` : "";
                return (
                  <div key={i}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[15px] text-[#1a1a1a]">{exp.title}</p>
                        <p className="text-sm text-[#555]">{exp.company}</p>
                      </div>
                      {dateRange && (
                        <p className="shrink-0 text-sm text-[#777]">{dateRange}</p>
                      )}
                    </div>
                    {exp.bullets?.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-4">
                        {exp.bullets.map((b, j) => (
                          <li key={j} className="relative text-[14px] leading-relaxed text-[#333] before:absolute before:-left-3 before:content-['•']">
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <section className="mb-5">
            <h2 className="resume-section-heading">Education</h2>
            <div className="space-y-3">
              {education.map((edu, i) => {
                const start = fmtDate(edu.start_date);
                const end = fmtDate(edu.end_date);
                const dateRange = start || end ? `${start}${start && end ? " – " : ""}${end}` : "";
                const degree = [edu.degree, edu.field_of_study].filter(Boolean).join(", ");
                return (
                  <div key={i} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[15px]">{edu.school}</p>
                      {degree && <p className="text-sm text-[#555]">{degree}</p>}
                    </div>
                    {dateRange && (
                      <p className="shrink-0 text-sm text-[#777]">{dateRange}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section>
            <h2 className="resume-section-heading">Skills</h2>
            <p className="text-[14px] text-[#333] leading-relaxed">
              {skills.join(" · ")}
            </p>
          </section>
        )}
      </main>

      <style>{`
        .resume-section-heading {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #888;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 4px;
          margin-bottom: 12px;
        }

        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .resume-page {
            max-width: 100% !important;
            padding-top: 40px !important;
            margin: 0 !important;
          }
          @page {
            margin: 18mm 15mm;
            size: letter;
          }
        }
      `}</style>
    </>
  );
}
