"use client";

// Global / Combined modes of TalentSource: NL query -> AI-interpreted editable
// filters -> live count + credit estimate -> execute -> paginated results.
import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Loader2, Search, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreWeights, SourcingFilters } from "@/lib/sourcing/types";
import { DEFAULT_WEIGHTS } from "@/lib/sourcing/types";
import InterpretedFilters from "./interpreted-filters";
import ResultsView, { type RunResultRow } from "./results-view";

const EXAMPLE_PROMPTS = [
  "Senior DevOps engineers in Toronto with Kubernetes, Terraform and AWS",
  "Registered nurses in Texas with 5+ years of emergency-room experience",
  "Software engineers in Cameroon who know React and Node",
  "Sales directors at pharmaceutical companies in Germany",
];

interface Estimate {
  total: number | null;
  search_cost: number;
  balance: number;
  providers: string[];
}

export default function GlobalSourcing({ mode }: { mode: "external" | "combined" }) {
  const [query, setQuery] = useState("");
  const [parsing, setParsing] = useState(false);
  const [filters, setFilters] = useState<SourcingFilters | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [weights, setWeights] = useState<ScoreWeights>({ ...DEFAULT_WEIGHTS });
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<RunResultRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState({ external: 0, internal: 0, credits: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parse = async () => {
    if (!query.trim()) return;
    setParsing(true);
    setError(null);
    setResults([]);
    setRunId(null);
    try {
      const res = await fetch("/api/enterprise/sourcing/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not interpret the query.");
      setFilters(json.data.filters);
      setDropped(json.data.dropped_criteria ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setParsing(false);
    }
  };

  // Debounced live estimate whenever filters change.
  const refreshEstimate = useCallback((f: SourcingFilters) => {
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    estimateTimer.current = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await fetch("/api/enterprise/sourcing/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: f }),
        });
        const json = await res.json();
        if (res.ok && json.data?.searchable) setEstimate(json.data);
        else setEstimate(null);
      } catch {
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    }, 600);
  }, []);

  useEffect(() => {
    if (filters) refreshEstimate(filters);
  }, [filters, refreshEstimate]);

  const loadPage = async (id: string, pageNum: number, append: boolean) => {
    const res = await fetch(`/api/enterprise/sourcing/runs/${id}?page=${pageNum}`);
    const json = await res.json();
    if (!res.ok) return;
    const rows = (json.data?.results ?? []) as RunResultRow[];
    setResults((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(json.data?.has_more ?? false);
    setPage(pageNum);
  };

  const runSearch = async () => {
    if (!filters) return;
    setSearching(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/enterprise/sourcing/global-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query, filters, weights }),
      });
      const json = await res.json();
      if (res.status === 402) {
        setError(`Not enough sourcing credits (balance: ${json.balance}). Top up or upgrade your plan.`);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Search failed.");
      setCounts({
        external: json.data.external_count,
        internal: json.data.internal_count,
        credits: json.data.credits_charged,
      });
      setRunId(json.data.run_id);
      await loadPage(json.data.run_id, 0, false);
      if (json.data.provider_errors?.length) {
        setError(`Some providers had issues: ${json.data.provider_errors.join("; ")}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSearching(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      {/* NL search box */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && parse()}
              placeholder='Describe who you need — "Senior DevOps engineers in Toronto with Kubernetes and AWS"'
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={parse}
            disabled={parsing || !query.trim()}
            className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Search with AI
          </button>
        </div>
      </div>

      {/* Example prompts */}
      {!filters && !parsing && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setQuery(p)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Interpreted filters + estimate + execute */}
      {filters && (
        <div className="mb-6 space-y-3">
          <InterpretedFilters
            filters={filters}
            onChange={setFilters}
            droppedCriteria={dropped}
            weights={weights}
            onWeightsChange={setWeights}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              {estimating ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Estimating matches…
                </span>
              ) : estimate ? (
                <>
                  <span className="font-semibold text-primary">
                    {estimate.total !== null ? estimate.total.toLocaleString() : "—"}
                  </span>
                  <span className="text-muted-foreground">candidates match</span>
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    <Coins className="h-3 w-3" /> {estimate.search_cost} credit · balance {estimate.balance}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Add at least one criterion to search.</span>
              )}
            </div>
            <button
              onClick={runSearch}
              disabled={searching || !estimate}
              className="btn-cta inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {searching ? "Searching…" : mode === "combined" ? "Search external + internal" : "Search external sources"}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {(runId || searching) && (
        <ResultsView
          results={results}
          loading={searching || loadingMore}
          selected={selected}
          onToggle={toggle}
          onSelectAll={() =>
            setSelected(selected.size === results.length ? new Set() : new Set(results.map((r) => r.id)))
          }
          hasMore={hasMore}
          onLoadMore={async () => {
            if (!runId) return;
            setLoadingMore(true);
            await loadPage(runId, page + 1, true);
            setLoadingMore(false);
          }}
          externalCount={counts.external}
          internalCount={counts.internal}
        />
      )}

      {runId && counts.credits > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          This search used {counts.credits} sourcing credit{counts.credits !== 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}
