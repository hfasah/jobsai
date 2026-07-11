// Provider resolution per org. SERVER-ONLY — resolves API keys; never import
// from client components.
import { supabaseAdmin } from "@/lib/supabase";
import type { EmailVerifier, ProviderKey, SourcingProvider } from "./provider";
import { mockProvider } from "./providers/mock";
import { pdlProvider } from "./providers/pdl";
import { mockVerifier } from "./verifiers/mock";
import { emailableVerifier } from "./verifiers/emailable";

const PROVIDERS: Record<ProviderKey, SourcingProvider> = {
  mock: mockProvider,
  pdl: pdlProvider,
};

function envKeyFor(key: ProviderKey): string | null {
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
  if (process.env.SOURCING_MOCK === "1") {
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
    const provider = PROVIDERS[row.provider_key];
    if (!provider) continue;
    const apiKey = row.api_key ?? envKeyFor(row.provider_key);
    if (!apiKey) continue;
    resolved.push({ provider, apiKey, settings: row.settings ?? {} });
  }
  if (resolved.length > 0) return resolved;

  const pdlKey = envKeyFor("pdl");
  if (pdlKey) return [{ provider: pdlProvider, apiKey: pdlKey, settings: {} }];
  return [{ provider: mockProvider, apiKey: "mock", settings: {} }];
}

export function getEmailVerifier(): { verifier: EmailVerifier; apiKey: string } {
  const which = process.env.EMAIL_VERIFIER_PROVIDER ?? "mock";
  const apiKey = process.env.EMAIL_VERIFIER_API_KEY ?? "";
  if (which === "emailable" && apiKey) {
    return { verifier: emailableVerifier, apiKey };
  }
  return { verifier: mockVerifier, apiKey: "mock" };
}
