import { supabaseAdmin } from "@/lib/supabase";

// USD price per 1M tokens. Update as model prices change.
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o":      { input: 2.50, output: 10.00 },
  "gpt-4.1-mini":{ input: 0.40, output: 1.60 },
};

interface UsageOpts {
  orgId?: string | null;
  userId?: string | null;
  feature: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

// Fire-and-forget — never block or throw in the request path.
export function recordUsage(opts: UsageOpts): void {
  const p = PRICING[opts.model] ?? PRICING["gpt-4o-mini"];
  const inTok = opts.usage?.prompt_tokens ?? 0;
  const outTok = opts.usage?.completion_tokens ?? 0;
  const cost = (inTok / 1_000_000) * p.input + (outTok / 1_000_000) * p.output;

  supabaseAdmin.from("llm_usage").insert({
    org_id: opts.orgId ?? null,
    user_id: opts.userId ?? null,
    feature: opts.feature,
    model: opts.model,
    input_tokens: inTok,
    output_tokens: outTok,
    cost_usd: cost,
  }).then(() => {}, () => {});
}
