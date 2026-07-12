"use client";

// Guided campaign builder — one flow from setup to launch, stitching the
// pieces that were previously separate surfaces (sequence builder, AI SDR,
// preflight) into a stepper, plus a per-candidate email preview before launch.
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Loader2, Check, Bot, X, Wand2,
  Users, Search, CircleCheck, CircleAlert, CircleDot, Rocket, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CampaignBuilder, emptyDraft, draftFromCampaign, type CampaignDraft,
} from "@/components/enterprise/campaign-builder";
import AiSdrPanel from "@/components/enterprise/ai-sdr-panel";
import GlobalSourcing from "@/components/enterprise/sourcing/global-sourcing";
import { validateSteps, type CampaignPreset } from "@/lib/campaigns";

const STEPS = ["Setup", "Audience", "Sequence", "AI replies", "Review"] as const;

const OBJECTIVES: { key: string; label: string; desc: string }[] = [
  { key: "source", label: "Source candidates", desc: "Find and reach new talent" },
  { key: "re_engage", label: "Re-engage past candidates", desc: "Warm up people you've spoken to before" },
  { key: "promote", label: "Promote a role", desc: "Get a specific opening in front of people" },
  { key: "pipeline", label: "Build a pipeline", desc: "Nurture talent for future roles" },
];

interface PreflightCheck { key: string; label: string; status: "pass" | "warn" | "fail"; detail: string }
interface PreviewStep { step_order: number; delay_days: number; day: number; subject: string; body: string }
interface PreviewData {
  candidate: { id: string | null; name: string; email: string };
  is_sample: boolean;
  job_title: string;
  sender_name: string;
  enrollments: { id: string; name: string; email: string }[];
  steps: PreviewStep[];
}

function monthYear(): string {
  const d = new Date();
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

interface Enrollee { id: string; candidate_name: string; candidate_email: string; email_status: string | null; status: string }
interface AudienceData {
  total: number; active: number; sendable: number;
  by_status: { valid: number; risky: number; invalid: number; unknown: number; none: number };
  enrollments: Enrollee[];
}

const VERIF: Record<string, { label: string; cls: string }> = {
  valid: { label: "Verified", cls: "border-green-500/30 bg-green-500/10 text-green-500" },
  risky: { label: "Likely valid", cls: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
  invalid: { label: "Invalid", cls: "border-red-500/30 bg-red-500/10 text-red-500" },
  unknown: { label: "Unverified", cls: "border-border bg-muted/40 text-muted-foreground" },
  none: { label: "Unverified", cls: "border-border bg-muted/40 text-muted-foreground" },
};
function VerifChip({ status }: { status: string | null }) {
  const m = VERIF[status ?? "none"] ?? VERIF.none;
  return <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", m.cls)}>{m.label}</span>;
}

export default function CampaignWizard({
  campaignId: initialId, presets, onDone, onCancel,
}: {
  campaignId: string | null;
  presets: CampaignPreset[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [campaignId, setCampaignId] = useState<string | null>(initialId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft | null>(initialId ? null : emptyDraft());
  const [objective, setObjective] = useState<string>("");
  const [targetRole, setTargetRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightCheck[] | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [audience, setAudience] = useState<AudienceData | null>(null);

  const buildPayload = (activate: boolean) => {
    if (!draft) return null;
    const w = draft.sendWindow;
    return {
      name: draft.name,
      description: draft.description,
      objective: objective || undefined,
      status: activate ? "active" : "draft",
      steps: draft.steps.map(({ delay_days, subject, body, ai_personalize, ai_prompt, ab_subject, ab_body }) => ({
        delay_days, subject, body, ai_personalize, ai_prompt, ab_subject, ab_body,
      })),
      send_window: w.enabled
        ? { start: w.start, end: w.end, timezone: w.timezone, business_days_only: w.business_days_only }
        : { start: null, end: null, timezone: null, business_days_only: false },
    };
  };

  // Persist the draft (create on first save, patch after). Returns the id on
  // success, or surfaces a preflight failure when activating.
  const persist = async (activate: boolean): Promise<string | null> => {
    const payload = buildPayload(activate);
    if (!payload) return null;
    setSaving(true);
    setError(null);
    setPreflight(null);
    const res = campaignId
      ? await fetch(`/api/enterprise/campaigns/${campaignId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/enterprise/campaigns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.status === 422) {
      const j = await res.json().catch(() => ({}));
      setPreflight(j.preflight?.checks ?? null);
      setError(j.error ?? "Launch blocked — fix the checks below.");
      return null;
    }
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not save."); return null; }
    const j = await res.json().catch(() => ({}));
    const id = campaignId ?? j.data?.id ?? null;
    if (id && !campaignId) setCampaignId(id);
    return id;
  };

  // Create a bare draft (name + objective, no steps yet) so the Audience and
  // AI-replies steps have a campaign id to work against. Steps are written by
  // the Sequence step later.
  const ensureCampaign = async (): Promise<string | null> => {
    if (campaignId) {
      // Already created — persist any Setup edits (name / objective).
      await fetch(`/api/enterprise/campaigns/${campaignId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft?.name, description: draft?.description, objective: objective || undefined }),
      }).catch(() => {});
      return campaignId;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/enterprise/campaigns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft?.name, description: draft?.description, objective: objective || undefined, status: "draft" }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not save."); return null; }
    const j = await res.json().catch(() => ({}));
    const id = j.data?.id ?? null;
    if (id) setCampaignId(id);
    return id;
  };

  const loadAudience = useCallback(async (id: string) => {
    const res = await fetch(`/api/enterprise/campaigns/${id}/audience`);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.data) setAudience(j.data as AudienceData);
  }, []);

  const removeEnrollee = async (enrollmentId: string) => {
    if (!campaignId) return;
    setAudience((a) => (a ? { ...a, enrollments: a.enrollments.filter((e) => e.id !== enrollmentId) } : a));
    await fetch(`/api/enterprise/campaigns/${campaignId}/enrollments/${enrollmentId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove" }),
    }).catch(() => {});
    loadAudience(campaignId);
  };

  // Load an existing campaign for edit.
  useEffect(() => {
    if (!initialId) return;
    fetch(`/api/enterprise/campaigns/${initialId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setDraft(draftFromCampaign(j.data));
          setObjective(j.data.objective ?? "");
        }
      })
      .catch(() => {});
    loadAudience(initialId);
  }, [initialId, loadAudience]);

  const loadPreview = useCallback(async (id: string, enrollmentId?: string) => {
    setPreviewLoading(true);
    const qs = enrollmentId ? `?enrollmentId=${enrollmentId}` : "";
    const res = await fetch(`/api/enterprise/campaigns/${id}/preview${qs}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setPreview(j.data);
    setPreviewLoading(false);
  }, []);

  const loadPreflight = useCallback(async (id: string) => {
    const res = await fetch(`/api/enterprise/campaigns/${id}/preflight`);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setPreflight(j.data?.checks ?? null);
  }, []);

  const goNext = async () => {
    setError(null);
    if (step === 0) {
      // Setup → create the draft, then Audience.
      if (!draft?.name.trim()) { setError("Give the campaign a name."); return; }
      const id = await ensureCampaign();
      if (!id) return;
      loadAudience(id);
      setStep(1);
      return;
    }
    if (step === 1) {
      // Audience → Sequence (no gate; a campaign can be built before it has an
      // audience, and candidates can be added later).
      setStep(2);
      return;
    }
    if (step === 2) {
      // Sequence → validate + save steps, then AI replies.
      const stepErr = validateSteps((draft?.steps ?? []).map((s) => ({ delay_days: s.delay_days, subject: s.subject, body: s.body })));
      if (stepErr) { setError(stepErr); return; }
      const id = await persist(false);
      if (!id) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      // AI replies → Review (load preview + readiness + fresh audience).
      const id = campaignId ?? (await persist(false));
      if (!id) return;
      setStep(4);
      loadPreview(id);
      loadPreflight(id);
      loadAudience(id);
      return;
    }
  };

  const launch = async () => {
    const id = await persist(true);
    if (id) onDone();
  };
  const saveDraft = async () => {
    const id = await persist(false);
    if (id) onDone();
  };

  const autoName = () => {
    if (!draft) return;
    const role = targetRole.trim() || "Outreach";
    setDraft({ ...draft, name: `${role} – ${monthYear()}` });
  };

  if (!draft) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const canPreview = preview && preview.steps.length > 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className={cn("mx-auto", step === 1 ? "max-w-5xl" : "max-w-3xl")}>
        {/* Header + cancel */}
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Campaigns
          </button>
          <span className="text-xs text-muted-foreground">{campaignId ? "Editing" : "New campaign"}</span>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-1.5">
              <button
                onClick={() => { if (i < step || campaignId) setStep(i); }}
                disabled={i > step && !campaignId}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  i === step ? "bg-primary/15 text-primary"
                    : i < step ? "text-foreground hover:bg-muted"
                    : "text-muted-foreground",
                )}
              >
                <span className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                  i < step ? "bg-primary text-white" : i === step ? "border border-primary text-primary" : "border border-border",
                )}>
                  {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {label}
              </button>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-primary/40" : "bg-border")} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Setup ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Set up the campaign</h2>
              <p className="text-sm text-muted-foreground">Name it and tell us what it's for.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target role (optional)</label>
              <input
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Senior DevOps Engineer"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campaign name</label>
              <div className="flex gap-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Senior DevOps Engineer – Jul 2026"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button onClick={autoName} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <Wand2 className="h-3.5 w-3.5" /> Suggest
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objective</label>
              <div className="grid grid-cols-2 gap-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setObjective(o.key)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      objective === o.key ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80",
                    )}
                  >
                    <span className="block text-sm font-medium">{o.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description (optional)</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
                placeholder="A note for your team about this campaign."
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Audience ── */}
        {step === 1 && campaignId && (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Add your audience</h2>
                <p className="text-sm text-muted-foreground">Search for candidates and add them straight into this campaign.</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
                <Users className="mr-1 inline h-3.5 w-3.5 text-primary" />
                {audience?.total ?? 0} in campaign
              </span>
            </div>
            <div className="rounded-2xl border border-border">
              <GlobalSourcing
                mode="external"
                campaignContext={{ id: campaignId, name: draft.name || "this campaign" }}
                onEnrolled={() => loadAudience(campaignId)}
              />
            </div>

            {audience && audience.enrollments.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">In this campaign ({audience.total})</p>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {audience.enrollments.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.candidate_name || e.candidate_email}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{e.candidate_email}</p>
                      </div>
                      <VerifChip status={e.email_status} />
                      <button onClick={() => removeEnrollee(e.id)} className="text-muted-foreground hover:text-red-400" aria-label="Remove"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">You can skip this and add candidates later — the campaign won&apos;t send to anyone until it has an audience.</p>
          </div>
        )}

        {/* ── Step 3: Sequence ── */}
        {step === 2 && (
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold">Build the sequence</h2>
              <p className="text-sm text-muted-foreground">The emails and timing. Use <code className="rounded bg-muted px-1 text-xs">{"{{first_name}}"}</code> and other tokens — they resolve per candidate.</p>
            </div>
            <CampaignBuilder draft={draft} setDraft={setDraft} onSave={() => {}} onCancel={onCancel} saving={saving} presets={presets} embedded />
          </div>
        )}

        {/* ── Step 4: AI replies ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">AI reply handling</h2>
              <p className="text-sm text-muted-foreground">When candidates reply, the AI SDR can draft grounded responses from a per-campaign knowledge base.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><Bot className="h-4.5 w-4.5 text-primary" /></span>
                <div className="flex-1">
                  <p className="text-sm font-medium">AI SDR</p>
                  <p className="text-[11px] text-muted-foreground">Draft-first by default. Add a knowledge base and choose draft or auto-send.</p>
                </div>
                <button onClick={() => setShowAi(true)} className="rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
                  Configure
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Optional — you can launch without it and every reply still lands in your inbox, auto-classified.</p>
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Review &amp; launch</h2>
              <p className="text-sm text-muted-foreground">Check readiness and see the exact email a candidate will get.</p>
            </div>

            {/* Readiness checklist */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Launch readiness</p>
              {!preflight ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : (
                <ul className="space-y-1.5">
                  {preflight.map((c) => (
                    <li key={c.key} className="flex items-start gap-2 text-sm">
                      {c.status === "pass" ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        : c.status === "warn" ? <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                      <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">— {c.detail}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Estimate + deliverability */}
            {(() => {
              const active = audience?.active ?? 0;
              const total = audience?.total ?? 0;
              const sendable = audience?.sendable ?? 0;
              const unverified = Math.max(0, total - sendable);
              const stepCount = draft.steps.length;
              const emails = active * stepCount;
              const seqDays = draft.steps.reduce((sum, s) => sum + Math.max(0, s.delay_days || 0), 0);
              const bs = audience?.by_status;
              return (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before you launch</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div><p className="text-lg font-semibold tabular-nums">{total}</p><p className="text-[11px] text-muted-foreground">Candidates</p></div>
                    <div><p className="text-lg font-semibold tabular-nums text-green-500">{sendable}</p><p className="text-[11px] text-muted-foreground">Deliverable</p></div>
                    <div><p className="text-lg font-semibold tabular-nums">{emails}</p><p className="text-[11px] text-muted-foreground">Emails ({stepCount} step{stepCount !== 1 ? "s" : ""})</p></div>
                    <div><p className="text-lg font-semibold tabular-nums">{seqDays}d</p><p className="text-[11px] text-muted-foreground">Sequence length</p></div>
                  </div>
                  {bs && (total > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {bs.valid > 0 && <VerifChip status="valid" />}
                      {bs.valid > 0 && <span className="text-[11px] text-muted-foreground">{bs.valid}</span>}
                      {bs.risky > 0 && <><VerifChip status="risky" /><span className="text-[11px] text-muted-foreground">{bs.risky}</span></>}
                      {bs.invalid > 0 && <><VerifChip status="invalid" /><span className="text-[11px] text-muted-foreground">{bs.invalid}</span></>}
                      {(bs.unknown + bs.none) > 0 && <><VerifChip status="unknown" /><span className="text-[11px] text-muted-foreground">{bs.unknown + bs.none}</span></>}
                    </div>
                  )}
                  {unverified > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-500">
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {unverified} candidate{unverified !== 1 ? "s" : ""} don&apos;t have a verified email. Reveal &amp; verify them first — auto-send only goes to verified or likely-valid addresses, and the rest risk bouncing.
                    </div>
                  )}
                  {total === 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">No audience yet — go back to the Audience step to add candidates before launching.</p>
                  )}
                </div>
              );
            })()}

            {/* Per-candidate preview */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email preview
                </p>
                {preview && preview.enrollments.length > 0 && (
                  <select
                    value={preview.candidate.id ?? ""}
                    onChange={(e) => campaignId && loadPreview(campaignId, e.target.value)}
                    className="max-w-[55%] truncate rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {preview.enrollments.map((en) => (
                      <option key={en.id} value={en.id}>{en.name || en.email}</option>
                    ))}
                  </select>
                )}
              </div>

              {previewLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : !canPreview ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No sequence steps to preview.</p>
              ) : (
                <>
                  {preview!.is_sample && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-500">
                      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      No candidates enrolled yet — showing sample values. Add candidates from <span className="inline-flex items-center gap-0.5 font-medium"><Search className="h-3 w-3" /> Search</span>, then re-check the preview.
                    </div>
                  )}
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Previewing as <span className="font-medium text-foreground">{preview!.candidate.name}</span>
                    {!preview!.is_sample && <> · {preview!.candidate.email}</>} · from {preview!.sender_name}
                  </p>
                  <div className="space-y-2.5">
                    {preview!.steps.map((s) => (
                      <div key={s.step_order} className="overflow-hidden rounded-xl border border-border">
                        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
                          <span className="text-[11px] font-semibold">Step {s.step_order + 1}</span>
                          <span className="text-[10px] text-muted-foreground">Day {s.day}</span>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="mb-1 text-sm font-semibold">{s.subject}</p>
                          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{s.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <X className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Footer nav */}
        <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
          <button
            onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button onClick={goNext} disabled={saving} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {step === 1 ? "Continue to sequence" : "Continue"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={saveDraft} disabled={saving} className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
                Save as draft
              </button>
              <button onClick={launch} disabled={saving} className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Launch
              </button>
            </div>
          )}
        </div>
      </div>

      {showAi && campaignId && (
        <AiSdrPanel campaignId={campaignId} campaignName={draft.name || "this campaign"} onClose={() => setShowAi(false)} />
      )}
    </div>
  );
}
