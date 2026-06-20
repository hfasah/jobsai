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

export function logModelUsage(task: keyof typeof AI_MODELS) {
  console.log(`[AI] Using ${AI_MODELS[task]} for ${task}`);
}
