"use client";

// Per-campaign AI SDR configuration: enable + mode + persona + guardrails +
// thresholds, plus the campaign's knowledge base and operator memory notes.
// Opened as a modal from the campaigns list. Gated server-side by the ai_sdr
// feature + can_manage_ai_sdr.
import { useEffect, useState } from "react";
import { Bot, Loader2, X, Plus, Trash2, Pin, BookOpen, Brain, TriangleAlert, Check, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Config {
  ai_sdr_enabled: boolean;
  ai_sdr_mode: "manual" | "draft" | "auto";
  ai_sdr_persona: string | null;
  ai_sdr_guardrails: string | null;
  ai_sdr_min_confidence: number;
  ai_sdr_max_replies: number;
  ai_sdr_tier: "smart" | "fast";
}
interface KbDoc { id: string; title: string; content: string; pinned: boolean; updated_at: string }
interface MemoryNote { id: string; kind: string; content: string; created_at: string }

export default function AiSdrPanel({ campaignId, campaignName, onClose }: { campaignId: string; campaignName: string; onClose: () => void }) {
  const base = `/api/enterprise/campaigns/${campaignId}/ai-sdr`;
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [kb, setKb] = useState<KbDoc[]>([]);
  const [memory, setMemory] = useState<MemoryNote[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsPaused, setWsPaused] = useState(false);

  useEffect(() => {
    fetch(base)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        setCfg(j.data.config);
        setKb(j.data.knowledge ?? []);
        setMemory(j.data.memory ?? []);
      })
      .catch(() => setError("Could not load AI SDR settings."))
      .finally(() => setLoading(false));
    fetch("/api/enterprise/ai-sdr/settings")
      .then((r) => r.json())
      .then((j) => setWsPaused(j.data?.paused ?? false))
      .catch(() => {});
  }, [base]);

  const toggleWorkspacePause = async () => {
    const next = !wsPaused;
    setWsPaused(next);
    await fetch("/api/enterprise/ai-sdr/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: next }),
    }).catch(() => setWsPaused(!next));
  };

  const patch = (p: Partial<Config>) => setCfg((c) => (c ? { ...c, ...p } : c));

  const saveConfig = async () => {
    if (!cfg) return;
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Save failed."); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-primary" /> AI SDR — <span className="text-muted-foreground">{campaignName}</span>
          </h2>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !cfg ? (
          <div className="p-6 text-center text-sm text-red-400">{error ?? "Unavailable."}</div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Workspace kill switch */}
            <section className={cn("flex items-center justify-between gap-3 rounded-xl border p-3", wsPaused ? "border-red-500/40 bg-red-500/5" : "border-border")}>
              <div className="flex items-start gap-2">
                <PauseCircle className={cn("mt-0.5 h-4 w-4 shrink-0", wsPaused ? "text-red-400" : "text-muted-foreground")} />
                <span>
                  <span className="block text-sm font-medium">Workspace kill switch</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {wsPaused ? "AI SDR is paused for every campaign in this workspace." : "Instantly pause all AI SDR drafting & sending across the workspace."}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={toggleWorkspacePause}
                className={cn("shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold", wsPaused ? "border-red-500/40 text-red-400" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {wsPaused ? "Resume" : "Pause all"}
              </button>
            </section>

            {/* Enable + mode */}
            <section className="rounded-xl border border-border p-3">
              <label className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => patch({ ai_sdr_enabled: !cfg.ai_sdr_enabled })}
                  className={cn("mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors", cfg.ai_sdr_enabled ? "bg-primary" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", cfg.ai_sdr_enabled ? "left-[18px]" : "left-0.5")} />
                </button>
                <span>
                  <span className="block text-sm font-medium">Enable AI SDR for this campaign</span>
                  <span className="block text-[11px] text-muted-foreground">When a candidate replies, the AI drafts a grounded response from the knowledge base below.</span>
                </span>
              </label>

              {cfg.ai_sdr_enabled && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([
                    { key: "manual", title: "Manual", desc: "No AI draft — a recruiter writes every reply." },
                    { key: "draft", title: "Draft for review", desc: "Suggests a reply; a human approves & sends." },
                    { key: "auto", title: "Auto-send", desc: "Sends automatically when confident." },
                  ] as const).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => patch({ ai_sdr_mode: m.key })}
                      className={cn("rounded-xl border p-2.5 text-left text-xs transition-colors", cfg.ai_sdr_mode === m.key ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80")}
                    >
                      <span className="block text-sm font-medium">{m.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {cfg.ai_sdr_enabled && cfg.ai_sdr_mode === "auto" && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-400">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Auto-send emails candidates without a human in the loop. It still only fires on positive/neutral replies above the confidence floor, never on opt-outs or declines, and caps replies per thread.
                </div>
              )}
            </section>

            {cfg.ai_sdr_enabled && (
              <>
                {/* Persona + guardrails */}
                <section className="space-y-3">
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Persona &amp; tone</span>
                    <textarea
                      value={cfg.ai_sdr_persona ?? ""}
                      onChange={(e) => patch({ ai_sdr_persona: e.target.value })}
                      rows={3}
                      placeholder="e.g. A friendly technical recruiter. Warm but concise. Never pushy."
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Hard rules (guardrails)</span>
                    <textarea
                      value={cfg.ai_sdr_guardrails ?? ""}
                      onChange={(e) => patch({ ai_sdr_guardrails: e.target.value })}
                      rows={3}
                      placeholder="e.g. Never quote a salary number. Never commit to a start date. Always offer a call for detailed questions."
                      className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </section>

                {/* Thresholds */}
                <section className="grid grid-cols-3 gap-3">
                  {cfg.ai_sdr_mode === "auto" && (
                    <label className="block text-xs">
                      <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Auto-send confidence</span>
                      <input
                        type="number" min={0} max={1} step={0.05}
                        value={cfg.ai_sdr_min_confidence}
                        onChange={(e) => patch({ ai_sdr_min_confidence: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                  )}
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Max replies / thread</span>
                    <input
                      type="number" min={0} max={10} step={1}
                      value={cfg.ai_sdr_max_replies}
                      onChange={(e) => patch({ ai_sdr_max_replies: Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0))) })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Model</span>
                    <select
                      value={cfg.ai_sdr_tier}
                      onChange={(e) => patch({ ai_sdr_tier: e.target.value as "smart" | "fast" })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="smart">Smart (best quality)</option>
                      <option value="fast">Fast (cheaper)</option>
                    </select>
                  </label>
                </section>

                {/* Knowledge base */}
                <KnowledgeSection base={base} docs={kb} setDocs={setKb} />

                {/* Memory */}
                <MemorySection base={base} notes={memory} setNotes={setMemory} />
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {cfg && (
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            {error ? <span className="text-xs text-red-400">{error}</span> : <span className="text-[11px] text-muted-foreground">Grounded only in the knowledge base — it won&apos;t invent comp, dates, or commitments.</span>}
            <button onClick={saveConfig} disabled={saving} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saved ? "Saved" : "Save settings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeSection({ base, docs, setDocs }: { base: string; docs: KbDoc[]; setDocs: (d: KbDoc[]) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    const res = await fetch(`${base}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, pinned }),
    });
    setBusy(false);
    if (res.ok) {
      const j = await res.json();
      setDocs([j.data, ...docs]);
      setTitle(""); setContent(""); setPinned(false); setAdding(false);
    }
  };
  const remove = async (id: string) => {
    setDocs(docs.filter((d) => d.id !== id));
    await fetch(`${base}/knowledge?docId=${id}`, { method: "DELETE" });
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Knowledge base <span className="text-muted-foreground">({docs.length})</span></h3>
        {!adding && <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3.5 w-3.5" /> Add doc</button>}
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Role details, comp bands, FAQs, objection handling — the facts the SDR is allowed to use.</p>

      {adding && (
        <div className="mb-2 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Compensation & benefits)" className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="The facts…" className="w-full resize-y rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin (prioritize in the prompt)
            </label>
            <div className="flex gap-1.5">
              <button onClick={() => setAdding(false)} className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={add} disabled={busy || !title.trim() || !content.trim()} className="btn-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {docs.map((d) => (
          <div key={d.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-2">
            {d.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{d.title}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{d.content}</p>
            </div>
            <button onClick={() => remove(d.id)} className="shrink-0 text-muted-foreground hover:text-red-400" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {docs.length === 0 && !adding && <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">No docs yet. Without a knowledge base the SDR will defer most questions to a human.</p>}
      </div>
    </section>
  );
}

function MemorySection({ base, notes, setNotes }: { base: string; notes: MemoryNote[]; setNotes: (n: MemoryNote[]) => void }) {
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("note");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!content.trim()) return;
    setBusy(true);
    const res = await fetch(`${base}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, kind }),
    });
    setBusy(false);
    if (res.ok) { const j = await res.json(); setNotes([j.data, ...notes]); setContent(""); }
  };
  const remove = async (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    await fetch(`${base}/memory?noteId=${id}`, { method: "DELETE" });
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Brain className="h-4 w-4 text-primary" /> Memory <span className="text-muted-foreground">({notes.length})</span></h3>
      <p className="mb-2 text-[11px] text-muted-foreground">Steering rules the SDR always follows — persona quirks, do&apos;s &amp; don&apos;ts, common objections and how to handle them.</p>

      <div className="mb-2 flex gap-1.5">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="note">Note</option>
          <option value="objection">Objection</option>
          <option value="fact">Fact</option>
        </select>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add a rule the SDR should always follow…"
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={add} disabled={busy || !content.trim()} className="btn-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="space-y-1.5">
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-2">
            <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">{n.kind}</span>
            <p className="min-w-0 flex-1 text-xs">{n.content}</p>
            <button onClick={() => remove(n.id)} className="shrink-0 text-muted-foreground hover:text-red-400" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
