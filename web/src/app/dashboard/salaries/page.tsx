"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { POPULAR_ROLES, type SalaryComparison } from "@/lib/salaries";
import { SalaryComparisonCard } from "@/components/marketing/salary-comparison-card";

export default function SalariesPage() {
  const [input, setInput] = useState("Software Engineer");
  const [data, setData] = useState<SalaryComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const run = useCallback(async (title: string) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/salaries?title=${encodeURIComponent(title)}`);
      const json = await res.json();
      if (id !== reqId.current) return;
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json.data as SalaryComparison);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    run("Software Engineer");
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim()) run(input.trim()); };
  const pick = (role: string) => { setInput(role); run(role); };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <TrendingUp className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Explorer</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Compare the average advertised salary for any role across the US, Canada, the UK, and the EU — on one page.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Browse salary information for any job title"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button type="submit" className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {data && !data.configured && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--cta)]/30 bg-[var(--cta)]/10 p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
          <p className="text-muted-foreground">Live salary data is temporarily unavailable for this search. Please try again shortly.</p>
        </div>
      )}

      <section className="mt-6">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">{error}</div>
        ) : data ? (
          <SalaryComparisonCard data={data} jobsHref={`/dashboard/job-search?what=${encodeURIComponent(data.title)}`} />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading salary data…
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold">Popular salary searches</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {POPULAR_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => pick(role)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                data?.title === role ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-foreground/80 hover:bg-white/5 hover:text-foreground"
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
