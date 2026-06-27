import { supabaseAdmin } from "@/lib/supabase";

// Pipedrive CRM integration (push JobsAI CRM → Pipedrive). Auth is a per-org API
// token stored in enterprise_integrations (provider 'pipedrive', api_key = token,
// subdomain = the company domain, e.g. "acme" for acme.pipedrive.com). The
// Pipedrive v1 API supports the api_token query param, keeping this dep-free.

export interface PipedriveIntegration {
  api_key: string;
  subdomain: string | null;
  enabled: boolean;
}

const PD_TIMEOUT_MS = 15_000;

export async function getPipedriveIntegration(orgId: string): Promise<PipedriveIntegration | null> {
  const { data } = await supabaseAdmin
    .from("enterprise_integrations")
    .select("api_key, subdomain, enabled")
    .eq("org_id", orgId)
    .eq("provider", "pipedrive")
    .maybeSingle();
  if (!data || !data.enabled || !data.api_key) return null;
  return data as PipedriveIntegration;
}

function baseUrl(integ: PipedriveIntegration): string {
  const domain = (integ.subdomain || "").trim().replace(/\.pipedrive\.com$/i, "");
  return domain ? `https://${domain}.pipedrive.com/api/v1` : "https://api.pipedrive.com/v1";
}

export interface PdResult<T> { ok: boolean; status: number; data?: T; error?: string }

export async function pdRequest<T = unknown>(
  integ: PipedriveIntegration, method: string, path: string, body?: unknown,
): Promise<PdResult<T>> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${baseUrl(integ)}${path}${sep}api_token=${encodeURIComponent(integ.api_key)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok || (json as { success?: boolean }).success === false) {
      const err = (json as { error?: string }).error || `Pipedrive returned ${res.status}`;
      return { ok: false, status: res.status, error: err };
    }
    return { ok: true, status: res.status, data: (json as { data?: T }).data };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "Pipedrive request failed" };
  } finally {
    clearTimeout(timer);
  }
}

// Validate a token (and surface the connected account/company name).
export async function verifyPipedrive(integ: PipedriveIntegration) {
  return pdRequest<{ name?: string; company_name?: string }>(integ, "GET", "/users/me");
}

interface CrmCompanyRow { id: string; name: string; location: string | null }

function organizationPayload(c: CrmCompanyRow): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: c.name };
  if (c.location) payload.address = c.location;
  return payload;
}

export type PushStatus = "created" | "updated" | "skipped" | "error";

// Push one JobsAI company to Pipedrive as an Organization. Creates on first push,
// updates thereafter (dedupe via crm_pipedrive_links). Safe no-op when Pipedrive
// isn't connected, so callers can fire it unconditionally via after().
export async function pushCompanyToPipedrive(
  orgId: string, companyId: string,
): Promise<{ status: PushStatus; pipedriveId?: number; error?: string }> {
  const integ = await getPipedriveIntegration(orgId);
  if (!integ) return { status: "skipped" };

  const { data: company } = await supabaseAdmin
    .from("crm_companies")
    .select("id, name, location")
    .eq("id", companyId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!company) return { status: "skipped" };

  const payload = organizationPayload(company as CrmCompanyRow);

  const { data: link } = await supabaseAdmin
    .from("crm_pipedrive_links")
    .select("pipedrive_id")
    .eq("org_id", orgId)
    .eq("entity_type", "company")
    .eq("entity_id", companyId)
    .maybeSingle();

  if (link?.pipedrive_id) {
    const res = await pdRequest(integ, "PUT", `/organizations/${link.pipedrive_id}`, payload);
    if (!res.ok) {
      // Org deleted on Pipedrive's side → drop the stale link so the next push recreates it.
      if (res.status === 404) {
        await supabaseAdmin.from("crm_pipedrive_links").delete()
          .eq("org_id", orgId).eq("entity_type", "company").eq("entity_id", companyId);
      }
      return { status: "error", error: res.error };
    }
    await supabaseAdmin.from("crm_pipedrive_links")
      .update({ last_pushed_at: new Date().toISOString() })
      .eq("org_id", orgId).eq("entity_type", "company").eq("entity_id", companyId);
    return { status: "updated", pipedriveId: link.pipedrive_id };
  }

  const res = await pdRequest<{ id: number }>(integ, "POST", "/organizations", payload);
  if (!res.ok || !res.data?.id) return { status: "error", error: res.error };
  await supabaseAdmin.from("crm_pipedrive_links").upsert(
    { org_id: orgId, entity_type: "company", entity_id: companyId, pipedrive_id: res.data.id, last_pushed_at: new Date().toISOString() },
    { onConflict: "org_id,entity_type,entity_id" },
  );
  return { status: "created", pipedriveId: res.data.id };
}

export interface SyncSummary { created: number; updated: number; errors: number; total: number; firstError?: string }

// Push every company in the org (manual "Sync now"). Sequential to respect
// Pipedrive rate limits; capped for serverless time budget.
export async function pushAllCompanies(orgId: string): Promise<SyncSummary> {
  const integ = await getPipedriveIntegration(orgId);
  if (!integ) return { created: 0, updated: 0, errors: 0, total: 0 };

  const { data: companies } = await supabaseAdmin
    .from("crm_companies")
    .select("id")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (companies ?? []) as { id: string }[];
  let created = 0, updated = 0, errors = 0;
  let firstError: string | undefined;
  for (const c of rows) {
    const r = await pushCompanyToPipedrive(orgId, c.id);
    if (r.status === "created") created++;
    else if (r.status === "updated") updated++;
    else if (r.status === "error") { errors++; firstError ??= r.error; }
  }
  await supabaseAdmin.from("enterprise_integrations")
    .update({ last_sync: new Date().toISOString() })
    .eq("org_id", orgId).eq("provider", "pipedrive");
  return { created, updated, errors, total: rows.length, firstError };
}

// Count companies + how many are already linked to Pipedrive (for the status card).
export async function pipedriveSyncCounts(orgId: string): Promise<{ companies: number; synced: number }> {
  const [{ count: companies }, { count: synced }] = await Promise.all([
    supabaseAdmin.from("crm_companies").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("crm_pipedrive_links").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("entity_type", "company"),
  ]);
  return { companies: companies ?? 0, synced: synced ?? 0 };
}
