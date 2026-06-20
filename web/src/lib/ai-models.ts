// AI model configuration — switch models by use case
// Use faster models for high-volume tasks, accurate models for complex reasoning

import {
  type AIProvider,
  type FailoverTarget,
  type ChatParams,
  createChatCompletion,
  providerConfigured,
} from "@/lib/ai-client";

// ---------------------------------------------------------------------------
// Tiered chat models (provider-aware).
//
// Most chat calls fall into one of two tiers:
//   smart — quality-first reasoning (was hardcoded "gpt-4o")
//   fast  — high-volume / cheap     (was hardcoded "gpt-4o-mini")
//
// Each tier carries BOTH a provider and a model id, because a switch must move
// them together (DeepSeek rejects "gpt-4o"; OpenAI rejects "deepseek-chat").
// All four values are env-overridable, so you can:
//   • keep everything on OpenAI (defaults, no env needed), or
//   • move one tier to DeepSeek (FAST_PROVIDER=deepseek FAST_MODEL=deepseek-chat)
//     while the other stays on OpenAI — two providers at once, config-only.
// SMART_PROVIDER / FAST_PROVIDER fall back to the global AI_PROVIDER, then openai.
// ---------------------------------------------------------------------------
type TierConfig = { provider: AIProvider; model: string; fallback: FailoverTarget | null };

function tierProvider(specific?: string): AIProvider {
  const p = (specific || process.env.AI_PROVIDER) as AIProvider | undefined;
  return p === "deepseek" || p === "openai" ? p : "openai";
}

// Default backup = the *other* configured provider (OpenAI <-> DeepSeek), so if
// the primary is over quota/down we retry there. Returns null when no backup is
// usable (e.g. DEEPSEEK_API_KEY unset), which simply disables failover.
function autoFallback(primary: AIProvider): FailoverTarget | null {
  const other: AIProvider = primary === "openai" ? "deepseek" : "openai";
  if (!providerConfigured(other)) return null;
  return { provider: other, model: other === "deepseek" ? "deepseek-chat" : "gpt-4o" };
}

// Per-tier override: <TIER>_FALLBACK_PROVIDER ("none" disables) + _FALLBACK_MODEL.
function tierFallback(prefix: string, primary: AIProvider): FailoverTarget | null {
  const raw = process.env[`${prefix}_FALLBACK_PROVIDER`];
  if (raw === "none" || raw === "off") return null;
  if (raw === "openai" || raw === "deepseek") {
    if (raw === primary || !providerConfigured(raw)) return null;
    const model =
      process.env[`${prefix}_FALLBACK_MODEL`] || (raw === "deepseek" ? "deepseek-chat" : "gpt-4o");
    return { provider: raw, model };
  }
  return autoFallback(primary);
}

function buildTier(prefix: string, defaultModel: string): TierConfig {
  const provider = tierProvider(process.env[`${prefix}_PROVIDER`]);
  return {
    provider,
    model: process.env[`${prefix}_MODEL`] || defaultModel,
    fallback: tierFallback(prefix, provider),
  };
}

export const AI_TIERS: Record<"smart" | "fast", TierConfig> = {
  smart: buildTier("SMART", "gpt-4o"),
  fast: buildTier("FAST", "gpt-4o-mini"),
};

export const AI_MODELS = {
  // Resume parsing. Benchmarked (scripts/resume-parse-bench.mjs): gpt-4o ~5s,
  // deepseek-chat ~5s, gpt-4o-mini ~11s (slower on big JSON), gpt-4-turbo ~16s+
  // (the old default — 30-60s on real resumes). All identical extraction
  // quality, so default to gpt-4o. Override model + provider via env:
  //   RESUME_PARSE_MODEL (e.g. deepseek-chat) + RESUME_PARSE_PROVIDER (deepseek).
  resumeParse: (process.env.RESUME_PARSE_MODEL || "gpt-4o") as string,

  // Job parsing, matching, skills gap: balance accuracy & speed
  jobParse: (process.env.JOB_PARSE_MODEL || "gpt-4-turbo") as string,
  jobMatch: (process.env.JOB_MATCH_MODEL || "gpt-4-turbo") as string,
  skillsGap: (process.env.SKILLS_GAP_MODEL || "gpt-4-turbo") as string,

  // Resume translation: needs accuracy
  resumeTranslate: (process.env.RESUME_TRANSLATE_MODEL || "gpt-4-turbo") as string,
} as const;

export function getModel(task: keyof typeof AI_MODELS): string {
  return AI_MODELS[task];
}

// Provider for resume parsing. Defaults to RESUME_PARSE_PROVIDER, then the
// global AI_PROVIDER, then openai. Pair with RESUME_PARSE_MODEL so client and
// model move together (e.g. provider=deepseek + model=deepseek-chat).
export function resumeParseProvider(): AIProvider {
  return tierProvider(process.env.RESUME_PARSE_PROVIDER);
}

// Run a chat completion on a tier, with automatic failover to the tier's backup
// provider (configured in AI_TIERS) when the primary errors transiently.
export function tierChat(tier: "smart" | "fast", params: Omit<ChatParams, "model">) {
  const t = AI_TIERS[tier];
  return createChatCompletion({ ...params, model: t.model } as ChatParams, {
    provider: t.provider,
    fallback: t.fallback,
  });
}

// Provider/model/backup for resume parsing (its own config — see resumeParse).
export function resumeParseTarget(): {
  provider: AIProvider;
  model: string;
  fallback: FailoverTarget | null;
} {
  const provider = resumeParseProvider();
  return { provider, model: AI_MODELS.resumeParse, fallback: autoFallback(provider) };
}

export function logModelUsage(task: keyof typeof AI_MODELS) {
  console.log(`[AI] Using ${AI_MODELS[task]} for ${task}`);
}
