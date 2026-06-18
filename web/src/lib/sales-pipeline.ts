// Sales pipeline config — single source of truth for stages, their kind, and
// default win probabilities (used for the weighted-pipeline metric). Pure.

export type DealStage = "new" | "qualified" | "demo" | "proposal" | "negotiation" | "won" | "lost";
export type StageKind = "open" | "won" | "lost";

export type StageDef = { key: DealStage; label: string; kind: StageKind; probability: number };

export const STAGES: StageDef[] = [
  { key: "new",         label: "New",         kind: "open", probability: 10 },
  { key: "qualified",   label: "Qualified",   kind: "open", probability: 25 },
  { key: "demo",        label: "Demo",        kind: "open", probability: 45 },
  { key: "proposal",    label: "Proposal",    kind: "open", probability: 60 },
  { key: "negotiation", label: "Negotiation", kind: "open", probability: 80 },
  { key: "won",         label: "Won",         kind: "won",  probability: 100 },
  { key: "lost",        label: "Lost",        kind: "lost", probability: 0 },
];

export const STAGE_BY_KEY: Record<string, StageDef> = Object.fromEntries(STAGES.map((s) => [s.key, s]));
export const OPEN_STAGES = STAGES.filter((s) => s.kind === "open");

export type Deal = {
  id: string;
  title: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  owner: string | null;
  stage: DealStage;
  value_cents: number;
  probability: number | null;
  expected_close_date: string | null;
  lead_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Probability for a deal: explicit override, else the stage default.
export function dealProbability(d: Pick<Deal, "stage" | "probability">): number {
  if (d.probability != null) return Math.min(100, Math.max(0, d.probability));
  return STAGE_BY_KEY[d.stage]?.probability ?? 0;
}

export function isOpen(stage: string): boolean {
  return STAGE_BY_KEY[stage]?.kind === "open";
}

export function fmtUSD(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export type PipelineSummary = {
  openCount: number;
  openValueCents: number;
  weightedValueCents: number; // open value × probability
  wonValueCents: number;      // won deals
  winRate: number;            // won / (won + lost)
};

export function summarize(deals: Deal[]): PipelineSummary {
  let openCount = 0, openValueCents = 0, weightedValueCents = 0, wonValueCents = 0, won = 0, lost = 0;
  for (const d of deals) {
    const kind = STAGE_BY_KEY[d.stage]?.kind;
    if (kind === "open") {
      openCount++;
      openValueCents += d.value_cents;
      weightedValueCents += Math.round(d.value_cents * dealProbability(d) / 100);
    } else if (kind === "won") {
      wonValueCents += d.value_cents;
      won++;
    } else if (kind === "lost") {
      lost++;
    }
  }
  return {
    openCount,
    openValueCents,
    weightedValueCents,
    wonValueCents,
    winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
  };
}

// Is an open deal past its expected close date?
export function isOverdue(d: Pick<Deal, "stage" | "expected_close_date">): boolean {
  if (!d.expected_close_date || !isOpen(d.stage)) return false;
  return new Date(d.expected_close_date) < new Date(new Date().toDateString());
}
