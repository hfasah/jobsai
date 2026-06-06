"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, Plus, Send, Sparkles, Trash2, CheckCircle2,
  ShieldCheck, MessageSquareQuote, CalendarClock, Copy, Check, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingRecord, ReferenceCheck, BackgroundCheck } from "@/types/preboarding";
import {
  ONBOARDING_STATUS_META, BG_STATUS_META, REFERENCE_STATUS_META,
  STANDARD_CHECKS, OPTIONAL_CHECKS,
} from "@/types/preboarding";
import { RECOMMENDATION_META } from "@/types/interview-intelligence";
import type { AIRecommendation, EnterpriseApplication } from "@/types/enterprise";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://jobsai.work";

// ── Background check row ───────────────────────────────────────────────────────
function CheckRow({ check, onUpdate, onDelete }: {
  check: BackgroundCheck; onUpdate: (id: string, patch: Partial<BackgroundCheck>) => void; onDelete: (id: string) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const meta = BG_STATUS_META[check.status];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{check.label}</p>
        <div className="flex items-center gap-1.5">
          <select value={check.status} onChange={(e) => onUpdate(check.id, { status: e.target.value as BackgroundCheck["status"] })}
            className={cn("rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none", meta.color)}>
            {(["pending", "in_progress", "clear", "flagged", "failed", "na"] as const).map((s) => (
              <option key={s} value={s} className="bg-card text-foreground">{BG_STATUS_META[s].label}</option>
            ))}
          </select>
          <button onClick={() => setNotesOpen((o) => !o)} className="text-muted-foreground hover:text-foreground text-xs underline">notes</button>
          <button onClick={() => onDelete(check.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {notesOpen && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input defaultValue={check.provider ?? ""} onBlur={(e) => onUpdate(check.id, { provider: e.target.value })}
            placeholder="Provider (e.g. Checkr)"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          <input defaultValue={check.reference_id ?? ""} onBlur={(e) => onUpdate(check.id, { reference_id: e.target.value })}
            placeholder="Case / order ID"
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          <textarea defaultValue={check.notes ?? ""} onBlur={(e) => onUpdate(check.id, { notes: e.target.value })}
            placeholder="Notes / result" rows={2}
            className="sm:col-span-2 resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      )}
    </div>
  );
}

// ── Reference card ─────────────────────────────────────────────────────────────
function ReferenceCard({ reference, onSend, onSummarize, onSaveResponses, onDelete }: {
  reference: ReferenceCheck;
  onSend: (id: string) => void;
  onSummarize: (id: string, responses: { question: string; answer: string }[]) => void;
  onSaveResponses: (id: string, responses: { question: string; answer: string }[]) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    reference.responses?.forEach((r, i) => { m[reference.questions[i]?.id ?? String(i)] = r.answer; });
    return m;
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = REFERENCE_STATUS_META[reference.status];
  const rec = reference.ai_recommendation ? RECOMMENDATION_META[reference.ai_recommendation as AIRecommendation] : null;
  const link = `${ORIGIN}/enterprise/reference/${reference.token}`;

  const buildResponses = () => reference.questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? "" }));

  return (
    <div className="rounded-xl border border-border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-muted/30">
        <div className="text-left">
          <p className="text-sm font-medium">{reference.referee_name}</p>
          <p className="text-[11px] text-muted-foreground">{[reference.relationship, reference.company].filter(Boolean).join(" · ") || "Reference"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {rec && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", rec.color)}>{rec.label}</span>}
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", meta.color)}>{meta.label}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 pt-2.5 space-y-3">
          {/* AI summary if completed */}
          {reference.ai_summary && (
            <div className="rounded-lg bg-background/60 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reference summary</p>
              <p className="mt-1 text-xs leading-relaxed">{reference.ai_summary}</p>
            </div>
          )}

          {/* Send link / copy */}
          {reference.referee_email && reference.status !== "completed" && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => onSend(reference.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20">
                <Send className="h-3 w-3" /> {reference.status === "sent" ? "Resend" : "Email referee"}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Link2 className="h-3 w-3" />} {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          )}

          {/* HR fills responses (e.g. phone reference) */}
          {reference.status !== "completed" && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground">Or record answers from a call:</p>
              {reference.questions.map((q) => (
                <div key={q.id}>
                  <p className="mb-1 text-[11px]">{q.question}</p>
                  <textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    rows={2} placeholder="Referee's answer…"
                    className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => onSaveResponses(reference.id, buildResponses())}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted">Save</button>
                <button onClick={async () => { setBusy(true); await onSummarize(reference.id, buildResponses()); setBusy(false); }} disabled={busy}
                  className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Summarize with AI
                </button>
              </div>
            </div>
          )}

          {/* completed responses */}
          {reference.status === "completed" && reference.responses?.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-[11px] font-medium text-primary hover:underline">View full responses</summary>
              <div className="mt-1.5 space-y-1.5">
                {reference.responses.map((r, i) => (
                  <div key={i} className="rounded-lg bg-background/60 p-2">
                    <p className="text-[11px] font-medium">{r.question}</p>
                    <p className="text-[11px] text-muted-foreground">{r.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          <button onClick={() => onDelete(reference.id)} className="text-[11px] text-muted-foreground hover:text-destructive">Remove reference</button>
        </div>
      )}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export function PreboardingModal({ app, onClose }: { app: EnterpriseApplication; onClose: () => void }) {
  const appId = app.id;
  const [onboarding, setOnboarding] = useState<OnboardingRecord | null>(null);
  const [references, setReferences] = useState<ReferenceCheck[]>([]);
  const [checks, setChecks] = useState<BackgroundCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "references" | "background">("overview");
  const [newRef, setNewRef] = useState({ referee_name: "", referee_email: "", relationship: "Manager", company: "" });
  const [addingRef, setAddingRef] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/enterprise/applications/${appId}/onboarding`);
    const json = await res.json();
    setOnboarding(json.data?.onboarding ?? null);
    setReferences(json.data?.references ?? []);
    setChecks(json.data?.checks ?? []);
    setLoading(false);
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  const updateOnboarding = async (patch: Partial<OnboardingRecord>) => {
    setOnboarding((o) => o ? { ...o, ...patch } : o);
    await fetch(`/api/enterprise/applications/${appId}/onboarding`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
  };

  // references
  const addReference = async () => {
    if (!newRef.referee_name.trim()) return;
    setAddingRef(true);
    const res = await fetch(`/api/enterprise/applications/${appId}/references`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRef),
    });
    const json = await res.json();
    if (json.data) setReferences((r) => [...r, json.data]);
    setNewRef({ referee_name: "", referee_email: "", relationship: "Manager", company: "" });
    setAddingRef(false);
  };
  const sendReference = async (id: string) => {
    const res = await fetch(`/api/enterprise/references/${id}`, { method: "POST" });
    const json = await res.json();
    if (json.data) setReferences((r) => r.map((x) => x.id === id ? json.data : x));
  };
  const summarizeReference = async (id: string, responses: { question: string; answer: string }[]) => {
    const res = await fetch(`/api/enterprise/references/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses, summarize: true }),
    });
    const json = await res.json();
    if (json.data) setReferences((r) => r.map((x) => x.id === id ? json.data : x));
  };
  const saveReferenceResponses = async (id: string, responses: { question: string; answer: string }[]) => {
    await fetch(`/api/enterprise/references/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses }),
    });
  };
  const deleteReference = async (id: string) => {
    setReferences((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/enterprise/references/${id}`, { method: "DELETE" });
  };

  // background checks
  const addStandardChecks = async () => {
    const existing = new Set(checks.map((c) => c.check_type));
    const toAdd = STANDARD_CHECKS.filter((c) => !existing.has(c.type));
    if (!toAdd.length) return;
    const res = await fetch(`/api/enterprise/applications/${appId}/background`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checks: toAdd.map((c) => ({ check_type: c.type, label: c.label })) }),
    });
    const json = await res.json();
    if (json.data) setChecks((c) => [...c, ...json.data]);
  };
  const addCheck = async (check_type: string, label: string) => {
    const res = await fetch(`/api/enterprise/applications/${appId}/background`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ check_type, label }),
    });
    const json = await res.json();
    if (json.data) setChecks((c) => [...c, json.data]);
  };
  const updateCheck = async (id: string, patch: Partial<BackgroundCheck>) => {
    setChecks((c) => c.map((x) => x.id === id ? { ...x, ...patch } : x));
    await fetch(`/api/enterprise/background/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
  };
  const deleteCheck = async (id: string) => {
    setChecks((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/enterprise/background/${id}`, { method: "DELETE" });
  };

  // readiness rollup
  const refsDone = references.length > 0 && references.every((r) => r.status === "completed");
  const checksDone = checks.length > 0 && checks.every((c) => ["clear", "na"].includes(c.status));
  const anyFlagged = checks.some((c) => ["flagged", "failed"].includes(c.status));
  const readiness = (() => {
    let total = 0, done = 0;
    if (references.length) { total++; if (refsDone) done++; }
    if (checks.length) { total++; if (checksDone) done++; }
    if (onboarding?.start_date) { total++; done++; }
    return total ? Math.round((done / total) * 100) : 0;
  })();

  const oMeta = onboarding ? ONBOARDING_STATUS_META[onboarding.status] : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Pre-boarding</h2>
              <p className="text-xs text-muted-foreground">{app.candidate_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-border px-3 py-2">
          {([
            { id: "overview", label: "Overview", icon: CalendarClock },
            { id: "references", label: `References${references.length ? ` (${references.length})` : ""}`, icon: MessageSquareQuote },
            { id: "background", label: `Background${checks.length ? ` (${checks.length})` : ""}`, icon: ShieldCheck },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tab === "overview" ? (
            <div className="space-y-5">
              {/* Readiness */}
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Ready to start</p>
                  {oMeta && <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", oMeta.color)}>{oMeta.label}</span>}
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", anyFlagged ? "bg-amber-500" : "bg-green-500")} style={{ width: `${readiness}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{readiness}% complete{anyFlagged ? " · review flagged checks" : ""}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">{refsDone ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />} References</div>
                  <div className="flex items-center gap-1.5">{checksDone ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />} Background checks</div>
                </div>
              </div>

              {/* Start date + status */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Start date</label>
                  <input type="date" value={onboarding?.start_date ?? ""} onChange={(e) => updateOnboarding({ start_date: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Status</label>
                  <select value={onboarding?.status ?? "not_started"} onChange={(e) => updateOnboarding({ status: e.target.value as OnboardingRecord["status"] })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {(["not_started", "in_progress", "cleared", "on_hold", "completed"] as const).map((s) => (
                      <option key={s} value={s}>{ONBOARDING_STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Notes</label>
                <textarea defaultValue={onboarding?.notes ?? ""} onBlur={(e) => updateOnboarding({ notes: e.target.value })} rows={3}
                  placeholder="Offer details, equipment, paperwork…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          ) : tab === "references" ? (
            <div className="space-y-4">
              {/* add referee */}
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <p className="mb-2.5 text-sm font-semibold">Add a referee</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={newRef.referee_name} onChange={(e) => setNewRef((r) => ({ ...r, referee_name: e.target.value }))}
                    placeholder="Referee name *" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <input value={newRef.referee_email} onChange={(e) => setNewRef((r) => ({ ...r, referee_email: e.target.value }))}
                    placeholder="Email" type="email" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <select value={newRef.relationship} onChange={(e) => setNewRef((r) => ({ ...r, relationship: e.target.value }))}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {["Manager", "Colleague", "Direct report", "Client", "Other"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <input value={newRef.company} onChange={(e) => setNewRef((r) => ({ ...r, company: e.target.value }))}
                    placeholder="Company" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <button onClick={addReference} disabled={addingRef || !newRef.referee_name.trim()}
                  className="btn-cta mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60">
                  {addingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add (AI builds questions)
                </button>
              </div>

              {references.map((ref) => (
                <ReferenceCard key={ref.id} reference={ref}
                  onSend={sendReference} onSummarize={summarizeReference}
                  onSaveResponses={saveReferenceResponses} onDelete={deleteReference} />
              ))}
              {references.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No references yet.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {checks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                  <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
                  <p className="mb-3 text-sm text-muted-foreground">No background checks started.</p>
                  <button onClick={addStandardChecks} className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold">
                    <Plus className="h-4 w-4" /> Start standard checks
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {checks.map((c) => <CheckRow key={c.id} check={c} onUpdate={updateCheck} onDelete={deleteCheck} />)}
                  </div>
                  {/* add more */}
                  <div className="flex flex-wrap gap-1.5">
                    {[...STANDARD_CHECKS, ...OPTIONAL_CHECKS]
                      .filter((sc) => !checks.some((c) => c.check_type === sc.type))
                      .map((sc) => (
                        <button key={sc.type} onClick={() => addCheck(sc.type, sc.label)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                          <Plus className="h-3 w-3" /> {sc.label}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
