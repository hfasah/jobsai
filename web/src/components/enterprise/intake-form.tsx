"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TOOL_GROUPS, TOOL_PREFS, EMPLOYEE_BANDS, HIRING_BANDS,
  type ToolPref, type Suggestion,
} from "@/lib/enterprise-intake";

const PREF_STYLE: Record<ToolPref, string> = {
  need: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
  want: "border-blue-600 bg-blue-600 text-white shadow-sm",
  unsure: "border-amber-600 bg-amber-600 text-white shadow-sm",
  no: "border-red-600 bg-red-600 text-white shadow-sm",
};

export function IntakeForm() {
  const [form, setForm] = useState({
    company: "", website: "", contact_name: "", contact_email: "", contact_phone: "",
    num_employees: "", num_recruiters: "", hiring_volume: "", industry: "", current_tools: "", notes: "",
  });
  const [prefs, setPrefs] = useState<Record<string, ToolPref>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState<Suggestion | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setPref = (key: string, v: ToolPref) => setPrefs((p) => ({ ...p, [key]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending"); setError("");
    try {
      const res = await fetch("/api/enterprise/intake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tool_prefs: prefs }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not submit."); setState("error"); return; }
      setSuggested(json.suggested ?? null);
      setState("done");
    } catch { setError("Could not submit."); setState("error"); }
  };

  if (state === "done") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="mt-4 text-xl font-bold">Thanks — we&apos;ve got it!</h2>
        <p className="mt-2 text-muted-foreground">
          Our team will review your needs for <strong>{form.company}</strong> and follow up shortly to set up your workspace.
        </p>
        {suggested && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Recommended plan</p>
            <p className="mt-1 text-2xl font-bold">{suggested.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{suggested.reasons[0]}</p>
          </div>
        )}
      </div>
    );
  }

  const inputCls = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-8">
      {/* Company & contact */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">About your company</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-sm font-medium">Company name *</label><input required value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} placeholder="Acme Talent" /></div>
          <div><label className="mb-1 block text-sm font-medium">Website</label><input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="acme.com" /></div>
          <div><label className="mb-1 block text-sm font-medium">Your name *</label><input required value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className={inputCls} placeholder="Jane Doe" /></div>
          <div><label className="mb-1 block text-sm font-medium">Work email *</label><input required type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className={inputCls} placeholder="jane.doe@acme.com" /></div>
          <div><label className="mb-1 block text-sm font-medium">Phone</label><input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className={inputCls} placeholder="+1 555 000 1234" /></div>
          <div><label className="mb-1 block text-sm font-medium">Industry</label><input value={form.industry} onChange={(e) => set("industry", e.target.value)} className={inputCls} placeholder="Staffing & recruiting" /></div>
        </div>
      </section>

      {/* Size */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">Size & volume</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium"># Employees</label>
            <select value={form.num_employees} onChange={(e) => set("num_employees", e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {EMPLOYEE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium"># Recruiter seats (users)</label>
            <input type="number" min={0} value={form.num_recruiters} onChange={(e) => set("num_recruiters", e.target.value)} className={inputCls} placeholder="e.g. 8" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Hires per year</label>
            <select value={form.hiring_volume} onChange={(e) => set("hiring_volume", e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {HIRING_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Tools you use today</label>
          <input value={form.current_tools} onChange={(e) => set("current_tools", e.target.value)} className={inputCls} placeholder="e.g. Greenhouse, LinkedIn Recruiter, spreadsheets" />
        </div>
      </section>

      {/* Tools checklist */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">Which tools do you want?</h2>
        <p className="mt-1 text-sm text-muted-foreground">For each, tell us whether you need it, want it, aren&apos;t sure, or don&apos;t need it. This helps us recommend the right plan.</p>
        <div className="mt-5 space-y-6">
          {TOOL_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h3>
              <div className="mt-2 space-y-2">
                {g.tools.map((t) => (
                  <div key={t.key} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {TOOL_PREFS.map((p) => {
                        const active = prefs[t.key] === p.value;
                        return (
                          <button type="button" key={p.value} onClick={() => setPref(t.key, p.value)}
                            className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                              active ? PREF_STYLE[p.value] : "border-border text-muted-foreground hover:bg-muted")}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <label className="mb-1 block text-sm font-medium">Anything else we should know?</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={4} className={cn(inputCls, "resize-y")} placeholder="Goals, timeline, must-haves…" />
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-center">
        <button type="submit" disabled={state === "sending"} className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-8 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
          {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {state === "sending" ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}
