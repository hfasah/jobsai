// AI model configuration — switch models by use case
// Use faster models for high-volume tasks, accurate models for complex reasoning

import type { AIProvider } from "@/lib/ai-client";

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
type TierConfig = { provider: AIProvider; model: string };

function tierProvider(specific?: string): AIProvider {
  const p = (specific || process.env.AI_PROVIDER) as AIProvider | undefined;
  return p === "deepseek" || p === "openai" ? p : "openai";
}

export const AI_TIERS: Record<"smart" | "fast", TierConfig> = {
  smart: {
    provider: tierProvider(process.env.SMART_PROVIDER),
    model: process.env.SMART_MODEL || "gpt-4o",
  },
  fast: {
    provider: tierProvider(process.env.FAST_PROVIDER),
    model: process.env.FAST_MODEL || "gpt-4o-mini",
  },
};

export const AI_MODELS = {
  // Resume parsing: prioritize RELIABILITY over speed
  // gpt-4-turbo: ~30-60 seconds, reliable & accurate (chosen for business continuity)
  // gpt-3.5-turbo: ~10-30 seconds, but less reliable (was timing out)
  // gpt-4o: ~60+ seconds, most accurate (too slow)
  resumeParse: (process.env.RESUME_PARSE_MODEL || "gpt-4-turbo") as string,

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

export function logModelUsage(task: keyof typeof AI_MODELS) {
  console.log(`[AI] Using ${AI_MODELS[task]} for ${task}`);
}
