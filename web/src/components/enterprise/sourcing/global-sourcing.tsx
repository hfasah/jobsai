"use client";

// Global / Combined modes of TalentSource: NL query -> AI-interpreted editable
// filters -> live count + credit estimate -> execute -> paginated results.
import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Info, Loader2, Search, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreWeights, SourcingFilters } from "@/lib/sourcing/types";
import { DEFAULT_WEIGHTS } from "@/lib/sourcing/types";
import InterpretedFilters from "./interpreted-filters";
import ResultsView, { type RunResultRow } from "./results-view";
import RevealButton, { type RevealOutcome } from "./reveal-button";
import UnlockContactButton, { type UnlockOutcome } from "./unlock-button";
import ImportDialog from "./import-dialog";
import SavedSearches, { type SavedSearch } from "./saved-searches";

const EXAMPLE_PROMPTS = [
  "Senior DevOps engineers in Toronto with Kubernetes, Terraform and AWS",
  "Registered nurses in Texas with 5+ years of emergency-room experience",
  "Software engineers in Cameroon who know React and Node",
  "Sales directors at pharmaceutical companies in Germany",
];

interface Estimate {
  total: number | null;
  search_cost: number;
  costs?: { reveal_email: number; reveal_phone: number; enrich: number; full_contact_unlock: number };
  balance: number;
  has_provider?: boolean;
}

export default function GlobalSourcing({
  mode,
  campaignContext = null,
  onEnrolled,
}: {
  mode: "external" | "combined";
  // When embedded in the campaign wizard's Audience step, imports enroll
  // straight into this campaign (skipping the target picker).
  campaignContext?: { id: string; name: string } | null;
  onEnrolled?: () => void;
}) {
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
  const [importIds, setImportIds] = useState<string[] | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealConfirm, setRevealConfirm] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parse = async () => {
    if (!query.trim()) return;
    setParsing(true);
    setError(null);
    setResults([]);
    setRunId(null);
    setSavedId(null);
    try {
      const res = await fetch("/api/enterprise/sourcing/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      // Never assume the body is JSON — a proxy/edge error can return HTML or an
      // empty body, which is what produced "Unexpected end of JSON input".
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        throw new Error(json?.error ?? "Couldn't interpret that search — try rephrasing it.");
      }
      setFilters(json.data.filters);
      setDropped(json.data.dropped_criteria ?? []);
      setDegraded(!!json.data.degraded);
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
        const json = await res.json().catch(() => null);
        if (res.ok && json?.data?.searchable) setEstimate(json.data);
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
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return;
    const rows = (json.data?.results ?? []) as RunResultRow[];
    setResults((prev) => (append ? [...prev, ...rows] : rows));
    setHasMore(json.data?.has_more ?? false);
    setPage(pageNum);
  };

  const runSearch = async () => {
    if (!filters) return;
    setSearching(true);
    setError(null);
    setNotice(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/enterprise/sourcing/global-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, query, filters, weights, search_id: savedId ?? undefined }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 402) {
        setError(`Not enough sourcing credits (balance: ${json?.balance ?? 0}). Top up or upgrade your plan.`);
        return;
      }
      if (!res.ok || !json?.data) throw new Error(json?.error ?? `Search failed (${res.status}). Please try again.`);
      setCounts({
        external: json.data.external_count,
        internal: json.data.internal_count,
        credits: json.data.credits_charged,
      });
      setRunId(json.data.run_id);
      await loadPage(json.data.run_id, 0, false);
      // Search is free, so a failure is never a client-credit issue — show the
      // neutral "temporarily unavailable" notice, never a top-up prompt.
      if (json.data.notice) setNotice(json.data.notice);
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

  // Fold a successful reveal back into the loaded results so the value shows
  // immediately without a refetch.
  const onRevealed = (o: RevealOutcome) => {
    setResults((prev) =>
      prev.map((row) => {
        if (row.id !== o.resultId || !row.external) return row;
        const ext = { ...row.external, profile_unlocked: true };
        if (o.type === "email" && o.value) {
          ext.emails = [{ value: o.value, verification_status: o.verification_status ?? undefined }];
        }
        if (o.type === "phone" && o.value) {
          ext.phones = [{ value: o.value }];
        }
        return { ...row, external: ext };
      }),
    );
  };

  const onUnlocked = (o: UnlockOutcome) => {
    setResults((prev) =>
      prev.map((row) => {
        if (row.id !== o.resultId || !row.external) return row;
        const ext = { ...row.external, profile_unlocked: true };
        if (o.email) ext.emails = [{ value: o.email, verification_status: o.email_verification ?? undefined }];
        if (o.phone) ext.phones = [{ value: o.phone }];
        if (o.linkedin_url) ext.linkedin_url = o.linkedin_url;
        return { ...row, external: ext };
      }),
    );
  };

  const flag = async (resultId: string, action: "not_relevant" | "suppress") => {
    setResults((prev) => prev.filter((r) => r.id !== resultId));
    await fetch(`/api/enterprise/sourcing/results/${resultId}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => {});
  };

  const renderActions = (row: RunResultRow) => {
    if (row.origin !== "external" || !row.external) return null;
    const ext = row.external;
    // Do-Not-Contact: a suppressed candidate can't be revealed or enrolled.
    if (ext.suppressed) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-400">
          Do Not Contact
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1">
        {ext.emails.length === 0 && (
          <RevealButton
            resultId={row.id}
            type="email"
            available={ext.has_email}
            cost={estimate?.costs?.reveal_email ?? 2}
            onRevealed={onRevealed}
          />
        )}
        {ext.phones.length === 0 && (
          <RevealButton
            resultId={row.id}
            type="phone"
            available={ext.has_phone}
            cost={estimate?.costs?.reveal_phone ?? 5}
            onRevealed={onRevealed}
          />
        )}
        {/* Bundle unlock — hidden once everything's already revealed. */}
        {!(ext.emails.length > 0 && ext.phones.length > 0 && ext.profile_unlocked) && (ext.has_email || ext.has_phone) && (
          <UnlockContactButton
            resultId={row.id}
            emailRevealed={ext.emails.length > 0}
            phoneRevealed={ext.phones.length > 0}
            hasPhone={ext.has_phone}
            costs={{
              reveal_email: estimate?.costs?.reveal_email ?? 2,
              reveal_phone: estimate?.costs?.reveal_phone ?? 5,
              full_contact_unlock: estimate?.costs?.full_contact_unlock ?? 6,
            }}
            onUnlocked={onUnlocked}
          />
        )}
        {row.dedup_status !== "imported" && (
          <button
            onClick={() => setImportIds([row.id])}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Import
          </button>
        )}
        <button
          onClick={() => flag(row.id, "not_relevant")}
          title="Not relevant"
          className="rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground/60 hover:text-foreground"
        >
          ✕
        </button>
      </span>
    );
  };

  const loadSaved = (s: SavedSearch) => {
    setQuery(s.query_text ?? "");
    setFilters(s.filters);
    setDropped([]);
    if (s.weights) setWeights({ ...DEFAULT_WEIGHTS, ...s.weights });
    setResults([]);
    setRunId(null);
    setSavedId(s.id);
  };

  // Selected rows that still need an email revealed before they can be enrolled.
  const unrevealedSelected = [...selected].filter((id) => {
    const r = results.find((x) => x.id === id);
    return r?.external && r.external.emails.length === 0 && r.external.has_email !== false;
  });

  const bulkReveal = async () => {
    if (!revealConfirm) { setRevealConfirm(true); return; }
    setRevealConfirm(false);
    setRevealing(true);
    setImportNotice(null);
    const res = await fetch("/api/enterprise/sourcing/bulk-reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultIds: unrevealedSelected }),
    });
    const j = await res.json().catch(() => ({}));
    setRevealing(false);
    if (!res.ok) { setImportNotice(j.error ?? "Reveal failed."); return; }
    const d = j.data;
    setImportNotice(
      `Revealed ${d.revealed} contact${d.revealed !== 1 ? "s" : ""}` +
      (d.no_data ? `, ${d.no_data} had no email` : "") +
      (d.ran_out ? " — ran out of credits" : "") +
      `. Review, then select who to add.`,
    );
    if (runId) loadPage(runId, 0, false); // refresh so revealed emails + verification show
  };

  return (
    <div>
      <SavedSearches
        current={filters ? { query, filters, mode, weights } : null}
        onLoad={loadSaved}
      />

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

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Info className="h-4 w-4 shrink-0" /> {notice}
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
          {degraded && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              AI interpretation is briefly unavailable — we used quick keyword matching. Review and refine the criteria below before searching.
            </div>
          )}
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
                  {estimate.search_cost === 0 ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                      Free to search — you only spend credits to reveal a contact
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                      <Coins className="h-3 w-3" /> {estimate.search_cost} credit · balance {estimate.balance}
                    </span>
                  )}
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

      {importNotice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-400">
          {importNotice}
        </div>
      )}

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2">
          <p className="text-xs font-medium">
            {selected.size} selected
            {unrevealedSelected.length > 0 && <span className="text-muted-foreground"> · {unrevealedSelected.length} without a revealed email</span>}
          </p>
          <div className="flex items-center gap-2">
            {unrevealedSelected.length > 0 && (
              <button
                onClick={bulkReveal}
                onMouseLeave={() => setRevealConfirm(false)}
                disabled={revealing}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-border/80 disabled:opacity-60"
              >
                {revealing
                  ? "Revealing…"
                  : revealConfirm
                    ? `Confirm — reveal ${unrevealedSelected.length} · ~${unrevealedSelected.length * 2} credits`
                    : `Reveal ${unrevealedSelected.length} email${unrevealedSelected.length !== 1 ? "s" : ""}`}
              </button>
            )}
            <button
              onClick={() => setImportIds([...selected])}
              className="btn-cta rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              {campaignContext ? "Add selected to campaign" : "Import selected"}
            </button>
          </div>
        </div>
      )}

      {/* Export */}
      {runId && results.length > 0 && selected.size === 0 && (
        <div className="mb-3 text-right">
          <a
            href={`/api/enterprise/sourcing/export?runId=${runId}`}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Export CSV
          </a>
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
          renderActions={renderActions}
          externalCount={counts.external}
          internalCount={counts.internal}
        />
      )}

      {runId && counts.credits > 0 && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          This search used {counts.credits} sourcing credit{counts.credits !== 1 ? "s" : ""}.
        </p>
      )}

      {importIds && (
        <ImportDialog
          resultIds={importIds}
          lockedCampaign={campaignContext}
          revealNeeded={importIds.filter((id) => {
            const r = results.find((x) => x.id === id);
            return r?.external && r.external.emails.length === 0 && r.external.has_email !== false;
          }).length}
          revealCost={estimate?.costs?.reveal_email ?? 2}
          candidateName={
            importIds.length === 1
              ? results.find((r) => r.id === importIds[0])?.external?.full_name ?? null
              : null
          }
          onClose={() => setImportIds(null)}
          onDone={(summary) => {
            setImportIds(null);
            setImportNotice(summary);
            setSelected(new Set());
            // refresh badges for imported rows
            if (runId) loadPage(runId, 0, false);
            onEnrolled?.();
          }}
        />
      )}
    </div>
  );
}
