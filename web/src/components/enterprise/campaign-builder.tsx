"use client";

import { useState } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Clock, Mail,
  Loader2, X, Wand2, FlaskConical, CalendarClock, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CAMPAIGN_VARS, type CampaignStepInput, type CampaignPreset } from "@/lib/campaigns";

export interface BuilderStep extends CampaignStepInput {
  _key: string;
  _abOpen?: boolean; // UI-only: A/B panel expanded before any variant text typed
}

export interface SendWindowDraft {
  enabled: boolean;
  start: number;              // local hour 0-23
  end: number;                // local hour 1-24
  timezone: string;           // IANA name
  business_days_only: boolean;
}

export interface CampaignDraft {
  name: string;
  description: string;
  steps: BuilderStep[];
  sendWindow: SendWindowDraft;
}

let _k = 0;
const newKey = () => `s${Date.now()}-${_k++}`;

function localTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

function defaultWindow(): SendWindowDraft {
  return { enabled: false, start: 8, end: 17, timezone: localTz(), business_days_only: true };
}

function blankStep(delay = 2): BuilderStep {
  return { _key: newKey(), delay_days: delay, subject: "", body: "", ai_personalize: false, ai_prompt: "", ab_subject: "", ab_body: "" };
}

export function emptyDraft(): CampaignDraft {
  return { name: "", description: "", steps: [{ ...blankStep(0) }], sendWindow: defaultWindow() };
}

export function presetToDraft(p: CampaignPreset): CampaignDraft {
  return {
    name: p.name,
    description: p.description,
    steps: p.steps.map((s) => ({ ...s, _key: newKey(), ai_prompt: s.ai_prompt ?? "", ab_subject: "", ab_body: "" })),
    sendWindow: defaultWindow(),
  };
}

export function draftFromCampaign(c: {
  name: string; description: string | null;
  send_window_start?: number | null; send_window_end?: number | null;
  send_timezone?: string | null; business_days_only?: boolean;
  steps: { delay_days: number; subject: string; body: string; ai_personalize: boolean; ai_prompt: string | null; ab_subject?: string | null; ab_body?: string | null; skip_if_in_pipeline?: boolean }[];
}): CampaignDraft {
  const win = defaultWindow();
  return {
    name: c.name,
    description: c.description ?? "",
    steps: (c.steps.length ? c.steps : [{ delay_days: 0, subject: "", body: "", ai_personalize: false, ai_prompt: "" }]).map((s) => ({
      _key: newKey(),
      delay_days: s.delay_days,
      subject: s.subject,
      body: s.body,
      ai_personalize: s.ai_personalize,
      ai_prompt: s.ai_prompt ?? "",
      ab_subject: s.ab_subject ?? "",
      ab_body: s.ab_body ?? "",
      skip_if_in_pipeline: s.skip_if_in_pipeline ?? false,
    })),
    sendWindow: {
      enabled: c.send_window_start != null && c.send_window_end != null,
      start: c.send_window_start ?? win.start,
      end: c.send_window_end ?? win.end,
      timezone: c.send_timezone ?? win.timezone,
      business_days_only: c.business_days_only ?? true,
    },
  };
}

export function CampaignBuilder({
  draft, setDraft, onSave, onCancel, saving, presets, embedded = false, campaignId = null,
}: {
  draft: CampaignDraft;
  setDraft: (d: CampaignDraft) => void;
  onSave: (activate: boolean) => void;
  onCancel: () => void;
  saving: boolean;
  presets: CampaignPreset[];
  // When embedded in the guided wizard, the wizard owns navigation — hide the
  // builder's own Save/Cancel footer.
  embedded?: boolean;
  // Enables the per-step "Send test" (needs a saved campaign for context).
  campaignId?: string | null;
}) {
  const [showPresets, setShowPresets] = useState(false);
  const [focusedField, setFocusedField] = useState<{ i: number; field: "subject" | "body" } | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const sendTest = async (i: number) => {
    if (!campaignId) return;
    const step = draft.steps[i];
    if (!step.subject.trim() || !step.body.trim()) { setTestMsg("Fill in the subject and body first."); return; }
    setTesting(i);
    setTestMsg(null);
    const res = await fetch(`/api/enterprise/campaigns/${campaignId}/send-test`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: step.subject, body: step.body, to: testEmail.trim() || undefined }),
    });
    const j = await res.json().catch(() => ({}));
    setTesting(null);
    // Keep the confirmation up (no auto-dismiss) so you always know where it went.
    setTestMsg(res.ok ? `✓ Test sent to ${j.data?.sent_to}${j.data?.sent_from ? ` (from ${j.data.sent_from})` : ""} — check inbox & spam.` : (j.error ?? "Could not send test."));
  };

  const patchStep = (i: number, patch: Partial<BuilderStep>) => {
    const steps = draft.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    setDraft({ ...draft, steps });
  };
  const addStep = () => setDraft({ ...draft, steps: [...draft.steps, blankStep(3)] });
  const removeStep = (i: number) =>
    setDraft({ ...draft, steps: draft.steps.filter((_, idx) => idx !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    setDraft({ ...draft, steps });
  };

  // Insert a {{token}} into whichever field was last focused.
  const insertVar = (token: string) => {
    if (!focusedField) return;
    const { i, field } = focusedField;
    patchStep(i, { [field]: `${draft.steps[i][field]}{{${token}}}` } as Partial<BuilderStep>);
  };

  // Cumulative day offset shown on each step (day N from enrollment).
  const cumDays: number[] = [];
  draft.steps.reduce((sum, s) => {
    const next = sum + Math.max(0, s.delay_days || 0);
    cumDays.push(next);
    return next;
  }, 0);

  return (
    <div className="mx-auto max-w-3xl">
      {campaignId && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          <span className="shrink-0 text-muted-foreground">Send tests to</span>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your account email (default)"
            className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="shrink-0 text-[10px] text-muted-foreground">Sends from your campaign mailbox — check inbox &amp; spam.</span>
        </div>
      )}
      {testMsg && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">{testMsg}</div>
      )}
      {/* Campaign meta */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Campaign name (e.g. Senior Engineer Nurture)"
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => setShowPresets((s) => !s)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Wand2 className="h-3.5 w-3.5" /> Start from template
          </button>
        </div>
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Optional description — who this sequence is for"
          className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />

        {showPresets && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => { setDraft(presetToDraft(p)); setShowPresets(false); }}
                className="rounded-xl border border-border bg-muted/30 p-3 text-left transition-colors hover:border-primary"
              >
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                <p className="mt-1.5 text-[11px] font-medium text-primary">{p.steps.length} steps</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variable chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Insert:</span>
        {CAMPAIGN_VARS.map((v) => (
          <button
            key={v}
            onClick={() => insertVar(v)}
            disabled={!focusedField}
            className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {draft.steps.map((step, i) => {
          const cum = cumDays[i];
          return (
            <div key={step._key} className="relative rounded-2xl border border-border bg-card p-4">
              {/* Step header */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </span>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">Day {cum}</span>
                </div>
                <div className="flex items-center gap-1">
                  {campaignId && (
                    <button onClick={() => sendTest(i)} disabled={testing === i} title="Send a test to yourself" className="inline-flex items-center gap-1 rounded p-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50">
                      {testing === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Test
                    </button>
                  )}
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === draft.steps.length - 1} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => removeStep(i)} disabled={draft.steps.length === 1} className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              {/* Delay */}
              <div className="mb-3 flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{i === 0 ? "Send" : "Wait"}</span>
                <input
                  type="number" min={0} max={60}
                  value={step.delay_days}
                  onChange={(e) => patchStep(i, { delay_days: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:border-primary"
                />
                <span className="text-muted-foreground">
                  {i === 0 ? "days after enrollment" : "days after the previous step"}
                </span>
              </div>

              {/* Subject */}
              <input
                value={step.subject}
                onChange={(e) => patchStep(i, { subject: e.target.value })}
                onFocus={() => setFocusedField({ i, field: "subject" })}
                placeholder="Subject line"
                className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
              />

              {/* Body */}
              <textarea
                value={step.body}
                onChange={(e) => patchStep(i, { body: e.target.value })}
                onFocus={() => setFocusedField({ i, field: "body" })}
                rows={5}
                placeholder="Write your email. Use the variable chips above to personalize."
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
              />

              {/* AI personalization */}
              <div className={cn("mt-2 rounded-xl border p-2.5 transition-colors", step.ai_personalize ? "border-primary/40 bg-primary/5" : "border-border")}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => patchStep(i, { ai_personalize: !step.ai_personalize })}
                    className={cn("mt-0.5 relative h-5 w-9 shrink-0 rounded-full transition-colors", step.ai_personalize ? "bg-primary" : "bg-muted")}
                  >
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", step.ai_personalize ? "left-[18px]" : "left-0.5")} />
                  </button>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Sparkles className={cn("h-3.5 w-3.5", step.ai_personalize ? "text-primary" : "text-muted-foreground")} />
                      AI-personalize each email
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The LLM rewrites this email for every candidate at send time — warmer, more natural, still on-message.
                    </p>
                  </div>
                </label>
                {step.ai_personalize && (
                  <input
                    value={step.ai_prompt ?? ""}
                    onChange={(e) => patchStep(i, { ai_prompt: e.target.value })}
                    placeholder="Optional AI guidance (e.g. 'reference their open-source work, keep it under 80 words')"
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                  />
                )}
              </div>

              {/* A/B test variant B */}
              {(() => {
                const abOn = (step.ab_subject ?? "") !== "" || (step.ab_body ?? "") !== "" || step._abOpen;
                return (
                  <div className={cn("mt-2 rounded-xl border p-2.5 transition-colors", abOn ? "border-amber-500/40 bg-amber-500/5" : "border-border")}>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (abOn) patchStep(i, { ab_subject: "", ab_body: "", _abOpen: false });
                          else patchStep(i, { _abOpen: true });
                        }}
                        className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", abOn ? "bg-amber-500" : "bg-muted")}
                      >
                        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", abOn ? "left-[18px]" : "left-0.5")} />
                      </button>
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <FlaskConical className={cn("h-3.5 w-3.5", abOn ? "text-amber-400" : "text-muted-foreground")} />
                        A/B test this step
                      </p>
                      <span className="text-xs text-muted-foreground">Candidates split 50/50; the split is consistent across the sequence.</span>
                    </label>
                    {abOn && (
                      <div className="mt-2 space-y-2 border-l-2 border-amber-500/30 pl-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/80">Variant B</p>
                        <input
                          value={step.ab_subject ?? ""}
                          onChange={(e) => patchStep(i, { ab_subject: e.target.value })}
                          placeholder="Variant B subject line"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-amber-500"
                        />
                        <textarea
                          value={step.ab_body ?? ""}
                          onChange={(e) => patchStep(i, { ab_body: e.target.value })}
                          rows={4}
                          placeholder="Variant B email body"
                          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-amber-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Condition: skip follow-ups for candidates already progressed */}
              {i > 0 && (
                <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-2.5">
                  <input
                    type="checkbox"
                    checked={!!step.skip_if_in_pipeline}
                    onChange={(e) => patchStep(i, { skip_if_in_pipeline: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Skip if already in pipeline</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">Don&apos;t send this step to a candidate who already has an application in your pipeline.</span>
                  </span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addStep}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add step
      </button>

      {/* Send window */}
      <div className={cn("mt-4 rounded-2xl border p-4 transition-colors", draft.sendWindow.enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card")}>
        <label className="flex cursor-pointer items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, sendWindow: { ...draft.sendWindow, enabled: !draft.sendWindow.enabled } })}
            className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", draft.sendWindow.enabled ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", draft.sendWindow.enabled ? "left-[18px]" : "left-0.5")} />
          </button>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CalendarClock className={cn("h-4 w-4", draft.sendWindow.enabled ? "text-primary" : "text-muted-foreground")} />
            Only send during business hours
          </p>
        </label>
        {draft.sendWindow.enabled && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-11 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Between</span>
              <select
                value={draft.sendWindow.start}
                onChange={(e) => setDraft({ ...draft, sendWindow: { ...draft.sendWindow, start: Number(e.target.value) } })}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
              >
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h.toString().padStart(2, "0")}:00`}</option>)}
              </select>
              <span className="text-muted-foreground">and</span>
              <select
                value={draft.sendWindow.end}
                onChange={(e) => setDraft({ ...draft, sendWindow: { ...draft.sendWindow, end: Number(e.target.value) } })}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
              >
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{`${h.toString().padStart(2, "0")}:00`}</option>)}
              </select>
            </span>
            <input
              value={draft.sendWindow.timezone}
              onChange={(e) => setDraft({ ...draft, sendWindow: { ...draft.sendWindow, timezone: e.target.value } })}
              placeholder="Timezone (IANA)"
              className="w-48 rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
            />
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.sendWindow.business_days_only}
                onChange={(e) => setDraft({ ...draft, sendWindow: { ...draft.sendWindow, business_days_only: e.target.checked } })}
                className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
              />
              Weekdays only
            </label>
          </div>
        )}
      </div>

      {/* Footer actions — hidden when the wizard drives navigation. */}
      {!embedded && (
        <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
          <button onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" /> Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(false)}
              disabled={saving}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Save draft
            </button>
            <button
              onClick={() => onSave(true)}
              disabled={saving}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Save & activate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
