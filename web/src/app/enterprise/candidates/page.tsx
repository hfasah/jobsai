"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Loader2, ExternalLink, Send, CheckCircle2, Search, Sparkles, FileDown, X, Plus, Check } from "lucide-react";
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
            placeholder="Search by name, skill, country, phone, or experience (e.g. “AWS engineer in Canada”)…"
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

interface PoolGroup { id: string; name: string; count: number; created_at: string }

function PoolChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {label}
    </button>
  );
}

function TalentPool() {
  const [candidates, setCandidates] = useState<PoolCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [nurturing, setNurturing] = useState<string | null>(null);
  const [nurtureModal, setNurtureModal] = useState<PoolCandidate | null>(null);
  const [nurtureForm, setNurtureForm] = useState({ subject: "", message: "" });
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Named pools
  const [groups, setGroups] = useState<PoolGroup[]>([]);
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string>("all"); // "all" | "none" | <groupId>
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  // Bulk nurture
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ subject: "", message: "" });
  const [bulkSending, setBulkSending] = useState(false);

  const loadGroups = () => fetch("/api/enterprise/talent-pool/groups").then((r) => r.json()).then((j) => {
    setGroups(j.data?.groups ?? []); setUngroupedCount(j.data?.ungrouped_count ?? 0); setTotal(j.data?.total ?? 0);
  });
  const loadMembers = (sel: string) => {
    setLoading(true);
    const qs = sel === "all" ? "" : `?group_id=${sel}`;
    return fetch(`/api/enterprise/talent-pool${qs}`).then((r) => r.json()).then((j) => setCandidates(j.data ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { loadGroups(); loadMembers("all"); }, []);

  const selectPool = (sel: string) => { setSelected(sel); loadMembers(sel); };
  const refreshPool = () => { loadGroups(); loadMembers(selected); };
  // The group new candidates are added to: the selected named pool, else ungrouped.
  const targetGroupId = selected !== "all" && selected !== "none" ? selected : null;

  const createPool = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const res = await fetch("/api/enterprise/talent-pool/groups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    setCreating(false);
    if (res.ok && j.data?.id) { setNewName(""); setNewOpen(false); await loadGroups(); selectPool(j.data.id); }
    else alert(j.error ?? "Couldn't create the pool.");
  };

  const openAdd = () => {
    setAddOpen(true); setLoadingApplicants(true);
    fetch("/api/enterprise/candidates").then((r) => r.json()).then((j) => setApplicants(j.data ?? [])).finally(() => setLoadingApplicants(false));
  };

  const addToPool = async (applicationId: string) => {
    setAddingId(applicationId);
    const res = await fetch("/api/enterprise/talent-pool", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: applicationId, group_id: targetGroupId }),
    });
    if (res.ok) { setAddedIds((s) => new Set(s).add(applicationId)); refreshPool(); }
    setAddingId(null);
  };

  const sendBulk = async () => {
    if (!bulkForm.message.trim()) return;
    setBulkSending(true);
    const res = await fetch("/api/enterprise/talent-pool/nurture-all", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: selected === "all" ? undefined : selected, subject: bulkForm.subject, message: bulkForm.message }),
    });
    const j = await res.json().catch(() => ({}));
    setBulkSending(false);
    if (res.ok) { alert(`Sent to ${j.data?.sent ?? 0} of ${j.data?.total ?? 0} candidates.`); setBulkOpen(false); refreshPool(); }
    else alert(j.error ?? "Couldn't send.");
  };

  const selectedName = selected === "all" ? "the whole talent pool" : selected === "none" ? "Ungrouped" : (groups.find((g) => g.id === selected)?.name ?? "this pool");

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

  return (
    <>
      {/* Named pool selector */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PoolChip label={`All (${total})`} active={selected === "all"} onClick={() => selectPool("all")} />
        {groups.map((g) => (
          <PoolChip key={g.id} label={`${g.name} (${g.count})`} active={selected === g.id} onClick={() => selectPool(g.id)} />
        ))}
        {ungroupedCount > 0 && <PoolChip label={`Ungrouped (${ungroupedCount})`} active={selected === "none"} onClick={() => selectPool("none")} />}
        <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus className="h-3 w-3" /> New pool
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{loading ? "Loading…" : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} in ${selectedName}`}</p>
        <div className="flex items-center gap-2">
          {candidates.length > 0 && (
            <button onClick={() => { setBulkForm({ subject: "", message: "" }); setBulkOpen(true); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Send className="h-3.5 w-3.5" /> Email all ({candidates.length})
            </button>
          )}
          <button onClick={openAdd} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> Add candidates
          </button>
        </div>
      </div>

      {newOpen && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createPool(); }}
            placeholder="Pool name (e.g. AWS bench, Future leadership)…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={createPool} disabled={creating || !newName.trim()} className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Create
          </button>
          <button onClick={() => { setNewOpen(false); setNewName(""); }} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : candidates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No candidates in the talent pool yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add strong applicants to reconnect with them later.</p>
        </div>
      ) : (
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
      )}

      {/* Add-candidates picker */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-semibold">Add candidates to talent pool</h2>
              <button onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingApplicants ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : applicants.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No applicants to add yet.</p>
              ) : applicants.map((a) => {
                const added = addedIds.has(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.candidate_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.candidate_email}{a.job ? ` · ${a.job.title}` : ""}</p>
                    </div>
                    {added ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-500"><Check className="h-3.5 w-3.5" /> Added</span>
                    ) : (
                      <button onClick={() => addToPool(a.id)} disabled={addingId === a.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50">
                        {addingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-3 text-right">
              <button onClick={() => setAddOpen(false)} className="btn-cta rounded-xl px-4 py-2 text-sm font-semibold">Done</button>
            </div>
          </div>
        </div>
      )}

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

      {/* Bulk nurture — email everyone in the selected pool */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setBulkOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Email everyone in {selectedName}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{candidates.length} candidate{candidates.length === 1 ? "" : "s"} · sent white-label from your company, each personally greeted.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Subject <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input value={bulkForm.subject} onChange={(e) => setBulkForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="New opportunities for you"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Message</label>
                <textarea value={bulkForm.message} onChange={(e) => setBulkForm((f) => ({ ...f, message: e.target.value }))}
                  rows={5} placeholder="We have exciting new roles that match your background — we'd love to reconnect."
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="mt-1 text-[11px] text-muted-foreground">Each email opens with “Hi {"{first name}"},”.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setBulkOpen(false)} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={sendBulk} disabled={bulkSending || !bulkForm.message.trim()}
                className="btn-cta inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send to {candidates.length}
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
