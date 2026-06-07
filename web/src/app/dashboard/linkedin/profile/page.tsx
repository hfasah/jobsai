"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wand2, Loader2, ArrowLeft, Copy, Check, Save, RefreshCw,
  AlertCircle, Sparkles, Gauge,
} from "lucide-react";
import type { LinkedInProfile, LinkedInSuggestion, LinkedInExperienceRewrite } from "@/types/linkedin";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard blocked — no-op */ }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-desyn-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

const SEV_STYLES: Record<LinkedInSuggestion["severity"], string> = {
  high: "border-destructive/30 bg-destructive/5 text-destructive",
  medium: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  low: "border-border bg-muted/40 text-muted-foreground",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "text-desyn-success" : score >= 50 ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2.5">
      <Gauge className={`h-5 w-5 ${color}`} />
      <div>
        <div className="text-xs text-muted-foreground">Current profile strength</div>
        <div className={`text-lg font-bold tabular-nums ${color}`}>{score}<span className="text-sm text-muted-foreground">/100</span></div>
      </div>
    </div>
  );
}

export default function LinkedInProfilePage() {
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  // Editable fields
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState("");

  const hydrate = useCallback((p: LinkedInProfile) => {
    setProfile(p);
    setHeadline(p.headline ?? "");
    setAbout(p.about ?? "");
    setSkills((p.skills ?? []).join(", "));
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/linkedin/profile")
      .then((r) => r.json())
      .then((j) => { if (active && j.data) hydrate(j.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [hydrate]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/profile", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Optimization failed");
      hydrate(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/linkedin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          about,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setProfile(json.data);
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const rewrites = (profile?.experience_rewrites ?? []) as LinkedInExperienceRewrite[];
  const suggestions = (profile?.suggestions ?? []) as LinkedInSuggestion[];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/linkedin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> LinkedIn
      </Link>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile Optimizer</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              We use your primary resume to rewrite your LinkedIn profile for recruiters and search.
            </p>
          </div>
        </div>
        {profile && (
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </button>
        )}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !profile ? (
        /* Empty state */
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Optimize your LinkedIn profile</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            We&apos;ll read your primary resume and craft an optimized headline, About section,
            experience, and skills — plus a strength score and fixes.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="btn-cta mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm disabled:opacity-70"
          >
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Optimizing…</> : <><Wand2 className="h-4 w-4" /> Optimize my profile</>}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            No resume yet? <Link href="/dashboard/resumes" className="text-primary hover:underline">Add one first</Link>.
          </p>
        </div>
      ) : (
        /* Result */
        <div className="mt-6 space-y-6">
          {typeof profile.score === "number" && <ScoreRing score={profile.score} />}

          {/* Headline */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Headline</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{headline.length}/220</span>
                <CopyButton text={headline} />
              </div>
            </div>
            <textarea
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={220}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </section>

          {/* About */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">About</h3>
              <CopyButton text={about} />
            </div>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={10}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
            />
          </section>

          {/* Skills */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-2 text-sm font-semibold">Recommended skills</h3>
            <p className="mb-2 text-xs text-muted-foreground">Comma-separated. Add these under your LinkedIn “Skills” section.</p>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </section>

          {/* Save bar */}
          <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-xl border border-border bg-card/90 p-3 backdrop-blur">
            {savedNote && <span className="text-sm text-desyn-success">Saved</span>}
            <button
              onClick={save}
              disabled={saving}
              className="btn-cta inline-flex h-10 items-center gap-2 rounded-xl px-5 text-sm disabled:opacity-70"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>

          {/* Experience rewrites */}
          {rewrites.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Experience rewrites</h3>
              {rewrites.map((r, i) => {
                const block = `${r.rewrite}\n\n${(r.bullets ?? []).map((b) => `• ${b}`).join("\n")}`;
                return (
                  <div key={i} className="rounded-2xl border border-border bg-card p-5">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.company}</p>
                      </div>
                      <CopyButton text={block} />
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{r.rewrite}</p>
                    {(r.bullets ?? []).length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {r.bullets.map((b, j) => (
                          <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                            <span className="text-primary">•</span><span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Prioritized fixes</h3>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <div key={i} className={`rounded-xl border p-3.5 text-sm ${SEV_STYLES[s.severity] ?? SEV_STYLES.low}`}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-background/60 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{s.area}</span>
                      <span className="text-[11px] font-medium uppercase opacity-70">{s.severity}</span>
                    </div>
                    <p className="mt-1.5 font-medium text-foreground">{s.issue}</p>
                    <p className="mt-0.5 text-muted-foreground">{s.action}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
