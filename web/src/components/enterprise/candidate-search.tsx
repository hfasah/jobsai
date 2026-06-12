"use client";

import { useState, useRef } from "react";
import { Search, Sparkles, Loader2, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppStage } from "@/types/enterprise";
import { STAGE_COLORS, STAGE_LABELS } from "@/types/enterprise";

interface SearchCandidate {
  id: string;
  candidate_name: string;
  candidate_email: string;
  stage: AppStage;
  match_score: number | null;
  skills_score: number | null;
  ai_summary: string | null;
  ai_recommendation: string | null;
  tags: string[];
  source: string;
  job?: { id: string; title: string } | null;
}

const REC_BADGE: Record<string, string> = {
  strong_yes: "bg-green-500/20 text-green-400",
  yes:        "bg-blue-500/20 text-blue-400",
  maybe:      "bg-amber-500/20 text-amber-400",
  no:         "bg-red-500/20 text-red-400",
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600", "from-blue-500 to-cyan-600",
  "from-amber-500 to-orange-600", "from-emerald-500 to-teal-600",
  "from-pink-500 to-rose-600", "from-indigo-500 to-blue-600",
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}
function avatarGradient(name: string) {
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
function scoreColor(n: number) {
  return n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";
}

const EXAMPLE_QUERIES = [
  "Top 5 React developers with score above 75",
  "Senior engineers currently in interview stage",
  "Candidates with strong_yes recommendation",
  "Java developers from LinkedIn",
];

interface CandidateSearchProps {
  jobId?: string;
}

export function CandidateSearch({ jobId }: CandidateSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersApplied, setFiltersApplied] = useState<Record<string, unknown>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async (q?: string) => {
    const searchQuery = q ?? query;
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const res = await fetch("/api/enterprise/candidates/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: searchQuery, jobId }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Search failed"); setLoading(false); return; }
    setResults(json.data ?? []);
    setFiltersApplied(json.filters_applied ?? {});
    setLoading(false);
  };

  const clear = () => {
    setQuery("");
    setResults(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. Top Java developers in Lagos with 5+ years experience"
          className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button onClick={clear} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => search()}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-white shadow-glow disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Search
          </button>
        </div>
      </div>

      {/* Example queries — shown before first search */}
      {!results && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => { setQuery(q); search(q); }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Active filters chips */}
      {results !== null && Object.keys(filtersApplied).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {(filtersApplied.skills as string[] | undefined)?.map((s) => (
            <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{s}</span>
          ))}
          {filtersApplied.min_score != null && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">score ≥ {filtersApplied.min_score as number}%</span>
          )}
          {(filtersApplied.stages as string[] | undefined)?.map((s) => (
            <span key={s} className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STAGE_COLORS[s as AppStage])}>{STAGE_LABELS[s as AppStage] ?? s}</span>
          ))}
          {filtersApplied.recommendation != null && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{String(filtersApplied.recommendation)}</span>
          )}
        </div>
      )}

      {/* Results */}
      {results !== null && (
        <div>
          <p className="mb-3 text-xs text-muted-foreground">
            {results.length === 0 ? "No candidates matched." : `${results.length} candidate${results.length !== 1 ? "s" : ""} found`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white",
                    avatarGradient(c.candidate_name),
                  )}>
                    {initials(c.candidate_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-semibold">{c.candidate_name}</p>
                      {c.match_score !== null && (
                        <span className={cn("shrink-0 text-xs font-bold tabular-nums", scoreColor(c.match_score))}>
                          {c.match_score}%
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{c.candidate_email}</p>
                  </div>
                </div>

                {c.ai_summary && (
                  <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{c.ai_summary}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", STAGE_COLORS[c.stage])}>
                    {STAGE_LABELS[c.stage]}
                  </span>
                  {c.ai_recommendation && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", REC_BADGE[c.ai_recommendation])}>
                      {c.ai_recommendation.replace("_", " ")}
                    </span>
                  )}
                  {c.tags.slice(0, 2).map((t) => (
                    <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>
                  ))}
                </div>

                {c.job && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground truncate">
                    Applied for: {c.job.title}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
