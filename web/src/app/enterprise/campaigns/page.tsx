"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone, Plus, Loader2, Sparkles, Users, MailCheck, Play, Pause,
  Pencil, Trash2, BarChart3, ArrowLeft, UserPlus, Lock, Send, Clock, X, Bot,
  Square, Archive, MoreHorizontal, Copy, Stethoscope, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignWizard from "@/components/enterprise/campaign-wizard";
import AiSdrPanel from "@/components/enterprise/ai-sdr-panel";
import SubsequencesPanel from "@/components/enterprise/subsequences-panel";
import type { CampaignPreset } from "@/lib/campaigns";

type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "stopped" | "completed" | "archived";

type CampaignListItem = {
  id: string; name: string; description: string | null; status: CampaignStatus;
  created_at: string;
  pilot_size?: number | null; pilot_released?: boolean;
  stats?: { enrolled: number; replied: number; active: number; steps: number };
};

type Analytics = {
  totals: { enrolled: number; sent: number; replied: number; reply_rate: number; progress: number };
  outcomes?: {
    positive_replies: number; interested: number; meetings: number; pipeline: number;
    positive_reply_rate: number; meeting_rate: number; pipeline_rate: number;
  };
  breakdown: Record<string, number>;
  per_step: { step_order: number; subject: string; sent: number; opened: number; replied: number; open_rate: number; reply_rate: number }[];
  enrollments: { id: string; candidate_name: string; candidate_email: string; status: string; current_step_order: number; next_send_at: string | null; replied_at: string | null; enrolled_at: string }[];
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft:     "border-slate-500/30 bg-slate-500/10 text-slate-400",
  scheduled: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
  active:    "border-green-500/30 bg-green-500/10 text-green-400",
  paused:    "border-amber-500/30 bg-amber-500/10 text-amber-400",
  stopped:   "border-red-500/30 bg-red-500/10 text-red-400",
  completed: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  archived:  "border-border bg-muted text-muted-foreground",
};

const ENROLL_STATUS_STYLES: Record<string, string> = {
  active:       "text-sky-400",
  completed:    "text-slate-400",
  replied:      "text-green-400",
  unsubscribed: "text-muted-foreground",
  bounced:      "text-red-400",
  removed:      "text-muted-foreground",
};

type View =
  | { kind: "list" }
  | { kind: "builder"; campaignId: string | null }
  | { kind: "detail"; campaignId: string };

export default function CampaignsPage() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [presets, setPresets] = useState<CampaignPreset[]>([]);
  const [aiSdr, setAiSdr] = useState<{ id: string; name: string } | null>(null);
  const [subs, setSubs] = useState<{ id: string; name: string } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/enterprise/campaigns");
    if (res.status === 403) { setLocked(true); setLoading(false); return; }
    const json = await res.json();
    setCampaigns(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    fetch("/api/enterprise/campaigns/templates").then((r) => r.json()).then((j) => setPresets(j.data ?? [])).catch(() => {});
  }, []);

  if (locked) return <UpsellGate />;

  if (view.kind === "builder") {
    return <CampaignWizard campaignId={view.campaignId} presets={presets} onDone={() => { setView({ kind: "list" }); loadList(); }} onCancel={() => setView({ kind: "list" })} />;
  }
  if (view.kind === "detail") {
    return <DetailView campaignId={view.campaignId} onBack={() => { setView({ kind: "list" }); loadList(); }} onEdit={() => setView({ kind: "builder", campaignId: view.campaignId })} />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Megaphone className="h-5 w-5 text-primary" /> Outreach Campaigns
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Multi-step email sequences that nurture candidates on autopilot — with optional AI personalization per step.
            </p>
          </div>
          <button
            onClick={() => setView({ kind: "builder", campaignId: null })}
            className="btn-cta inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Megaphone className="mx-auto mb-3 h-9 w-9 text-muted-foreground/30" />
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Build a sequence of timed emails, enroll candidates, and let it run. Start from a template or from scratch.
            </p>
            <button
              onClick={() => setView({ kind: "builder", campaignId: null })}
              className="btn-cta mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" /> Create your first campaign
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setView({ kind: "detail", campaignId: c.id })} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{c.name}</p>
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize", STATUS_STYLES[c.status])}>
                        {c.status}
                      </span>
                    </div>
                    {c.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {c.stats?.steps ?? 0} steps</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.stats?.enrolled ?? 0} enrolled</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {c.stats?.active ?? 0} active</span>
                      <span className="flex items-center gap-1 text-green-400/80"><MailCheck className="h-3 w-3" /> {c.stats?.replied ?? 0} replied</span>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {c.status === "active" && c.pilot_size && !c.pilot_released && (
                      <ReleaseButton id={c.id} onReleased={loadList} />
                    )}
                    <StatusToggle campaign={c} onChanged={loadList} />
                    <button onClick={() => setAiSdr({ id: c.id, name: c.name })} title="AI SDR auto-reply" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Bot className="h-4 w-4" /></button>
                    <button onClick={() => setSubs({ id: c.id, name: c.name })} title="Subsequences" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Workflow className="h-4 w-4" /></button>
                    <button onClick={() => setView({ kind: "detail", campaignId: c.id })} title="Analytics" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><BarChart3 className="h-4 w-4" /></button>
                    <button onClick={() => setView({ kind: "builder", campaignId: c.id })} title="Edit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <DeleteButton id={c.id} onDeleted={loadList} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aiSdr && <AiSdrPanel campaignId={aiSdr.id} campaignName={aiSdr.name} onClose={() => setAiSdr(null)} />}
      {subs && <SubsequencesPanel campaignId={subs.id} campaignName={subs.name} onClose={() => setSubs(null)} />}
    </div>
  );
}

function StatusToggle({ campaign, onChanged }: { campaign: CampaignListItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const s = campaign.status;
  const live = s === "active";
  const terminal = s === "stopped" || s === "completed" || s === "archived";

  const setStatus = async (status: string) => {
    setBusy(true);
    setBlocked(null);
    setMenu(false);
    const res = await fetch(`/api/enterprise/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.status === 422) {
      const j = await res.json().catch(() => ({}));
      const fails = (j.preflight?.checks ?? []).filter((c: { status: string }) => c.status === "fail").map((c: { detail: string }) => c.detail);
      setBlocked(fails[0] ?? "Fix the launch checklist in the editor.");
      setTimeout(() => setBlocked(null), 6000);
      return;
    }
    onChanged();
  };

  return (
    <span className="relative flex items-center gap-0.5">
      {/* Primary play/pause — hidden for terminal states (stopped/completed/archived). */}
      {!terminal && (
        <button onClick={() => setStatus(live ? "paused" : "active")} disabled={busy} title={live ? "Pause" : "Activate"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : live ? <Pause className="h-4 w-4 text-amber-400" /> : <Play className="h-4 w-4 text-green-400" />}
        </button>
      )}
      <button onClick={() => setMenu((o) => !o)} title="More" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu && (
        <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-border bg-card p-1 shadow-2xl" onMouseLeave={() => setMenu(false)}>
          {(s === "active" || s === "paused") && (
            <button onClick={() => setStatus("stopped")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10">
              <Square className="h-3.5 w-3.5" /> Stop (permanent)
            </button>
          )}
          {s === "stopped" && (
            <button onClick={() => setStatus("active")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50">
              <Play className="h-3.5 w-3.5 text-green-400" /> Reactivate
            </button>
          )}
          <button
            onClick={async () => {
              setMenu(false); setBusy(true);
              await fetch(`/api/enterprise/campaigns/${campaign.id}/duplicate`, { method: "POST" }).catch(() => {});
              setBusy(false); onChanged();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          {s !== "archived" && (
            <button onClick={() => setStatus("archived")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50">
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )}
          {s === "archived" && (
            <button onClick={() => setStatus("draft")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50">
              <ArrowLeft className="h-3.5 w-3.5" /> Unarchive
            </button>
          )}
          <p className="px-2 pb-1 pt-1.5 text-[9px] leading-tight text-muted-foreground">
            Pause is resumable · Stop ends it · Archive hides it but keeps reporting.
          </p>
        </div>
      )}
      {blocked && (
        <span className="absolute right-0 top-9 z-30 w-60 rounded-lg border border-red-500/30 bg-card px-2.5 py-1.5 text-[11px] text-red-400 shadow-xl">
          Can&apos;t launch: {blocked}
        </span>
      )}
    </span>
  );
}

function ReleaseButton({ id, onReleased }: { id: string; onReleased: () => void }) {
  const [busy, setBusy] = useState(false);
  const release = async () => {
    setBusy(true);
    await fetch(`/api/enterprise/campaigns/${id}/release`, { method: "POST" }).catch(() => {});
    setBusy(false);
    onReleased();
  };
  return (
    <button onClick={release} disabled={busy} title="Release the rest of the pilot"
      className="inline-flex items-center gap-1 rounded-lg border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Release rest
    </button>
  );
}

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    await fetch(`/api/enterprise/campaigns/${id}`, { method: "DELETE" });
    setBusy(false);
    onDeleted();
  };
  if (!confirm) {
    return <button onClick={() => setConfirm(true)} title="Delete" className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>;
  }
  return (
    <button onClick={del} disabled={busy} className="rounded-lg px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/10">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm?"}
    </button>
  );
}

function DetailView({ campaignId, onBack, onEdit }: { campaignId: string; onBack: () => void; onEdit: () => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [diag, setDiag] = useState<{ score: number; issues: { level: string; label: string; detail: string; recommendation?: string }[] } | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const runDiagnose = async () => {
    setDiagBusy(true);
    const res = await fetch(`/api/enterprise/campaigns/${campaignId}/diagnose`);
    const j = await res.json().catch(() => ({}));
    setDiagBusy(false);
    if (res.ok) setDiag(j.data);
  };

  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [activity, setActivity] = useState<{ at: string; type: string; text: string }[] | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      fetch(`/api/enterprise/campaigns/${campaignId}/analytics`).then((r) => r.json()),
      fetch(`/api/enterprise/campaigns/${campaignId}`).then((r) => r.json()),
    ]);
    setData(a.data ?? null);
    setName(c.data?.name ?? "Campaign");
    setSelectedLeads(new Set());
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const enrollAction = async (eid: string, action: string) => {
    await fetch(`/api/enterprise/campaigns/${campaignId}/enrollments/${eid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    load();
  };

  const bulkLeadAction = async (action: string) => {
    setBulkBusy(true);
    await Promise.all([...selectedLeads].map((eid) =>
      fetch(`/api/enterprise/campaigns/${campaignId}/enrollments/${eid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      }).catch(() => {}),
    ));
    setBulkBusy(false);
    load();
  };

  const loadActivity = async () => {
    setShowActivity(true);
    const res = await fetch(`/api/enterprise/campaigns/${campaignId}/activity`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setActivity(j.data?.events ?? []);
  };
  const toggleLead = (eid: string) => setSelectedLeads((prev) => {
    const next = new Set(prev); next.has(eid) ? next.delete(eid) : next.add(eid); return next;
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setEnrollOpen(true)} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4" /> Enroll candidates
            </button>
            <button onClick={runDiagnose} disabled={diagBusy} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
              {diagBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Diagnose
            </button>
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Pencil className="h-4 w-4" /> Edit
            </button>
          </div>
        </div>

        <h1 className="mb-4 text-lg font-semibold">{name}</h1>

        {diag && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-primary" /> Campaign health
                <span className={cn("tabular-nums", diag.score >= 80 ? "text-green-400" : diag.score >= 50 ? "text-amber-400" : "text-red-400")}>{diag.score}/100</span>
              </p>
              <button onClick={() => setDiag(null)} aria-label="Dismiss"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            {diag.issues.length === 0 ? (
              <p className="text-sm text-green-400">No issues found — good to go.</p>
            ) : (
              <ul className="space-y-1.5">
                {diag.issues.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", it.level === "critical" ? "bg-red-500" : it.level === "warning" ? "bg-amber-500" : "bg-green-500")} />
                    <span>
                      <span className="font-medium">{it.label}</span> <span className="text-muted-foreground">— {it.detail}</span>
                      {it.recommendation && <span className="block text-[11px] text-primary/80">→ {it.recommendation}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading || !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Campaign progress (work done, not time elapsed) */}
            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">Campaign progress</span>
                <span className="tabular-nums text-muted-foreground">{data.totals.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.totals.progress}%` }} />
              </div>
            </div>

            {/* Totals */}
            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Enrolled" value={data.totals.enrolled} />
              <Stat label="Emails sent" value={data.totals.sent} />
              <Stat label="Replied" value={data.totals.replied} accent="text-green-400" />
              <Stat label="Reply rate" value={`${data.totals.reply_rate}%`} accent="text-primary" />
            </div>

            {/* Outcome funnel — what actually matters (opens are unreliable, so
                they're intentionally not the headline). */}
            {data.outcomes && (
              <>
                <h2 className="mb-2 text-sm font-semibold">Outcomes</h2>
                <div className="mb-6 overflow-x-auto">
                  <div className="flex min-w-max items-stretch gap-1.5">
                    {[
                      { label: "Enrolled", value: data.totals.enrolled, sub: "", tone: "text-foreground" },
                      { label: "Sent", value: data.totals.sent, sub: "", tone: "text-foreground" },
                      { label: "Replied", value: data.totals.replied, sub: `${data.totals.reply_rate}%`, tone: "text-green-400" },
                      { label: "Positive", value: data.outcomes.positive_replies, sub: `${data.outcomes.positive_reply_rate}% of replies`, tone: "text-orange-400" },
                      { label: "Meetings", value: data.outcomes.meetings, sub: `${data.outcomes.meeting_rate}%`, tone: "text-emerald-400" },
                      { label: "In pipeline", value: data.outcomes.pipeline, sub: `${data.outcomes.pipeline_rate}%`, tone: "text-sky-400" },
                    ].map((f, i, arr) => (
                      <div key={f.label} className="flex items-center gap-1.5">
                        <div className="min-w-[92px] rounded-xl border border-border bg-card p-2.5">
                          <p className={cn("text-lg font-semibold tabular-nums", f.tone)}>{f.value}</p>
                          <p className="text-[11px] font-medium">{f.label}</p>
                          {f.sub && <p className="text-[10px] text-muted-foreground">{f.sub}</p>}
                        </div>
                        {i < arr.length - 1 && <span className="text-muted-foreground/40">›</span>}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Open rate is intentionally excluded — pixel tracking is unreliable. Reply, positive-reply, and pipeline conversion are what count.</p>
                </div>
              </>
            )}

            {/* Per-step funnel */}
            <h2 className="mb-2 text-sm font-semibold">Per-step performance</h2>
            <div className="mb-6 space-y-2">
              {data.per_step.length === 0 && <p className="text-sm text-muted-foreground">No steps yet.</p>}
              {data.per_step.map((s) => (
                <div key={s.step_order} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{s.step_order + 1}</span>
                      <span className="truncate">{s.subject}</span>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span><span className="font-semibold text-foreground">{s.sent}</span> sent</span>
                    <span className="text-green-400/80"><span className="font-semibold">{s.replied}</span> replied ({s.reply_rate}%)</span>
                    <span className="opacity-60">{s.opened} opened ({s.open_rate}%) · unreliable</span>
                  </div>
                  {/* reply-rate bar — the signal we lead with */}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-green-500/60" style={{ width: `${s.reply_rate}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Enrollments / Leads */}
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Leads ({data.enrollments.length})</h2>
              <button onClick={loadActivity} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Clock className="h-3.5 w-3.5" /> Activity log
              </button>
            </div>
            {selectedLeads.size > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                <span className="font-medium">{selectedLeads.size} selected</span>
                <button onClick={() => bulkLeadAction("pause")} disabled={bulkBusy} className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-60">Pause</button>
                <button onClick={() => bulkLeadAction("resume")} disabled={bulkBusy} className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-60">Resume</button>
                <button onClick={() => bulkLeadAction("move_to_pipeline")} disabled={bulkBusy} className="rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-60">Move to pipeline</button>
                <button onClick={() => bulkLeadAction("remove")} disabled={bulkBusy} className="rounded-lg border border-border px-2 py-1 font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-60">Remove</button>
                {bulkBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </div>
            )}
            {data.enrollments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No one enrolled yet.</p>
                <button onClick={() => setEnrollOpen(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <UserPlus className="h-3.5 w-3.5" /> Enroll candidates
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {data.enrollments.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                    <input type="checkbox" checked={selectedLeads.has(e.id)} onChange={() => toggleLead(e.id)} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{e.candidate_name}</p>
                        <span className={cn("text-[11px] capitalize", ENROLL_STATUS_STYLES[e.status] ?? "text-muted-foreground")}>{e.status}</span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{e.candidate_email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                      {e.status === "active" && (
                        <span className="hidden sm:inline">on step {e.current_step_order + 1}{e.next_send_at ? ` · next ${new Date(e.next_send_at).toLocaleDateString()}` : ""}</span>
                      )}
                      {e.status === "active" && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => enrollAction(e.id, "mark_replied")} title="Mark replied" className="rounded p-1 hover:bg-muted hover:text-green-400"><MailCheck className="h-3.5 w-3.5" /></button>
                          <button onClick={() => enrollAction(e.id, "remove")} title="Remove" className="rounded p-1 hover:bg-muted hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {enrollOpen && <EnrollModal campaignId={campaignId} onClose={() => setEnrollOpen(false)} onEnrolled={() => { setEnrollOpen(false); load(); }} />}

      {showActivity && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowActivity(false)}>
          <div onClick={(ev) => ev.stopPropagation()} className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-primary" /> Activity log</h2>
              <button onClick={() => setShowActivity(false)} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {activity === null ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {activity.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        ev.type === "replied" ? "bg-green-500" : ev.type === "unsubscribed" ? "bg-red-500" : ev.type === "lead_added" ? "bg-sky-500" : "bg-muted-foreground/40")} />
                      <span className="flex-1">
                        <span>{ev.text}</span>
                        <span className="block text-[10px] text-muted-foreground">{new Date(ev.at).toLocaleString()}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className={cn("text-xl font-bold", accent)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EnrollModal({ campaignId, onClose, onEnrolled }: { campaignId: string; onClose: () => void; onEnrolled: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Parse "Name <email>" or "Name, email" or "email" lines.
  const parse = (): { name: string; email: string }[] => {
    return text.split("\n").map((line) => {
      const l = line.trim();
      if (!l) return null;
      const angle = l.match(/^(.*?)<([^>]+)>$/);
      if (angle) return { name: angle[1].trim() || angle[2].trim(), email: angle[2].trim() };
      const parts = l.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
      const email = parts.find((p) => p.includes("@"));
      if (!email) return null;
      const name = parts.find((p) => !p.includes("@")) ?? email.split("@")[0];
      return { name, email };
    }).filter(Boolean) as { name: string; email: string }[];
  };

  const submit = async () => {
    const candidates = parse();
    if (candidates.length === 0) { setResult("Add at least one candidate (Name <email> per line)."); return; }
    setBusy(true);
    const res = await fetch(`/api/enterprise/campaigns/${campaignId}/enroll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: candidates.map((c) => ({ ...c, source: "manual" })) }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setResult(j.error ?? "Could not enroll."); return; }
    if (j.data?.enrolled > 0) onEnrolled();
    else setResult(`Nothing enrolled — ${j.data?.skipped ?? 0} already in this campaign.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-primary" /> Enroll candidates</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          One candidate per line — <span className="font-mono">Name &lt;email@co.com&gt;</span> or just an email. They&apos;ll start at step 1 on schedule.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={"Ada Lovelace <ada@example.com>\nalan@example.com"}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        {result && <p className="mt-2 text-xs text-amber-400">{result}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enroll
          </button>
        </div>
      </div>
    </div>
  );
}

function UpsellGate() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-lg font-semibold">Outreach Campaigns is an Agency feature</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Build multi-step email sequences with custom delays, AI personalization, and per-step analytics. Available on the Agency plan and above.
        </p>
        <a href="/enterprise/settings" className="btn-cta mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" /> Upgrade to Agency
        </a>
      </div>
    </div>
  );
}
