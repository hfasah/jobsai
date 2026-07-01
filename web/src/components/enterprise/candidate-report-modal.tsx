"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, Sparkles, FileText, ClipboardList, CheckCircle2,
  AlertCircle, Copy, Check, ChevronDown, UserCheck, Mic,
  Mail, Phone, Globe, FileUser, ExternalLink, Printer, Download, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildInterviewReportHtml } from "@/lib/interview-report-html";
import type { InterviewReport, CompetencyScore } from "@/types/interview-intelligence";
import { RECOMMENDATION_META } from "@/types/interview-intelligence";
import type { AIRecommendation, EnterpriseApplication } from "@/types/enterprise";

const SCORE_COLOR = (n: number) => n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";
const BAR_COLOR = (n: number) => n >= 75 ? "bg-green-500" : n >= 50 ? "bg-amber-500" : "bg-red-500";

function ScorePill({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border px-2.5 py-1", muted && "opacity-70")}>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("ml-1.5 text-sm font-bold tabular-nums", SCORE_COLOR(value))}>{value}</span>
    </div>
  );
}

function CompetencyBar({ c }: { c: CompetencyScore }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{c.name} <span className="text-muted-foreground">· {c.weight}%</span></span>
        <span className={cn("font-bold tabular-nums", SCORE_COLOR(c.score))}>{c.score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-full rounded-full", BAR_COLOR(c.score))} style={{ width: `${c.score}%` }} />
      </div>
      {c.evidence && <p className="mt-1 text-[11px] text-muted-foreground italic leading-snug">{c.evidence}</p>}
    </div>
  );
}

function ReportCard({ report, app, jobId, orgBrand }: { report: InterviewReport; app: EnterpriseApplication; jobId: string; orgBrand: { name: string; showPoweredBy: boolean } }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [team, setTeam] = useState<{ email: string; name: string; role: string }[] | null>(null);
  const [sending, setSending] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const rec = report.recommendation ? RECOMMENDATION_META[report.recommendation as AIRecommendation] : null;

  const reportHtml = () => buildInterviewReportHtml({
    report,
    candidateName: app.candidate_name,
    candidateEmail: app.candidate_email,
    jobTitle: (app as unknown as { job?: { title?: string } }).job?.title ?? null,
    orgName: orgBrand.name || null,
    showPoweredBy: orgBrand.showPoweredBy,
  });
  const slug = (app.candidate_name || "candidate").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "candidate";

  // Print → the browser's "Save as PDF" is the reliable, dependency-free path.
  const printReport = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(reportHtml());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  // Download as a Word-openable .doc (HTML with the Word MIME type).
  const downloadDoc = () => {
    const blob = new Blob([reportHtml()], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Interview-Report-${slug}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEmail = () => {
    setEmailOpen((o) => !o); setEmailMsg(null);
    if (team === null) {
      fetch("/api/enterprise/team").then((r) => r.json()).then((j) => {
        const members = (j.data?.members ?? []).filter((m: { email?: string }) => m.email);
        setTeam(members.map((m: { email: string; name: string; role: string }) => ({ email: m.email, name: m.name, role: m.role })));
      }).catch(() => setTeam([]));
    }
  };

  const sendEmail = async () => {
    const to = recipient.trim();
    if (!to) return;
    setSending(true); setEmailMsg(null);
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${app.id}/report/email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: report.id, recipients: [to] }),
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) { setEmailMsg(`Sent to ${to}.`); setRecipient(""); setTimeout(() => setEmailOpen(false), 1500); }
    else setEmailMsg(j.error ?? "Couldn't send.");
  };

  const copyText = () => {
    const text = `${report.report_type === "pre_interview" ? "PRE-INTERVIEW BRIEFING" : "INTERVIEW REPORT"} — ${report.round_name ?? ""}
Overall: ${report.overall_score}/100 · Recommendation: ${rec?.label ?? "—"}

SUMMARY
${report.summary ?? ""}

COMPETENCIES
${report.competency_scores.map((c) => `• ${c.name} (${c.weight}%): ${c.score}/100 — ${c.evidence}`).join("\n")}

STRENGTHS
${report.strengths.map((s) => `• ${s}`).join("\n")}

CONCERNS
${report.concerns.map((s) => `• ${s}`).join("\n")}`;
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2.5">
          {report.report_type === "pre_interview"
            ? <UserCheck className="h-4 w-4 text-blue-400" />
            : <Mic className="h-4 w-4 text-purple-400" />}
          <div className="text-left">
            <p className="text-sm font-medium">
              {report.report_type === "pre_interview" ? "Pre-interview briefing" : report.round_name ?? "Interview report"}
            </p>
            <p className="text-[11px] text-muted-foreground">{new Date(report.generated_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report.overall_score !== null && (
            <span className={cn("text-lg font-bold tabular-nums", SCORE_COLOR(report.overall_score))}>{report.overall_score}</span>
          )}
          {rec && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", rec.color)}>{rec.label}</span>}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {report.summary && (
            <div className="rounded-xl bg-background/60 px-3 py-2.5">
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </div>
          )}

          {report.competency_scores.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competency scores</p>
              {report.competency_scores.map((c, i) => <CompetencyBar key={i} c={c} />)}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {report.strengths.length > 0 && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
                </p>
                <ul className="space-y-1">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-green-400" />{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.concerns.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" /> Concerns / probe
                </p>
                <ul className="space-y-1">
                  {report.concerns.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {([
              [copied ? <Check key="c" className="h-3.5 w-3.5 text-green-400" /> : <Copy key="c" className="h-3.5 w-3.5" />, copied ? "Copied!" : "Copy", copyText],
              [<Printer key="p" className="h-3.5 w-3.5" />, "Print / PDF", printReport],
              [<Download key="d" className="h-3.5 w-3.5" />, "Download", downloadDoc],
            ] as const).map(([icon, label, fn], i) => (
              <button key={i} onClick={fn}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {icon} {label}
              </button>
            ))}
            <button onClick={openEmail}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
              <Send className="h-3.5 w-3.5" /> Email to hiring manager
            </button>
          </div>

          {emailOpen && (
            <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3">
              {team && team.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {team.map((m) => (
                    <button key={m.email} onClick={() => setRecipient(m.email)}
                      className={cn("rounded-full border px-2 py-0.5 text-[11px]", recipient === m.email ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                      {m.name} <span className="capitalize opacity-60">· {m.role.replace("_", " ")}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="hiring.manager@company.com"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
                <button onClick={sendEmail} disabled={sending || !recipient.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
                </button>
              </div>
              {emailMsg && <p className="mt-1.5 text-[11px] text-muted-foreground">{emailMsg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CandidateReportModal({
  jobId, app, hasFramework, onClose,
}: {
  jobId: string; app: EnterpriseApplication; hasFramework: boolean; onClose: () => void;
}) {
  const appId = app.id;
  const candidateName = app.candidate_name;
  const [reports, setReports] = useState<InterviewReport[]>([]);
  const [orgBrand, setOrgBrand] = useState<{ name: string; showPoweredBy: boolean }>({ name: "", showPoweredBy: true });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"pre" | "post" | null>(null);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [roundName, setRoundName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${appId}/report`);
    const json = await res.json();
    setReports(json.data ?? []);
    if (json.org) setOrgBrand({ name: json.org.name, showPoweredBy: json.org.show_powered_by });
    setLoading(false);
  }, [jobId, appId]);

  useEffect(() => { load(); }, [load]);

  const generatePre = async () => {
    setGenerating("pre"); setError("");
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${appId}/report`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_type: "pre_interview" }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Failed."); else { setReports((r) => [json.data, ...r]); }
    setGenerating(null);
  };

  const generatePost = async () => {
    if (!transcript.trim()) { setError("Paste the interview transcript first."); return; }
    setGenerating("post"); setError("");
    const res = await fetch(`/api/enterprise/jobs/${jobId}/applications/${appId}/report`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_type: "post_interview", transcript, round_name: roundName || "Interview" }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Failed.");
    else { setReports((r) => [json.data, ...r]); setTranscript(""); setRoundName(""); setShowTranscript(false); }
    setGenerating(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Interview Intelligence</h2>
              <p className="text-xs text-muted-foreground">{candidateName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Candidate snapshot: contact + scores + resume */}
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <a href={`mailto:${app.candidate_email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-3.5 w-3.5" />{app.candidate_email}</a>
              {app.candidate_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{app.candidate_phone}</span>}
              {app.linkedin_url && <a href={app.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" />LinkedIn</a>}
              {app.portfolio_url && <a href={app.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Globe className="h-3.5 w-3.5" />Portfolio</a>}
            </div>

            {/* Scores */}
            <div className="mt-3 flex flex-wrap gap-3">
              {app.match_score !== null && (
                <ScorePill label="Match" value={app.match_score} />
              )}
              {app.ats_score !== null && app.ats_score !== undefined && (
                <ScorePill label="ATS" value={app.ats_score} />
              )}
              {app.skills_score !== null && <ScorePill label="Skills" value={app.skills_score} muted />}
              {app.experience_score !== null && <ScorePill label="Experience" value={app.experience_score} muted />}
            </div>
            {app.ai_summary && <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{app.ai_summary}</p>}

            {/* Resume */}
            {(app.resume_text || app.resume_url || app.resume_storage_key) && (
              <div className="mt-3">
                <button onClick={() => setShowResume((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <FileUser className="h-3.5 w-3.5" />
                  {showResume ? "Hide resume" : "View resume"}
                  {(app.resume_storage_key || app.resume_url) && <span className="text-muted-foreground">· <a href={`/api/enterprise/inbox/applications/${app.id}/resume`} target="_blank" rel="noopener noreferrer" className="underline">download original</a></span>}
                </button>
                {showResume && app.resume_text && (
                  <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground font-sans">
                    {app.resume_text}
                  </pre>
                )}
              </div>
            )}
          </div>

          {!hasFramework && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              Generate the competency scorecard on the job&apos;s <strong>Scorecard</strong> tab first — reports score against it.
            </div>
          )}

          {/* action buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={generatePre} disabled={!hasFramework || generating !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/25 disabled:opacity-50 transition-colors">
              {generating === "pre" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Generate HR briefing
            </button>
            <button onClick={() => setShowTranscript((s) => !s)} disabled={!hasFramework}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-500/15 px-4 py-2 text-sm font-semibold text-purple-400 hover:bg-purple-500/25 disabled:opacity-50 transition-colors">
              <FileText className="h-4 w-4" /> Score a transcript
            </button>
          </div>

          {/* transcript input */}
          {showTranscript && (
            <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
              <input value={roundName} onChange={(e) => setRoundName(e.target.value)}
                placeholder="Round name (e.g. Technical Round, Final)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the interview transcript here…"
                rows={8}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
              <button onClick={generatePost} disabled={generating !== null}
                className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {generating === "post" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate scored report
              </button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* reports list */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No reports yet. Generate an HR briefing to send to the hiring manager, or score an interview transcript.
            </p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => <ReportCard key={r.id} report={r} app={app} jobId={jobId} orgBrand={orgBrand} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
