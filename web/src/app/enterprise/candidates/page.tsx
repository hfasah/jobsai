"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Loader2, ExternalLink, Send, CheckCircle2, Search, Sparkles, FileDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── All applicants (global database) ─────────────────────────────────────────

interface Applicant {
  id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  stage: string | null;
  ats_score: number | null;
  match_score: number | null;
  tags: string[] | null;
  ai_summary: string | null;
  resume_storage_key: string | null;
  resume_url: string | null;
  source: string | null;
  created_at: string;
  job: { id: string; title: string } | null;
}

const STAGE_STYLE: Record<string, string> = {
  applied: "bg-muted text-muted-foreground",
  screening: "bg-blue-500/15 text-blue-400",
  interview: "bg-purple-500/15 text-purple-400",
  offer: "bg-amber-500/15 text-amber-400",
  hired: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
};

function AllApplicants() {
  const [apps, setApps] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadAll = () => {
    setLoading(true);
    fetch("/api/enterprise/candidates")
      .then((r) => r.json())
      .then((j) => { setApps(j.data ?? []); setAiMode(false); })
      .finally(() => setLoading(false));
  };
  // Initial load — set state only in the async callback (loading starts true).
  useEffect(() => {
    fetch("/api/enterprise/candidates")
      .then((r) => r.json())
      .then((j) => { setApps(j.data ?? []); setAiMode(false); })
      .finally(() => setLoading(false));
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) { loadAll(); return; }
    setSearching(true);
    // AI skill / natural-language search across all applicants.
    const res = await fetch("/api/enterprise/candidates/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const j = await res.json();
    if (res.ok) { setApps(j.data ?? []); setAiMode(true); }
    setSearching(false);
  };

  const resumeHref = (a: Applicant) => (a.resume_storage_key || a.resume_url) ? `/api/enterprise/inbox/applications/${a.id}/resume` : null;

  return (
    <div>
      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="Search by name, email, or skills (e.g. “React + AWS, 5+ yrs”)…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <button onClick={runSearch} disabled={searching}
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Search
        </button>
        {(aiMode || query) && (
          <button onClick={() => { setQuery(""); loadAll(); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {aiMode ? "AI search results" : "All applicants"} · {apps.length}{apps.length === 300 ? "+" : ""} {apps.length === 1 ? "candidate" : "candidates"}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{aiMode ? "No matches for that search." : "No applicants yet."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Applicants appear as candidates apply, email a résumé, or you upload one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {["Candidate", "Job", "Stage", "ATS", "Skills", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apps.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">{a.candidate_email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.job ? <Link href={`/enterprise/jobs/${a.job.id}`} className="text-primary hover:underline">{a.job.title}</Link> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", STAGE_STYLE[a.stage ?? "applied"] ?? STAGE_STYLE.applied)}>{a.stage ?? "applied"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.ats_score != null
                      ? <span className={cn("font-bold tabular-nums", a.ats_score >= 70 ? "text-green-400" : a.ats_score >= 50 ? "text-amber-400" : "text-red-400")}>{a.ats_score}</span>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {(a.tags ?? []).slice(0, 4).map((t) => (
                        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
                      ))}
                      {(a.tags?.length ?? 0) === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      {resumeHref(a) && (
                        <a href={resumeHref(a)!} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" title="Download résumé">
                          <FileDown className="h-3.5 w-3.5" /> Résumé
                        </a>
                      )}
                      {a.job && (
                        <Link href={`/enterprise/jobs/${a.job.id}`} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20">
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Talent Pool (nurture) ────────────────────────────────────────────────────

interface PoolCandidate {
  id: string; candidate_name: string; candidate_email: string;
  candidate_phone: string | null; linkedin_url: string | null;
  match_score: number | null; source_job_title: string | null;
  skills_tags: string[]; notes: string | null;
  status: string; last_contacted: string | null; created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  contacted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  placed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  inactive: "bg-muted text-muted-foreground border-border",
};

function TalentPool() {
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [nurturing, setNurturing] = useState<string | null>(null);
  const [nurtureModal, setNurtureModal] = useState<PoolCandidate | null>(null);
  const [nurtureForm, setNurtureForm] = useState({ subject: "", message: "" });
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/enterprise/talent-pool")
      .then((r) => r.json())
      .then((j) => setCandidates(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openNurture = (c: PoolCandidate) => {
    setNurtureForm({
      subject: "We have new opportunities for you",
      message: `Hi ${c.candidate_name},\n\nWe have exciting new roles that match your background${c.source_job_title ? ` from when you applied for ${c.source_job_title}` : ""}. We'd love to reconnect.\n\nBest regards`,
    });
    setNurtureModal(c);
  };

  const sendNurture = async () => {
    if (!nurtureModal) return;
    setNurturing(nurtureModal.id);
    await fetch(`/api/enterprise/talent-pool/${nurtureModal.id}/nurture`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nurtureForm),
    });
    setSent((s) => new Set(s).add(nurtureModal.id));
    setCandidates((prev) => prev.map((c) =>
      c.id === nurtureModal.id ? { ...c, status: "contacted", last_contacted: new Date().toISOString() } : c
    ));
    setNurturing(null);
    setNurtureModal(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (candidates.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">No candidates in the talent pool yet.</p>
      <p className="mt-1 text-xs text-muted-foreground">When reviewing applicants, add strong ones to the pool to reconnect later.</p>
    </div>
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {["Candidate", "Score", "Previous role", "Status", "Last contact", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {candidates.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-muted/20">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.candidate_name}</p>
                  <p className="text-xs text-muted-foreground">{c.candidate_email}</p>
                </td>
                <td className="px-4 py-3">
                  {c.match_score !== null
                    ? <span className={cn("font-bold tabular-nums", c.match_score >= 70 ? "text-green-400" : "text-amber-400")}>{c.match_score}%</span>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.source_job_title ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", STATUS_STYLES[c.status] ?? STATUS_STYLES.inactive)}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : "Never"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {sent.has(c.id)
                      ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Sent</span>
                      : <button onClick={() => openNurture(c)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Send className="h-3 w-3" /> Nurture
                        </button>}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nurtureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="font-semibold">Send nurture email</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">To: {nurtureModal.candidate_email}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subject</label>
                <input value={nurtureForm.subject} onChange={(e) => setNurtureForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea value={nurtureForm.message} onChange={(e) => setNurtureForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setNurtureModal(null)} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={sendNurture} disabled={nurturing === nurtureModal.id}
                className="btn-cta inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                {nurturing === nurtureModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page (tabs) ──────────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const [tab, setTab] = useState<"all" | "pool">("all");

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Candidates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every applicant across all jobs — search, review, and pull résumés.</p>
        </div>

        <div className="mb-6 inline-flex gap-1 rounded-xl border border-border bg-card p-1">
          {([["all", "All applicants"], ["pool", "Talent Pool"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {tab === "all" ? <AllApplicants /> : <TalentPool />}
      </div>
    </main>
  );
}
