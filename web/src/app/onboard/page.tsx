"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, User, Target, Zap,
  CheckCircle2, Loader2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadZone, UploadProgress } from "@/components/resume/upload-zone";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { LocationType } from "@/types/preferences";
import { LOCATION_TYPE_LABELS } from "@/types/preferences";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type UploadState =
  | { type: "idle" }
  | { type: "uploading"; progress: number; abort?: AbortController }
  | { type: "processing"; versionId: string }
  | { type: "done"; name: string }
  | { type: "error"; message: string };

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface PrefsForm {
  job_titles: string[];
  location_type: LocationType;
  min_salary: string;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS: { label: string; icon: React.ElementType }[] = [
  { label: "Resume",      icon: Upload },
  { label: "Profile",     icon: User },
  { label: "Targets",     icon: Target },
  { label: "Auto-apply",  icon: Zap },
];

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map(({ label }, i) => {
        const n = (i + 1) as Step;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  done  && "border-desyn-success bg-desyn-success/10 text-desyn-success",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-card text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span className={cn(
                "hidden text-xs font-medium sm:block",
                active ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "mx-2 mb-5 h-0.5 w-10 sm:w-16 rounded-full transition-colors",
                done ? "bg-desyn-success/50" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Resume upload ───────────────────────────────────────────────────

function StepResume({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.type !== "processing") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const { versionId } = state;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/resumes/versions/${versionId}`);
      if (!res.ok) return;
      const json = await res.json();
      const v = json.data;
      if (v.parse_status === "parsed" || v.parse_status === "partial") {
        clearInterval(pollRef.current!);
        setState({ type: "done", name: v.file_name ?? "Resume" });
      } else if (v.parse_status === "failed") {
        clearInterval(pollRef.current!);
        setState({ type: "error", message: v.parse_error_msg ?? "Parsing failed." });
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state]);

  const handleFile = async (file: File) => {
    const abort = new AbortController();
    setState({ type: "uploading", progress: 0, abort });

    const formData = new FormData();
    formData.append("file", file);

    let prog = 0;
    const ticker = setInterval(() => {
      prog = Math.min(prog + 12, 85);
      setState({ type: "uploading", progress: prog, abort });
    }, 200);

    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
        signal: abort.signal,
      });
      clearInterval(ticker);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setState({ type: "error", message: json.error ?? "Upload failed." });
        return;
      }
      setState({ type: "uploading", progress: 100, abort });
      const { resume_version_id } = await res.json();
      setState({ type: "processing", versionId: resume_version_id });
    } catch (err: unknown) {
      clearInterval(ticker);
      if (err instanceof Error && err.name === "AbortError") { setState({ type: "idle" }); return; }
      setState({ type: "error", message: "Upload failed. Please try again." });
    }
  };

  if (state.type === "done") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-xl border border-desyn-success/30 bg-desyn-success/5 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-desyn-success" />
          <div>
            <p className="font-medium text-foreground">Resume uploaded</p>
            <p className="text-sm text-muted-foreground">{state.name} — AI parsed your profile</p>
          </div>
        </div>
        <Button className="w-full" onClick={onDone}>
          Continue to profile <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.type === "idle" && (
        <>
          <UploadZone onFileSelected={handleFile} />
          <button
            onClick={onSkip}
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip for now — I&apos;ll upload later
          </button>
        </>
      )}
      {(state.type === "uploading") && (
        <UploadProgress
          state="uploading"
          progress={state.progress}
          onCancel={() => { state.abort?.abort(); setState({ type: "idle" }); }}
        />
      )}
      {state.type === "processing" && <UploadProgress state="processing" />}
      {state.type === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Upload failed</p>
          <p className="mt-0.5 text-muted-foreground">{state.message}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setState({ type: "idle" })}>
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Profile ─────────────────────────────────────────────────────────

function StepProfile({
  prefill,
  onDone,
  onSkip,
}: {
  prefill: Partial<ProfileForm> | null;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [form, setForm] = useState<ProfileForm>({
    first_name: prefill?.first_name ?? "",
    last_name:  prefill?.last_name  ?? "",
    email:      prefill?.email      ?? "",
    phone:      prefill?.phone      ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ProfileForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/apply-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name || null,
          last_name:  form.last_name  || null,
          email:      form.email      || null,
          phone:      form.phone      || null,
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {([ ["first_name", "First name", "Jane"], ["last_name", "Last name", "Smith"] ] as const).map(([k, label, ph]) => (
          <div key={k}>
            <label className="mb-1.5 block text-sm font-medium">{label}</label>
            <input
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
              placeholder={ph}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="jane@example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+1 555 000 0000"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Pre-filled from your resume where possible. You can edit everything later.
      </p>
      <div className="flex items-center gap-3 pt-1">
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save &amp; continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Targets ─────────────────────────────────────────────────────────

function StepTargets({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [form, setForm] = useState<PrefsForm>({
    job_titles: [],
    location_type: "any",
    min_salary: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_titles: form.job_titles,
          location_type: form.location_type,
          min_salary: form.min_salary ? Number(form.min_salary) : null,
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Target job titles</label>
        <TagInput
          value={form.job_titles}
          onChange={(v) => setForm((f) => ({ ...f, job_titles: v }))}
          placeholder="e.g. Senior Frontend Engineer — press Enter to add"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Add every variation — drives daily auto-discovery.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Work type</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm((f) => ({ ...f, location_type: v }))}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                form.location_type === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Minimum salary (optional)</label>
        <input
          type="number"
          min={0}
          step={5000}
          value={form.min_salary}
          onChange={(e) => setForm((f) => ({ ...f, min_salary: e.target.value }))}
          placeholder="e.g. 120000"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          className="flex-1"
          onClick={save}
          disabled={saving || form.job_titles.length === 0}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save &amp; continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button onClick={onSkip} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Auto-apply ──────────────────────────────────────────────────────

function StepLaunch({ onDone }: { onDone: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(75);
  const [saving, setSaving] = useState(false);

  const launch = async () => {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_apply_enabled: enabled, auto_apply_threshold: threshold }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable auto-apply</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              We'll automatically submit applications as matching jobs are discovered.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors cursor-pointer",
              enabled ? "border-primary bg-primary" : "border-border bg-muted"
            )}
          >
            <span className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>

        {enabled && (
          <div className="mt-4 border-t border-border pt-4">
            <label className="mb-2 block text-sm font-medium">
              Minimum match score to auto-apply
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 cursor-pointer"
              />
              <span className="w-12 text-right text-sm font-bold tabular-nums">
                {threshold}%
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>50 — cast wide net</span>
              <span>100 — perfect match only</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        You can change this at any time in Preferences. Auto-apply only works for platforms we can submit to directly (Lever, Ashby). Others will be flagged for your review.
      </p>

      <Button className="w-full" size="lg" onClick={launch} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
        Launch my dashboard
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [prefill, setPrefill] = useState<Partial<ProfileForm> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/onboard/status")
      .then((r) => r.json())
      .then((json) => {
        if (json.has_preferences) {
          router.replace("/dashboard");
          return;
        }
        if (json.has_profile) { setStep(3); }
        else if (json.has_resume) { setStep(2); }
        if (json.prefill) setPrefill(json.prefill);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 4) as Step), []);
  const goToDashboard = useCallback(() => router.push("/dashboard"), [router]);

  const stepTitles: Record<Step, { heading: string; sub: string }> = {
    1: { heading: "Upload your resume",   sub: "We'll parse your skills and experience automatically." },
    2: { heading: "Your contact details", sub: "Used for every auto-apply submission." },
    3: { heading: "What are you looking for?", sub: "Drives daily job discovery and matching." },
    4: { heading: "Enable auto-apply",    sub: "Let the AI apply while you focus on interviews." },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* minimal header */}
      <header className="border-b border-border bg-card/80 px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-xl items-center">
          <span className="text-lg font-semibold">
            <span className="text-desyn-brand">{APP_NAME}</span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-10 sm:px-6">
        {!ready ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Stepper current={step} />

            <div className="mt-10">
              <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
                Step {step} of 4
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {stepTitles[step].heading}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {stepTitles[step].sub}
              </p>
            </div>

            <div className="mt-8">
              {step === 1 && <StepResume onDone={next} onSkip={goToDashboard} />}
              {step === 2 && <StepProfile prefill={prefill} onDone={next} onSkip={next} />}
              {step === 3 && <StepTargets onDone={next} onSkip={next} />}
              {step === 4 && <StepLaunch onDone={goToDashboard} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
