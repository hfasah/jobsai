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

// True only if the provider has its own API key set. Used to avoid failing over
// to a provider that isn't configured (which would just error again).
export function providerConfigured(provider: AIProvider): boolean {
  const cfg = PROVIDERS[provider];
  return !!cfg && !!process.env[cfg.keyEnv];
}

// ---------------------------------------------------------------------------
// Failover-aware chat completions.
//
// Calls go to a primary provider; on a *retryable* failure (quota/429, 5xx,
// or a connection/timeout error) we automatically retry once on a backup
// provider (e.g. DeepSeek when OpenAI is over quota). Bad-input errors (4xx
// other than 429) are NOT retried — a different provider won't fix them.
// ---------------------------------------------------------------------------
export type ChatParams = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
export type ChatResult = OpenAI.Chat.Completions.ChatCompletion;
export type FailoverTarget = { provider: AIProvider; model: string };

function statusOf(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIError && typeof err.status === "number") return err.status;
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

export function isRetryableProviderError(err: unknown): boolean {
  const s = statusOf(err);
  if (s !== undefined) return s === 429 || s === 408 || s >= 500;
  // No HTTP status → connection/timeout error from the SDK → worth a backup try.
  return err instanceof OpenAI.APIConnectionError;
}

function errLabel(err: unknown): string {
  const s = statusOf(err);
  if (s) return `HTTP ${s}`;
  if (err instanceof Error) return err.name;
  return "unknown error";
}

export async function createChatCompletion(
  params: ChatParams,
  opts: {
    provider: AIProvider;
    fallback?: FailoverTarget | null;
    requestOptions?: OpenAI.RequestOptions;
  },
): Promise<ChatResult> {
  try {
    return await getAIClient(opts.provider).chat.completions.create(params, opts.requestOptions);
  } catch (err) {
    const fb = opts.fallback;
    if (fb && fb.provider !== opts.provider && providerConfigured(fb.provider) && isRetryableProviderError(err)) {
      console.warn(
        `[ai] primary provider "${opts.provider}" failed (${errLabel(err)}); ` +
          `failing over to backup "${fb.provider}" (${fb.model})`,
      );
      return await getAIClient(fb.provider).chat.completions.create(
        { ...params, model: fb.model },
        opts.requestOptions,
      );
    }
    throw err;
  }
}

// Maps a thrown AI error to a calm, user-facing message. Use in route catch
// blocks instead of leaking provider details or a misleading "try again".
export function aiErrorMessage(err: unknown, action = "request"): string {
  const s = statusOf(err);
  if (s === 429) return "Our AI is briefly over capacity. Please try again in a minute.";
  if (s !== undefined && s >= 500) return "The AI service hit a temporary error. Please try again shortly.";
  if (err instanceof OpenAI.APIConnectionError)
    return "We couldn't reach the AI service. Please check your connection and try again.";
  return `Couldn't complete the ${action}. Please try again.`;
}
