"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Megaphone, Plus, Loader2, Sparkles, Users, MailCheck, Play, Pause,
  Pencil, Trash2, BarChart3, ArrowLeft, UserPlus, Lock, Send, Clock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CampaignBuilder, emptyDraft, draftFromCampaign,
  type CampaignDraft,
} from "@/components/enterprise/campaign-builder";
import type { CampaignPreset } from "@/lib/campaigns";

type CampaignStatus = "draft" | "active" | "paused" | "archived";

type CampaignListItem = {
  id: string; name: string; description: string | null; status: CampaignStatus;
  created_at: string;
  stats?: { enrolled: number; replied: number; active: number; steps: number };
};

type Analytics = {
  totals: { enrolled: number; sent: number; replied: number; reply_rate: number };
  breakdown: Record<string, number>;
  per_step: { step_order: number; subject: string; sent: number; opened: number; replied: number; open_rate: number; reply_rate: number }[];
  enrollments: { id: string; candidate_name: string; candidate_email: string; status: string; current_step_order: number; next_send_at: string | null; replied_at: string | null; enrolled_at: string }[];
};

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft:    "border-slate-500/30 bg-slate-500/10 text-slate-400",
  active:   "border-green-500/30 bg-green-500/10 text-green-400",
  paused:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
  archived: "border-border bg-muted text-muted-foreground",
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
    return <BuilderView campaignId={view.campaignId} presets={presets} onDone={() => { setView({ kind: "list" }); loadList(); }} onCancel={() => setView({ kind: "list" })} />;
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
                    <StatusToggle campaign={c} onChanged={loadList} />
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
    </div>
  );
}

function StatusToggle({ campaign, onChanged }: { campaign: CampaignListItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const live = campaign.status === "active";
  const toggle = async () => {
    setBusy(true);
    await fetch(`/api/enterprise/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: live ? "paused" : "active" }),
    });
    setBusy(false);
    onChanged();
  };
  return (
    <button onClick={toggle} disabled={busy} title={live ? "Pause" : "Activate"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : live ? <Pause className="h-4 w-4 text-amber-400" /> : <Play className="h-4 w-4 text-green-400" />}
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

function BuilderView({ campaignId, presets, onDone, onCancel }: { campaignId: string | null; presets: CampaignPreset[]; onDone: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<CampaignDraft | null>(campaignId ? null : emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/enterprise/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setDraft(draftFromCampaign(j.data)); })
      .catch(() => {});
  }, [campaignId]);

  const save = async (activate: boolean) => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    const payload = {
      name: draft.name,
      description: draft.description,
      status: activate ? "active" : "draft",
      steps: draft.steps.map(({ delay_days, subject, body, ai_personalize, ai_prompt }) => ({ delay_days, subject, body, ai_personalize, ai_prompt })),
    };
    const res = campaignId
      ? await fetch(`/api/enterprise/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/enterprise/campaigns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not save."); return; }
    onDone();
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto mb-4 max-w-3xl">
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </button>
      </div>
      {error && (
        <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      )}
      {draft ? (
        <CampaignBuilder draft={draft} setDraft={setDraft} onSave={save} onCancel={onCancel} saving={saving} presets={presets} />
      ) : (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}
    </div>
  );
}

function DetailView({ campaignId, onBack, onEdit }: { campaignId: string; onBack: () => void; onEdit: () => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      fetch(`/api/enterprise/campaigns/${campaignId}/analytics`).then((r) => r.json()),
      fetch(`/api/enterprise/campaigns/${campaignId}`).then((r) => r.json()),
    ]);
    setData(a.data ?? null);
    setName(c.data?.name ?? "Campaign");
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const enrollAction = async (eid: string, action: string) => {
    await fetch(`/api/enterprise/campaigns/${campaignId}/enrollments/${eid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    load();
  };

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
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Pencil className="h-4 w-4" /> Edit
            </button>
          </div>
        </div>

        <h1 className="mb-4 text-lg font-semibold">{name}</h1>

        {loading || !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Totals */}
            <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Enrolled" value={data.totals.enrolled} />
              <Stat label="Emails sent" value={data.totals.sent} />
              <Stat label="Replied" value={data.totals.replied} accent="text-green-400" />
              <Stat label="Reply rate" value={`${data.totals.reply_rate}%`} accent="text-primary" />
            </div>

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
                    <span><span className="font-semibold text-foreground">{s.opened}</span> opened ({s.open_rate}%)</span>
                    <span className="text-green-400/80"><span className="font-semibold">{s.replied}</span> replied ({s.reply_rate}%)</span>
                  </div>
                  {/* open-rate bar */}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${s.open_rate}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Enrollments */}
            <h2 className="mb-2 text-sm font-semibold">Enrolled candidates ({data.enrollments.length})</h2>
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
                    <div className="min-w-0">
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
