"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ResumeData {
  name: string;
  headline: string;
  summary: string;
  contactParts: string[];
  linkParts: { label: string; url: string }[];
  experience: {
    title: string;
    company: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
    bullets: string[];
  }[];
  education: {
    school: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
  }[];
  skills: string[];
}

export type TemplateId = "modern" | "minimal" | "classic" | "executive";

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "modern",    label: "Modern"    },
  { id: "minimal",   label: "Minimal"   },
  { id: "classic",   label: "Classic"   },
  { id: "executive", label: "Executive" },
];

// ─── Shared helper ────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const [y, m] = d.split("-");
  if (!m) return y;
  const monthName = new Date(`${y}-${m}-01`).toLocaleDateString("en-US", { month: "short" });
  return `${monthName} ${y}`;
}

function dateRange(exp: { start_date?: string | null; end_date?: string | null; is_current?: boolean }): string {
  const start = fmtDate(exp.start_date);
  const end = exp.is_current ? "Present" : fmtDate(exp.end_date);
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

// ─── Template: Modern ─────────────────────────────────────────────────────────

function TemplateModern({ d }: { d: ResumeData }) {
  return (
    <main className="resume-page mx-auto max-w-[820px] bg-white px-12 pb-16 pt-6 text-[#1a1a1a]">
      <header className="mb-6 border-b border-[#d0d0d0] pb-5">
        {d.name && <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>{d.name}</h1>}
        {d.headline && <p style={{ marginTop: 4, fontSize: 15, fontWeight: 500, color: "#444" }}>{d.headline}</p>}
        {(d.contactParts.length > 0 || d.linkParts.length > 0) && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 13, color: "#555" }}>
            {d.contactParts.map((c, i) => <span key={i}>{c}</span>)}
            {d.linkParts.map(({ label, url }) => (
              <a key={label} href={url} style={{ color: "#2b4dbf", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        )}
      </header>

      {d.summary && (
        <section className="mb-section">
          <h2 className="modern-heading">Summary</h2>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "#333" }}>{d.summary}</p>
        </section>
      )}

      {d.experience.length > 0 && (
        <section className="mb-section">
          <h2 className="modern-heading">Experience</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {d.experience.map((exp, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{exp.title}</p>
                    <p style={{ fontSize: 13, color: "#555", marginTop: 1 }}>{exp.company}</p>
                  </div>
                  {dateRange(exp) && <p style={{ fontSize: 12, color: "#777", flexShrink: 0 }}>{dateRange(exp)}</p>}
                </div>
                {exp.bullets.length > 0 && (
                  <ul style={{ marginTop: 6, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                    {exp.bullets.map((b, j) => (
                      <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: "#333", listStyleType: "disc" }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.education.length > 0 && (
        <section className="mb-section">
          <h2 className="modern-heading">Education</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.education.map((edu, i) => {
              const deg = [edu.degree, edu.field_of_study].filter(Boolean).join(", ");
              const dr = [fmtDate(edu.start_date), fmtDate(edu.end_date)].filter(Boolean).join(" – ");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{edu.school}</p>
                    {deg && <p style={{ fontSize: 13, color: "#555", marginTop: 1 }}>{deg}</p>}
                  </div>
                  {dr && <p style={{ fontSize: 12, color: "#777", flexShrink: 0 }}>{dr}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.skills.length > 0 && (
        <section>
          <h2 className="modern-heading">Skills</h2>
          <p style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>{d.skills.join(" · ")}</p>
        </section>
      )}

      <style>{`
        .modern-heading {
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: #999;
          border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 10px;
        }
        .mb-section { margin-bottom: 20px; }
      `}</style>
    </main>
  );
}

// ─── Template: Minimal ────────────────────────────────────────────────────────

function TemplateMinimal({ d }: { d: ResumeData }) {
  return (
    <main className="resume-page mx-auto max-w-[780px] bg-white px-14 pb-16 pt-6 text-[#111]">
      <header style={{ marginBottom: 28 }}>
        {d.name && <h1 style={{ fontSize: 30, fontWeight: 700, color: "#111" }}>{d.name}</h1>}
        {d.headline && <p style={{ marginTop: 3, fontSize: 14, color: "#666" }}>{d.headline}</p>}
        {(d.contactParts.length > 0 || d.linkParts.length > 0) && (
          <p style={{ marginTop: 6, fontSize: 12, color: "#888", display: "flex", flexWrap: "wrap", gap: "0 12px" }}>
            {d.contactParts.map((c, i) => <span key={i}>{c}</span>)}
            {d.linkParts.map(({ label, url }) => (
              <a key={label} href={url} style={{ color: "#555", textDecoration: "none" }}>{label}</a>
            ))}
          </p>
        )}
      </header>

      {d.summary && (
        <section style={{ marginBottom: 22 }}>
          <h2 className="min-heading">Summary</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{d.summary}</p>
        </section>
      )}

      {d.experience.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 className="min-heading">Experience</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {d.experience.map((exp, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{exp.title}</span>
                    <span style={{ color: "#888", fontSize: 13, margin: "0 6px" }}>—</span>
                    <span style={{ fontSize: 13, color: "#555" }}>{exp.company}</span>
                  </div>
                  {dateRange(exp) && <p style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>{dateRange(exp)}</p>}
                </div>
                {exp.bullets.length > 0 && (
                  <ul style={{ marginTop: 5, paddingLeft: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    {exp.bullets.map((b, j) => (
                      <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: "#444", listStyleType: "disc" }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.education.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <h2 className="min-heading">Education</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.education.map((edu, i) => {
              const deg = [edu.degree, edu.field_of_study].filter(Boolean).join(", ");
              const dr = [fmtDate(edu.start_date), fmtDate(edu.end_date)].filter(Boolean).join(" – ");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{edu.school}</span>
                    {deg && <span style={{ fontSize: 13, color: "#666", marginLeft: 6 }}>{deg}</span>}
                  </div>
                  {dr && <p style={{ fontSize: 12, color: "#aaa", flexShrink: 0 }}>{dr}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.skills.length > 0 && (
        <section>
          <h2 className="min-heading">Skills</h2>
          <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>{d.skills.join(", ")}</p>
        </section>
      )}

      <style>{`
        .min-heading {
          font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
          text-transform: uppercase; color: #bbb; margin-bottom: 8px;
        }
      `}</style>
    </main>
  );
}

// ─── Template: Classic ────────────────────────────────────────────────────────

function TemplateClassic({ d }: { d: ResumeData }) {
  return (
    <main className="resume-page mx-auto max-w-[820px] bg-white px-12 pb-16 pt-6 text-[#111]">
      {/* Centered header */}
      <header style={{ textAlign: "center", paddingBottom: 16, marginBottom: 20, borderBottom: "2px solid #111" }}>
        {d.name && (
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{d.name}</h1>
        )}
        {d.headline && (
          <p style={{ marginTop: 3, fontSize: 13, fontStyle: "italic", color: "#555" }}>{d.headline}</p>
        )}
        {(d.contactParts.length > 0 || d.linkParts.length > 0) && (
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2px 16px", fontSize: 12, color: "#555" }}>
            {d.contactParts.map((c, i) => <span key={i}>{c}</span>)}
            {d.linkParts.map(({ label, url }) => (
              <a key={label} href={url} style={{ color: "#1a3a8f", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        )}
      </header>

      {d.summary && (
        <section style={{ marginBottom: 18 }}>
          <h2 className="classic-heading">Professional Summary</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#333" }}>{d.summary}</p>
        </section>
      )}

      {d.experience.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 className="classic-heading">Professional Experience</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {d.experience.map((exp, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{exp.title}</p>
                  {dateRange(exp) && (
                    <p style={{ fontSize: 12, color: "#666", flexShrink: 0, fontStyle: "italic" }}>{dateRange(exp)}</p>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#555", marginTop: 1, fontStyle: "italic" }}>{exp.company}</p>
                {exp.bullets.length > 0 && (
                  <ul style={{ marginTop: 5, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                    {exp.bullets.map((b, j) => (
                      <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: "#333", listStyleType: "disc" }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.education.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h2 className="classic-heading">Education</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {d.education.map((edu, i) => {
              const deg = [edu.degree, edu.field_of_study].filter(Boolean).join(", ");
              const dr = [fmtDate(edu.start_date), fmtDate(edu.end_date)].filter(Boolean).join(" – ");
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{edu.school}</p>
                    {deg && <p style={{ fontSize: 13, color: "#555", marginTop: 1, fontStyle: "italic" }}>{deg}</p>}
                  </div>
                  {dr && <p style={{ fontSize: 12, color: "#666", flexShrink: 0, fontStyle: "italic" }}>{dr}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.skills.length > 0 && (
        <section>
          <h2 className="classic-heading">Core Competencies</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 6px" }}>
            {d.skills.map((s, i) => (
              <span key={i} style={{ fontSize: 12, border: "1px solid #ccc", borderRadius: 3, padding: "2px 7px", color: "#333" }}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .classic-heading {
          font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: #111;
          border-left: 3px solid #1a3a8f; padding-left: 8px;
          margin-bottom: 10px;
        }
      `}</style>
    </main>
  );
}

// ─── Template: Executive ──────────────────────────────────────────────────────

function TemplateExecutive({ d }: { d: ResumeData }) {
  const accent = "#1e3a5f";
  return (
    <main className="resume-page mx-auto max-w-[820px] bg-white pb-16 text-[#1a1a1a]">
      {/* Dark header band */}
      <header style={{ background: accent, color: "white", padding: "28px 48px 22px" }}>
        {d.name && (
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.02em", color: "white" }}>{d.name}</h1>
        )}
        {d.headline && (
          <p style={{ marginTop: 4, fontSize: 13.5, color: "#afc8e8", fontWeight: 400 }}>{d.headline}</p>
        )}
        {(d.contactParts.length > 0 || d.linkParts.length > 0) && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "3px 16px", fontSize: 12, color: "#c8dff0" }}>
            {d.contactParts.map((c, i) => <span key={i}>{c}</span>)}
            {d.linkParts.map(({ label, url }) => (
              <a key={label} href={url} style={{ color: "#9bc4e8", textDecoration: "none" }}>{label}</a>
            ))}
          </div>
        )}
      </header>

      <div style={{ padding: "22px 48px 0" }}>
        {d.summary && (
          <section style={{ marginBottom: 20 }}>
            <h2 className="exec-heading">Executive Summary</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#333" }}>{d.summary}</p>
          </section>
        )}

        {d.experience.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 className="exec-heading">Experience</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {d.experience.map((exp, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>{exp.title}</p>
                      <p style={{ fontSize: 13, color: "#555", marginTop: 1 }}>{exp.company}</p>
                    </div>
                    {dateRange(exp) && (
                      <p style={{ fontSize: 12, color: "#888", flexShrink: 0, fontWeight: 500 }}>{dateRange(exp)}</p>
                    )}
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul style={{ marginTop: 6, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                      {exp.bullets.map((b, j) => (
                        <li key={j} style={{ fontSize: 13, lineHeight: 1.6, color: "#333", listStyleType: "disc" }}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {d.education.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 className="exec-heading">Education</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {d.education.map((edu, i) => {
                const deg = [edu.degree, edu.field_of_study].filter(Boolean).join(", ");
                const dr = [fmtDate(edu.start_date), fmtDate(edu.end_date)].filter(Boolean).join(" – ");
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{edu.school}</p>
                      {deg && <p style={{ fontSize: 13, color: "#555", marginTop: 1 }}>{deg}</p>}
                    </div>
                    {dr && <p style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>{dr}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {d.skills.length > 0 && (
          <section>
            <h2 className="exec-heading">Core Skills</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 8px" }}>
              {d.skills.map((s, i) => (
                <span key={i} style={{
                  fontSize: 12, background: "#f0f4f8", borderRadius: 4,
                  padding: "3px 9px", color: "#1e3a5f", fontWeight: 500,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .exec-heading {
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: ${accent};
          border-bottom: 2px solid ${accent}; padding-bottom: 5px; margin-bottom: 12px;
        }
      `}</style>
    </main>
  );
}

// ─── Template renderer ────────────────────────────────────────────────────────

function ResumeTemplate({ id, data }: { id: TemplateId; data: ResumeData }) {
  if (id === "minimal")   return <TemplateMinimal d={data} />;
  if (id === "classic")   return <TemplateClassic d={data} />;
  if (id === "executive") return <TemplateExecutive d={data} />;
  return <TemplateModern d={data} />;
}

// ─── Main client component ────────────────────────────────────────────────────

export function ResumePreviewClient({
  jobId,
  data,
  hideToolbar = false,
}: {
  jobId: string;
  data: ResumeData;
  hideToolbar?: boolean;
}) {
  const [template, setTemplate] = useState<TemplateId>("modern");

  return (
    <>
      {/* Toolbar — hidden when embedded */}
      {!hideToolbar && (
      <div className="no-print fixed inset-x-0 top-0 z-50 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur-sm sm:px-6">
        <Link
          href={`/dashboard/jobs/${jobId}`}
          className="shrink-0 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </Link>

        {/* Template picker */}
        <div className="flex flex-1 items-center justify-center gap-1 overflow-x-auto">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                template === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button size="sm" className="shrink-0" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>
      )}

      {/* Spacer for fixed toolbar — only when toolbar is shown */}
      {!hideToolbar && <div style={{ height: 50 }} />}

      {/* Embedded template switcher */}
      {hideToolbar && (
        <div className="no-print flex flex-wrap gap-1 border-b border-border bg-muted/30 px-4 py-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                template === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Resume */}
      <ResumeTemplate id={template} data={data} />

      <style>{`
        .resume-page { font-family: 'Georgia', serif; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .resume-page {
            max-width: 100% !important;
            padding-top: 16px !important;
            margin: 0 !important;
          }
          @page { margin: 14mm 12mm; size: letter; }
        }
      `}</style>
    </>
  );
}
