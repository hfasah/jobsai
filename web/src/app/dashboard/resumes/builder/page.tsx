"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, X, Plus, ArrowLeft, Check, AlertCircle } from "lucide-react";
import { TailoredOutput } from "@/components/resume/tailored-output";
import type { TailoredJson, TailorChange } from "@/types/phase3";

type BuildResult = {
  headline: string;
  summary: string;
  tailored_json: TailoredJson;
  changes: TailorChange[];
  skill_coverage: { covered: string[]; missing: string[] };
};

export default function ResumeBuilderPage() {
  const [skills, setSkills] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BuildResult | null>(null);

  const addSkill = (raw: string) => {
    const s = raw.trim().replace(/,$/, "");
    if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills((a) => [...a, s]);
    setInput("");
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(input); }
    else if (e.key === "Backspace" && !input && skills.length) setSkills((a) => a.slice(0, -1));
  };

  async function build() {
    if (skills.length === 0) { setError("Add at least one target skill."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/resumes/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills, role: role.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Build failed");
      setResult(json.data as BuildResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/resumes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Resume tools
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resume Builder</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Optimize your resume to surface the skills you&apos;re targeting — truthfully, from your real experience.
          </p>
        </div>
      </div>

      {/* Inputs */}
      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-semibold text-foreground">Target skills</label>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {s}
                <button onClick={() => setSkills((a) => a.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => input && addSkill(input)}
              placeholder={skills.length ? "Add another…" : "e.g. Kubernetes, Terraform, Python"}
              className="h-7 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Press Enter or comma to add each skill.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground">Target role <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior DevOps Engineer"
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button onClick={build} disabled={loading} className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm disabled:opacity-70">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Optimizing…</> : <><Plus className="h-4 w-4" /> Build optimized resume</>}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Skill coverage</h2>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-emerald-400">Covered ({result.skill_coverage.covered.length})</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {result.skill_coverage.covered.length
                    ? result.skill_coverage.covered.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400"><Check className="h-3 w-3" /> {s}</span>
                      ))
                    : <span className="text-xs text-muted-foreground">None yet.</span>}
                </div>
              </div>
              {result.skill_coverage.missing.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--cta)]">Not yet evidenced ({result.skill_coverage.missing.length})</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.skill_coverage.missing.map((s) => (
                      <span key={s} className="rounded-full bg-[var(--cta)]/10 px-2.5 py-1 text-xs text-[var(--cta)]">{s}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">We won&apos;t fabricate these — consider gaining or adding real evidence for them.</p>
                </div>
              )}
            </div>
          </div>

          <TailoredOutput tj={result.tailored_json} changes={result.changes} />
        </div>
      )}
    </main>
  );
}
