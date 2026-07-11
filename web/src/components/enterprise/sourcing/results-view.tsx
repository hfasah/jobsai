"use client";

// Global Sourcing results — card/table toggle, origin + dedup badges, score
// breakdown popover, bulk selection. Reveal/import actions land in the next
// PRs; this view already reserves their slots.
import { useState } from "react";
import {
  Check, ExternalLink, Github, LayoutGrid, List, Loader2, MapPin, Briefcase,
  Building2, Mail, Phone, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreBreakdown } from "@/lib/sourcing/types";

export interface RunResultRow {
  id: string;
  origin: "external" | "internal_application" | "internal_pool";
  internal_ref_id: string | null;
  match_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  fit_reason: string | null;
  dedup_status: "new" | "possible_duplicate" | "existing" | "imported" | "previously_contacted";
  external: {
    id: string;
    provider_key: string;
    full_name: string | null;
    job_title: string | null;
    company: string | null;
    location_country: string | null;
    location_locality: string | null;
    skills: string[];
    experience_years: number | null;
    linkedin_url: string | null;
    github_url: string | null;
    has_email: boolean | null;
    has_phone: boolean | null;
    emails: { value: string; verification_status?: string }[];
    phones: { value: string }[];
    profile_unlocked: boolean;
    collected_at?: string;
    permitted_use?: string | null;
  } | null;
}

const ORIGIN_BADGE: Record<RunResultRow["origin"], { label: string; cls: string }> = {
  external:             { label: "External",   cls: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  internal_application: { label: "Internal",   cls: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
  internal_pool:        { label: "Talent pool", cls: "border-purple-500/30 bg-purple-500/10 text-purple-400" },
};

const DEDUP_BADGE: Record<string, { label: string; cls: string } | null> = {
  new: null,
  possible_duplicate:   { label: "Possible duplicate",   cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  existing:             { label: "Already in CRM",        cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  imported:             { label: "Imported",              cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  previously_contacted: { label: "Previously contacted",  cls: "border-orange-500/30 bg-orange-500/10 text-orange-400" },
};

function titleCase(s: string | null): string {
  if (!s) return "";
  return s.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function ScorePopover({ score, breakdown }: { score: number | null; breakdown: ScoreBreakdown | null }) {
  const [open, setOpen] = useState(false);
  if (score === null) return null;
  const color = score >= 75 ? "text-green-400" : score >= 50 ? "text-amber-400" : "text-muted-foreground";
  return (
    <span className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn("inline-flex items-center gap-1 text-xs font-semibold", color)}
      >
        {score}% match {breakdown && <Info className="h-3 w-3 opacity-60" />}
      </button>
      {open && breakdown && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-6 z-30 w-64 rounded-xl border border-border bg-card p-3 text-left shadow-2xl"
        >
          {(Object.entries(breakdown) as [string, ScoreBreakdown[keyof ScoreBreakdown]][]).map(([key, cat]) => (
            <div key={key} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium capitalize">{key}</span>
                <span className="text-muted-foreground">{cat.score}/{cat.weight}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${cat.weight ? (cat.score / cat.weight) * 100 : 0}%` }} />
              </div>
              {(cat.matched.length > 0 || cat.missing.length > 0) && (
                <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                  {cat.matched.length > 0 && <span className="text-green-400/80">✓ {cat.matched.slice(0, 4).join(", ")}</span>}
                  {cat.matched.length > 0 && cat.missing.length > 0 && " · "}
                  {cat.missing.length > 0 && <span className="text-red-400/70">✗ {cat.missing.slice(0, 3).join(", ")}</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function ContactAvailability({ row }: { row: RunResultRow }) {
  const ext = row.external;
  if (!ext) return null;
  if (ext.profile_unlocked && (ext.emails.length > 0 || ext.phones.length > 0)) {
    return (
      <span className="flex flex-wrap items-center gap-2 text-xs">
        {ext.emails[0] && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <Mail className="h-3 w-3" /> {ext.emails[0].value}
            {ext.emails[0].verification_status === "valid" && <Check className="h-3 w-3" />}
          </span>
        )}
        {ext.phones[0] && (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <Phone className="h-3 w-3" /> {ext.phones[0].value}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className={cn("inline-flex items-center gap-1", ext.has_email ? "text-foreground/70" : "opacity-40")}>
        <Mail className="h-3 w-3" /> {ext.has_email ? "Email available" : "No email"}
      </span>
      <span className={cn("inline-flex items-center gap-1", ext.has_phone ? "text-foreground/70" : "opacity-40")}>
        <Phone className="h-3 w-3" /> {ext.has_phone ? "Phone available" : "No phone"}
      </span>
    </span>
  );
}

export default function ResultsView({
  results,
  loading,
  selected,
  onToggle,
  onSelectAll,
  hasMore,
  onLoadMore,
  renderActions,
  externalCount,
  internalCount,
}: {
  results: RunResultRow[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  renderActions?: (row: RunResultRow) => React.ReactNode;
  externalCount: number;
  internalCount: number;
}) {
  const [view, setView] = useState<"card" | "table">("card");

  if (loading && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Searching external talent sources…</p>
        <p className="text-xs text-muted-foreground/60">Querying providers, merging and scoring results</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No candidates matched these filters.</p>
        <p className="mt-1 text-xs text-muted-foreground">Broaden the titles, skills or locations and run it again.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{results.length} candidates</p>
          <p className="text-xs text-muted-foreground">
            {externalCount} external · {internalCount} internal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSelectAll} className="text-xs text-muted-foreground hover:text-foreground">
            {selected.size === results.length ? "Deselect all" : "Select all"}
          </button>
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setView("card")}
              className={cn("p-1.5", view === "card" ? "bg-muted text-foreground" : "text-muted-foreground")}
              aria-label="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("p-1.5", view === "table" ? "bg-muted text-foreground" : "text-muted-foreground")}
              aria-label="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Exp</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => {
                const ext = row.external;
                const isSel = selected.has(row.id);
                const dedup = DEDUP_BADGE[row.dedup_status];
                return (
                  <tr
                    key={row.id}
                    onClick={() => onToggle(row.id)}
                    className={cn("cursor-pointer border-b border-border/50 last:border-0", isSel ? "bg-primary/5" : "hover:bg-muted/20")}
                  >
                    <td className="px-3 py-2">
                      <div className={cn("flex h-4 w-4 items-center justify-center rounded border", isSel ? "border-primary bg-primary" : "border-border")}>
                        {isSel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium">{titleCase(ext?.full_name ?? null) || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{titleCase(ext?.job_title ?? null) || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{titleCase(ext?.company ?? null) || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[titleCase(ext?.location_locality ?? null), titleCase(ext?.location_country ?? null)].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ext?.experience_years != null ? `${ext.experience_years}y` : "—"}</td>
                    <td className="px-3 py-2"><ScorePopover score={row.match_score} breakdown={row.score_breakdown} /></td>
                    <td className="px-3 py-2">
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", ORIGIN_BADGE[row.origin].cls)}>
                        {ORIGIN_BADGE[row.origin].label}
                      </span>
                      {dedup && (
                        <span className={cn("ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", dedup.cls)}>{dedup.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">{renderActions?.(row)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((row) => {
            const ext = row.external;
            const isSel = selected.has(row.id);
            const dedup = DEDUP_BADGE[row.dedup_status];
            return (
              <div
                key={row.id}
                onClick={() => onToggle(row.id)}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-colors",
                  isSel ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", isSel ? "border-primary bg-primary" : "border-border")}>
                    {isSel && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{titleCase(ext?.full_name ?? null) || "Unknown"}</p>
                      <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", ORIGIN_BADGE[row.origin].cls)}>
                        {ORIGIN_BADGE[row.origin].label}
                      </span>
                      {dedup && (
                        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", dedup.cls)}>{dedup.label}</span>
                      )}
                      <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                        <ScorePopover score={row.match_score} breakdown={row.score_breakdown} />
                      </span>
                    </div>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {ext?.job_title && (
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> {titleCase(ext.job_title)}</span>
                      )}
                      {ext?.company && (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {titleCase(ext.company)}</span>
                      )}
                      {(ext?.location_locality || ext?.location_country) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[titleCase(ext?.location_locality ?? null), titleCase(ext?.location_country ?? null)].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {ext?.experience_years != null && <span>{ext.experience_years} yrs</span>}
                    </p>

                    {ext && ext.skills.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {ext.skills.slice(0, 6).map((s) => (
                          <span key={s} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                        ))}
                        {ext.skills.length > 6 && <span className="text-[10px] text-muted-foreground/60">+{ext.skills.length - 6}</span>}
                      </p>
                    )}

                    {row.fit_reason && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{row.fit_reason}</p>
                    )}

                    <div className="mt-1.5"><ContactAvailability row={row} /></div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {ext?.linkedin_url && (
                      <a href={ext.linkedin_url} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open LinkedIn">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {ext?.github_url && (
                      <a href={ext.github_url} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Open GitHub">
                        <Github className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {renderActions?.(row)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
