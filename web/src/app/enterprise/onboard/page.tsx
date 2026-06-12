"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ArrowRight } from "lucide-react";

const INDUSTRIES = ["Technology","Finance","Healthcare","Education","Retail","Manufacturing","Media","Legal","Consulting","Other"];
const SIZES = ["1-10","11-50","51-200","201-500","500+"];

export default function EnterpriseOnboard() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", industry: "", size: "", website: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Organization name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/enterprise/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      router.push("/enterprise/plans");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set up your organization</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your recruiting workspace. Takes 30 seconds.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Organization name *</label>
            <input
              value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Industry</label>
              <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Company size</label>
              <select value={form.size} onChange={(e) => set("size", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select…</option>
                {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Website</label>
            <input
              value={form.website} onChange={(e) => set("website", e.target.value)}
              placeholder="https://acme.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button type="submit" disabled={saving}
            className="btn-cta flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
