// Central AI client factory.
//
// Every OpenAI-compatible call in the app should get its client from here
// instead of doing `new OpenAI(...)` inline. That keeps provider/credentials
// in ONE place, so switching providers (or running two at once) is config-only.
//
// Because DeepSeek, Together, Groq, Fireworks, OpenRouter, local Ollama, etc.
// all speak the OpenAI Chat Completions protocol, the existing `openai` SDK
// works unchanged — only the baseURL + apiKey (+ model name) differ per
// provider. The model name lives alongside the provider in ai-models.ts, so a
// switch always moves the client and the model together (a provider will 4xx
// if you send it another vendor's model id).
//
// Defaults are 100% OpenAI: with no new env vars set, behavior is identical to
// the previous inline `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`.

import OpenAI from "openai";

export type AIProvider = "openai" | "deepseek";

type ProviderConfig = {
  // Omit baseURL for OpenAI's own default endpoint.
  baseURL?: string;
  // Env var holding this provider's API key. Falls back to OPENAI_API_KEY so a
  // half-configured provider degrades to OpenAI rather than throwing.
  keyEnv: string;
};

const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: { keyEnv: "OPENAI_API_KEY" },
  deepseek: { baseURL: "https://api.deepseek.com", keyEnv: "DEEPSEEK_API_KEY" },
};

// Global default provider. Set AI_PROVIDER=deepseek to move every untiered call
// at once; per-tier providers (SMART_PROVIDER / FAST_PROVIDER in ai-models.ts)
// override this and let two providers run side by side.
export function defaultProvider(): AIProvider {
  const p = process.env.AI_PROVIDER as AIProvider | undefined;
  return p && p in PROVIDERS ? p : "openai";
}

// One cached client per provider (the SDK opens a keep-alive pool).
const clients = new Map<AIProvider, OpenAI>();

export function getAIClient(provider: AIProvider = defaultProvider()): OpenAI {
  const cached = clients.get(provider);
  if (cached) return cached;

  const cfg = PROVIDERS[provider] ?? PROVIDERS.openai;
  const client = new OpenAI({
    apiKey: process.env[cfg.keyEnv] || process.env.OPENAI_API_KEY,
    baseURL: cfg.baseURL,
  });
  clients.set(provider, client);
  return client;
}
