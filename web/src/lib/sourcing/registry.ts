// Provider resolution per org. SERVER-ONLY — resolves API keys; never import
// from client components.
import { supabaseAdmin } from "@/lib/supabase";
import type { EmailVerifier, ProviderKey, SourcingProvider } from "./provider";
import { mockProvider } from "./providers/mock";
import { pdlProvider } from "./providers/pdl";
import { apolloProvider } from "./providers/apollo";
import { mockVerifier } from "./verifiers/mock";
import { emailableVerifier } from "./verifiers/emailable";

const PROVIDERS: Record<ProviderKey, SourcingProvider> = {
  mock: mockProvider,
  pdl: pdlProvider,
  apollo: apolloProvider,
};

function envKeyFor(key: ProviderKey): string | null {
  if (key === "apollo") return process.env.APOLLO_API_KEY ?? null;
  if (key === "pdl") return process.env.PDL_API_KEY ?? null;
  if (key === "mock") return "mock"; // mock needs no real key
  return null;
}

export interface ResolvedProvider {
  provider: SourcingProvider;
  apiKey: string;
  settings: Record<string, unknown>;
}

// Enabled providers for an org, with their resolved API keys.
// Org rows (sourcing_providers) override the platform defaults; with no rows,
// default to PDL when a platform key exists, otherwise the mock provider.
// SOURCING_MOCK=1 forces mock everywhere (dev/preview harness).
export async function getProvidersForOrg(orgId: string): Promise<ResolvedProvider[]> {
  const mockForced = process.env.SOURCING_MOCK === "1";
  if (mockForced) {
    return [{ provider: mockProvider, apiKey: "mock", settings: {} }];
  }

  const { data } = await supabaseAdmin
    .from("sourcing_providers")
    .select("provider_key, enabled, api_key, settings")
    .eq("org_id", orgId);
  const rows = (data ?? []) as { provider_key: ProviderKey; enabled: boolean; api_key: string | null; settings: Record<string, unknown> | null }[];

  const resolved: ResolvedProvider[] = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    // A stale `mock` row must NEVER take over real sourcing in production — mock
    // is only ever used when SOURCING_MOCK=1 (handled above). This was silently
    // routing an org's searches to synthetic fixtures → "0 results".
    if (row.provider_key === "mock") continue;
    const provider = PROVIDERS[row.provider_key];
    if (!provider) continue;
    // Treat an empty/whitespace key as "unset" so a misconfigured row falls back
    // to the platform env key instead of failing the provider call.
    const rowKey = row.api_key && row.api_key.trim() ? row.api_key.trim() : null;
    const apiKey = rowKey ?? envKeyFor(row.provider_key);
    if (!apiKey) continue;
    resolved.push({ provider, apiKey, settings: row.settings ?? {} });
  }

  // No org rows → platform default. Prefer Apollo (free search, pay-per-reveal)
  // when its key is set; otherwise PDL; otherwise mock.
  const apolloKey = envKeyFor("apollo");
  const pdlKey = envKeyFor("pdl");
  const fallback: ResolvedProvider =
    apolloKey
      ? { provider: apolloProvider, apiKey: apolloKey, settings: {} }
      : pdlKey
        ? { provider: pdlProvider, apiKey: pdlKey, settings: {} }
        : { provider: mockProvider, apiKey: "mock", settings: {} };
  const result: ResolvedProvider[] = resolved.length > 0 ? resolved : [fallback];

  // One-line resolution trace so a wrong provider is diagnosable without DB access.
  console.info("[sourcing/registry] resolved", {
    orgId,
    apolloEnv: !!apolloKey,
    pdlEnv: !!pdlKey,
    rows: rows.map((r) => ({ key: r.provider_key, enabled: r.enabled, hasKey: !!(r.api_key && r.api_key.trim()) })),
    resolved: result.map((r) => r.provider.key),
  });
  return result;
}

export function getEmailVerifier(): { verifier: EmailVerifier; apiKey: string } {
  const which = process.env.EMAIL_VERIFIER_PROVIDER ?? "mock";
  const apiKey = process.env.EMAIL_VERIFIER_API_KEY ?? "";
  if (which === "emailable" && apiKey) {
    return { verifier: emailableVerifier, apiKey };
  }
  return { verifier: mockVerifier, apiKey: "mock" };
}
