"use client";

// Editable "here's what I understood" filter panel shown between NL parse and
// search execution. Chips are add/removable; the search only runs after the
// recruiter confirms.
import { useEffect, useRef, useState } from "react";
import { Plus, X, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScoreWeights, SourcingFilters, SourcingLocation } from "@/lib/sourcing/types";
import { DEFAULT_WEIGHTS, COMPANY_SIZES } from "@/lib/sourcing/types";
import {
  TITLE_SUGGESTIONS, SKILL_SUGGESTIONS, INDUSTRY_SUGGESTIONS, COUNTRY_SUGGESTIONS, suggestFor,
} from "@/lib/sourcing/suggestions";

function ChipEditor({
  label,
  values,
  onChange,
  placeholder,
  tone = "default",
  suggestionList,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: "default" | "exclude";
  suggestionList?: string[]; // typeahead source; also drives the "browse" dropdown
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const addValue = (raw: string) => {
    const v = raw.trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
    setHighlight(0);
  };

  // Suggestions: filtered as you type. On empty focus we only show a short
  // "browse" starter list when the field is still empty — once a value is picked
  // (e.g. "Paralegal"), an unrelated generic dump is noise, so we require typing.
  const suggestions = suggestionList
    ? draft.trim()
      ? suggestFor(suggestionList, draft, values)
      : values.length === 0
        ? suggestionList.slice(0, 8)
        : []
    : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && suggestions[highlight]) addValue(suggestions[highlight]);
      else addValue(draft);
    } else if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              tone === "exclude"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3 opacity-70 hover:opacity-100" />
            </button>
          </span>
        ))}
        <span ref={boxRef} className="relative inline-flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setOpen(true); setHighlight(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Add…"}
            className="w-32 rounded-full border border-dashed border-border bg-transparent px-2.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => (draft.trim() ? addValue(draft) : setOpen((o) => !o))}
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Add or browse"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {open && suggestions.length > 0 && (
            <div className="absolute left-0 top-7 z-40 max-h-52 w-52 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-2xl">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => addValue(s)}
                  className={cn(
                    "block w-full truncate rounded-lg px-2 py-1 text-left text-xs",
                    i === highlight ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </span>
      </div>
    </div>
  );
}

function locationsToStrings(locs: SourcingLocation[]): string[] {
  return locs.map((l) => (l.locality ? `${l.locality}, ${l.country}` : l.country));
}
function stringsToLocations(values: string[]): SourcingLocation[] {
  return values.map((v) => {
    const [a, b] = v.split(",").map((s) => s.trim());
    return b ? { locality: a, country: b } : { country: a };
  });
}

export function WeightsEditor({
  weights,
  onChange,
}: {
  weights: ScoreWeights;
  onChange: (w: ScoreWeights) => void;
}) {
  const entries = Object.entries(weights) as [keyof ScoreWeights, number][];
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Match score weights
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {entries.map(([key, val]) => (
          <label key={key} className="text-xs">
            <span className="mb-0.5 block capitalize text-muted-foreground">{key}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={val}
              onChange={(e) => onChange({ ...weights, [key]: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
              className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        ))}
      </div>
      <button
        onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Reset to defaults
      </button>
    </div>
  );
}

export default function InterpretedFilters({
  filters,
  onChange,
  droppedCriteria,
  weights,
  onWeightsChange,
}: {
  filters: SourcingFilters;
  onChange: (f: SourcingFilters) => void;
  droppedCriteria: string[];
  weights: ScoreWeights;
  onWeightsChange: (w: ScoreWeights) => void;
}) {
  const [showWeights, setShowWeights] = useState(false);
  const set = <K extends keyof SourcingFilters>(key: K, value: SourcingFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Interpreted search criteria</p>
        <button
          onClick={() => setShowWeights((s) => !s)}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs",
            showWeights ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="h-3 w-3" /> Weights
        </button>
      </div>

      {droppedCriteria.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium">Some criteria were not applied:</p>
            <ul className="mt-0.5 list-disc pl-4">
              {droppedCriteria.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showWeights && <WeightsEditor weights={weights} onChange={onWeightsChange} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <ChipEditor label="Job titles" values={filters.titles} onChange={(v) => set("titles", v)} placeholder="Add title…" suggestionList={TITLE_SUGGESTIONS} />
        <ChipEditor label="Exclude titles" tone="exclude" values={filters.titles_exclude} onChange={(v) => set("titles_exclude", v)} suggestionList={TITLE_SUGGESTIONS} />
        <ChipEditor label="Skills (any)" values={filters.skills_any} onChange={(v) => set("skills_any", v)} placeholder="Add skill…" suggestionList={SKILL_SUGGESTIONS} />
        <ChipEditor label="Skills (required)" values={filters.skills_all} onChange={(v) => set("skills_all", v)} suggestionList={SKILL_SUGGESTIONS} />
        <ChipEditor
          label="Locations"
          values={locationsToStrings(filters.locations)}
          onChange={(v) => set("locations", stringsToLocations(v))}
          placeholder="City, Country"
          suggestionList={COUNTRY_SUGGESTIONS}
        />
        <ChipEditor label="Industries" values={filters.industries} onChange={(v) => set("industries", v)} suggestionList={INDUSTRY_SUGGESTIONS} />
        <ChipEditor label="Companies (include)" values={filters.companies_include} onChange={(v) => set("companies_include", v)} />
        <ChipEditor label="Companies (exclude)" tone="exclude" values={filters.companies_exclude} onChange={(v) => set("companies_exclude", v)} />
      </div>

      {/* Company size (headcount) — multi-select buckets */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Company size (employees)</p>
        <div className="flex flex-wrap gap-1.5">
          {COMPANY_SIZES.map((s) => {
            const active = filters.company_sizes.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() =>
                  set("company_sizes", active ? filters.company_sizes.filter((v) => v !== s.value) : [...filters.company_sizes, s.value])
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs">
          <span className="mb-0.5 block text-muted-foreground">Min years experience</span>
          <input
            type="number"
            min={0}
            max={60}
            value={filters.experience_years_min ?? ""}
            onChange={(e) => set("experience_years_min", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-muted-foreground">Max years experience</span>
          <input
            type="number"
            min={0}
            max={60}
            value={filters.experience_years_max ?? ""}
            onChange={(e) => set("experience_years_max", e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.contact_required.email}
            onChange={(e) => set("contact_required", { ...filters.contact_required, email: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
          />
          Must have email available
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.include_unknown.experience}
            onChange={(e) => set("include_unknown", { ...filters.include_unknown, experience: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-border accent-[var(--primary)]"
          />
          Include unknown experience
        </label>
      </div>
    </div>
  );
}
