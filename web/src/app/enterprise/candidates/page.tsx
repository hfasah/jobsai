"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, ExternalLink, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PoolCandidate {
  id: string; candidate_name: string; candidate_email: string;
  candidate_phone: string | null; linkedin_url: string | null;
  match_score: number | null; source_job_title: string | null;
  skills_tags: string[]; notes: string | null;
  status: string; last_contacted: string | null; created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-green-500/15 text-green-400 border-green-500/30",
  contacted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  placed:    "bg-purple-500/15 text-purple-400 border-purple-500/30",
  inactive:  "bg-muted text-muted-foreground border-border",
};

export default function TalentPoolPage() {
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

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Talent Pool</h1>
          <p className="mt-1 text-sm text-muted-foreground">Strong candidates from previous roles, kept warm for future opportunities.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No candidates yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">When reviewing applicants, add strong candidates to the pool to reconnect later.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {["Candidate","Score","Previous role","Status","Last contact",""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
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
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", STATUS_STYLES[c.status] ?? STATUS_STYLES.inactive)}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sent.has(c.id)
                          ? <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Sent</span>
                          : <button onClick={() => openNurture(c)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <Send className="h-3 w-3" /> Nurture
                            </button>
                        }
                        {c.linkedin_url && (
                          <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
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
                className="btn-cta flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                {nurturing === nurtureModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
