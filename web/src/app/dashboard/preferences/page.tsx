"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Save, Check, Zap, IdCard, ArrowRight, Bot, Eye, Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PREFERENCES,
  LOCATION_TYPE_LABELS,
  EMPLOYMENT_TYPE_OPTIONS,
  SENIORITY_OPTIONS,
  CURRENCY_OPTIONS,
  type LocationType,
  type EmploymentType,
  type SeniorityLevel,
  type PreferencesUpdate,
} from "@/types/preferences";

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium">{children}</label>;
}

function CheckPill<T extends string>({
  value, label, checked, onChange,
}: { value: T; label: string; checked: boolean; onChange: (v: T, on: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value, !checked)}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        checked
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<PreferencesUpdate>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((j) => { if (j.data) setPrefs(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PreferencesUpdate>(key: K, value: PreferencesUpdate[K]) => {
    setSaved(false);
    setError(null);
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const toggleList = <T extends string>(
    key: keyof PreferencesUpdate,
    item: T,
    on: boolean
  ) => {
    const list = (prefs[key] as T[]) ?? [];
    set(key, on ? [...list, item] : list.filter((v) => v !== item));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 5000); // reset after 5s
      } else {
        setError(json?.error || "Failed to save preferences");
        console.error("Preferences save failed:", json);
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Preferences save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
          Job search profile
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell the system what you&apos;re looking for. This drives auto job discovery and auto-apply in the next phases.
        </p>

        {/* Cross-link: eligibility / personal info lives in the Apply Profile */}
        <Link href="/dashboard/apply-profile"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white">
            <IdCard className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Application details &amp; eligibility →</p>
            <p className="text-xs text-muted-foreground">
              Work authorization / permit, sponsorship, relocation, driver&apos;s license, personal info, references &amp; EEO are in your <span className="font-medium text-foreground">Apply Profile</span> — used to auto-fill applications.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
        </Link>

        <div className="mt-8 space-y-10">

          {/* ── What you're looking for ── */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader
              title="What you're looking for"
              description="Add every title variation that fits — the discovery engine searches all of them."
            />
            <div className="space-y-5">
              <div>
                <FieldLabel>Target job titles</FieldLabel>
                <TagInput
                  value={prefs.job_titles}
                  onChange={(v) => set("job_titles", v)}
                  placeholder="e.g. Senior Frontend Engineer — press Enter to add"
                />
              </div>
              <div>
                <FieldLabel>Additional keywords</FieldLabel>
                <TagInput
                  value={prefs.keywords}
                  onChange={(v) => set("keywords", v)}
                  placeholder="e.g. React, TypeScript, remote-first"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Boosts discovery for niche skills or industry terms not in your title.
                </p>
              </div>
            </div>
          </section>

          {/* ── Where ── */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader title="Where" />
            <div className="space-y-5">
              <div>
                <FieldLabel>Work type</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("location_type", value)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                        prefs.location_type === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {prefs.location_type !== "remote" && (
                <div>
                  <FieldLabel>Preferred locations</FieldLabel>
                  <TagInput
                    value={prefs.locations}
                    onChange={(v) => set("locations", v)}
                    placeholder="e.g. New York, NY · London, UK"
                  />
                </div>
              )}
            </div>
          </section>

          {/* ── Compensation ── */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader
              title="Compensation"
              description="Set a minimum so the discovery engine can filter out roles below your floor."
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <FieldLabel>Minimum annual salary</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={prefs.min_salary ?? ""}
                  onChange={(e) => set("min_salary", e.target.value ? Number(e.target.value) : null)}
                  placeholder="e.g. 120000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="w-28">
                <FieldLabel>Currency</FieldLabel>
                <select
                  value={prefs.salary_currency}
                  onChange={(e) => set("salary_currency", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Job type ── */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader title="Job type" />
            <div className="space-y-5">
              <div>
                <FieldLabel>Employment type</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYMENT_TYPE_OPTIONS.map(({ value, label }) => (
                    <CheckPill
                      key={value}
                      value={value}
                      label={label}
                      checked={prefs.employment_types.includes(value as EmploymentType)}
                      onChange={(v, on) => toggleList("employment_types", v, on)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Leave empty to match any type.</p>
              </div>
              <div>
                <FieldLabel>Seniority level</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {SENIORITY_OPTIONS.map(({ value, label }) => (
                    <CheckPill
                      key={value}
                      value={value}
                      label={label}
                      checked={prefs.seniority_levels.includes(value as SeniorityLevel)}
                      onChange={(v, on) => toggleList("seniority_levels", v, on)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Leave empty to match any level.</p>
              </div>
            </div>
          </section>

          {/* ── Exclusions ── */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader
              title="Block list"
              description="Never auto-apply to these — e.g. a current or former employer. Blocked jobs are flagged in Job Search too, not just skipped."
            />
            <p className="mb-1.5 text-sm font-medium">Companies</p>
            <TagInput
              value={prefs.excluded_companies}
              onChange={(v) => set("excluded_companies", v)}
              placeholder="e.g. Acme Corp"
            />
            <p className="mb-1.5 mt-4 text-sm font-medium">Domains</p>
            <TagInput
              value={prefs.blocked_domains}
              onChange={(v) => set("blocked_domains", v)}
              placeholder="e.g. acme.com"
            />
          </section>

          {/* ── Auto-apply ── */}
          <section id="auto-apply" className="rounded-2xl border border-border bg-card p-6">
            <SectionHeader
              title="How should we apply for jobs?"
              description="JobsAI finds matching jobs daily and applies on your behalf — pick how much control you want."
            />

            {/* Mode selector */}
            <div className="space-y-3">
              {([
                {
                  mode: "auto" as const,
                  icon: Bot,
                  label: "Auto mode",
                  tag: "Save time, no approval needed",
                  tagColor: "text-desyn-success bg-desyn-success/10",
                  desc: "Fully hands-off. Maximum speed. Our AI agent finds and applies to matching jobs for you.",
                },
                {
                  mode: "hybrid" as const,
                  icon: Shuffle,
                  label: "Hybrid mode",
                  tag: "Best of both worlds",
                  tagColor: "text-primary bg-primary/10",
                  desc: `Best balance of speed and control. We auto-apply to high-fit roles (${prefs.auto_apply_threshold}%+ match). You decide on the rest.`,
                },
                {
                  mode: "review" as const,
                  icon: Eye,
                  label: "Review mode",
                  tag: "Review and approve each job",
                  tagColor: "text-muted-foreground bg-muted",
                  desc: "Full control. Nothing sent without your approval. Review every match. Our agent handles the application once you approve.",
                },
              ] as const).map(({ mode, icon: Icon, label, tag, tagColor, desc }) => {
                const selected = (prefs.auto_apply_mode ?? "hybrid") === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      set("auto_apply_mode", mode);
                      set("auto_apply_enabled", true);
                      set("require_approval", mode === "review");
                    }}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">{label}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tagColor)}>{tag}</span>
                      </div>
                      <div className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                        selected ? "border-primary bg-primary" : "border-border"
                      )}>
                        {selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                    <p className="mt-2 pl-11 text-sm text-muted-foreground">{desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Threshold slider */}
            <div className="mt-5">
              <FieldLabel>Minimum match score threshold</FieldLabel>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={prefs.auto_apply_threshold}
                  onChange={(e) => set("auto_apply_threshold", Number(e.target.value))}
                  className="flex-1 cursor-pointer"
                />
                <span className="w-12 text-right text-sm font-bold tabular-nums text-primary">
                  {prefs.auto_apply_threshold}%
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>50% — cast a wide net</span>
                <span>100% — perfect match only</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                In <strong className="text-foreground">Hybrid mode</strong>, jobs above this score are auto-applied; below it goes to your review queue.
              </p>
            </div>

            {/* CC email copy */}
            <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-medium">Receive copies in your email</p>
                <p className="text-sm text-muted-foreground">Get a confirmation email for every application submitted.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.cc_email_enabled}
                onClick={() => set("cc_email_enabled", !prefs.cc_email_enabled)}
                className={cn(
                  "relative h-6 w-11 rounded-full border-2 transition-colors cursor-pointer",
                  prefs.cc_email_enabled ? "border-primary bg-primary" : "border-border bg-muted"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  prefs.cc_email_enabled ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </section>

          {/* ── Save ── */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex items-center gap-4 pb-4">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : saved ? (
                <><Check className="mr-2 h-4 w-4" />Saved</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Save preferences</>
              )}
            </Button>
            {saved && (
              <p className="flex items-center gap-1.5 text-sm text-desyn-success">
                <Zap className="h-4 w-4" />
                Your preferences are saved and ready for auto discovery.
              </p>
            )}
          </div>

        </div>
      </main>
    </>
  );
}
