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

interface CrmContactRow { id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; title: string | null; company_id: string | null }

function personPayload(c: CrmContactRow, orgId?: number): Record<string, unknown> {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.first_name || "Unknown";
  const payload: Record<string, unknown> = { name };
  if (c.email) payload.email = [{ value: c.email, primary: true, label: "work" }];
  if (c.phone) payload.phone = [{ value: c.phone, primary: true, label: "work" }];
  if (orgId) payload.org_id = orgId;
  return payload;
}

// Resolve the Pipedrive Organization id for a JobsAI company, pushing it first
// if it hasn't been synced yet — so a Person lands nested under its Organization.
async function resolveOrgId(orgId: string, companyId: string): Promise<number | undefined> {
  const read = () => supabaseAdmin.from("crm_pipedrive_links")
    .select("pipedrive_id").eq("org_id", orgId).eq("entity_type", "company").eq("entity_id", companyId).maybeSingle();
  let { data: link } = await read();
  if (!link?.pipedrive_id) { await pushCompanyToPipedrive(orgId, companyId); ({ data: link } = await read()); }
  return link?.pipedrive_id ?? undefined;
}

// Push one JobsAI contact to Pipedrive as a Person (create/update via the link
// table; linked to its company's Organization). Safe no-op when not connected.
export async function pushContactToPipedrive(
  orgId: string, contactId: string,
): Promise<{ status: PushStatus; pipedriveId?: number; error?: string }> {
  const integ = await getPipedriveIntegration(orgId);
  if (!integ) return { status: "skipped" };

  const { data: contact } = await supabaseAdmin
    .from("crm_contacts")
    .select("id, first_name, last_name, email, phone, title, company_id")
    .eq("id", contactId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!contact) return { status: "skipped" };
  const c = contact as CrmContactRow;

  const pdOrgId = c.company_id ? await resolveOrgId(orgId, c.company_id) : undefined;
  const payload = personPayload(c, pdOrgId);

  const { data: link } = await supabaseAdmin
    .from("crm_pipedrive_links")
    .select("pipedrive_id")
    .eq("org_id", orgId).eq("entity_type", "contact").eq("entity_id", contactId)
    .maybeSingle();

  if (link?.pipedrive_id) {
    const res = await pdRequest(integ, "PUT", `/persons/${link.pipedrive_id}`, payload);
    if (!res.ok) {
      if (res.status === 404) {
        await supabaseAdmin.from("crm_pipedrive_links").delete()
          .eq("org_id", orgId).eq("entity_type", "contact").eq("entity_id", contactId);
      }
      return { status: "error", error: res.error };
    }
    await supabaseAdmin.from("crm_pipedrive_links")
      .update({ last_pushed_at: new Date().toISOString() })
      .eq("org_id", orgId).eq("entity_type", "contact").eq("entity_id", contactId);
    return { status: "updated", pipedriveId: link.pipedrive_id };
  }

  const res = await pdRequest<{ id: number }>(integ, "POST", "/persons", payload);
  if (!res.ok || !res.data?.id) return { status: "error", error: res.error };
  await supabaseAdmin.from("crm_pipedrive_links").upsert(
    { org_id: orgId, entity_type: "contact", entity_id: contactId, pipedrive_id: res.data.id, last_pushed_at: new Date().toISOString() },
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

// Push every contact in the org. Sequential to respect Pipedrive rate limits.
export async function pushAllContacts(orgId: string): Promise<SyncSummary> {
  const integ = await getPipedriveIntegration(orgId);
  if (!integ) return { created: 0, updated: 0, errors: 0, total: 0 };

  const { data: contacts } = await supabaseAdmin
    .from("crm_contacts")
    .select("id")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows = (contacts ?? []) as { id: string }[];
  let created = 0, updated = 0, errors = 0;
  let firstError: string | undefined;
  for (const c of rows) {
    const r = await pushContactToPipedrive(orgId, c.id);
    if (r.status === "created") created++;
    else if (r.status === "updated") updated++;
    else if (r.status === "error") { errors++; firstError ??= r.error; }
  }
  return { created, updated, errors, total: rows.length, firstError };
}

// Full "Sync now": companies first (so Persons can link to Organizations), then
// contacts. Stamps last_sync once at the end.
export async function syncAllToPipedrive(orgId: string): Promise<{ companies: SyncSummary; contacts: SyncSummary }> {
  const companies = await pushAllCompanies(orgId);
  const contacts = await pushAllContacts(orgId);
  await supabaseAdmin.from("enterprise_integrations")
    .update({ last_sync: new Date().toISOString() })
    .eq("org_id", orgId).eq("provider", "pipedrive");
  return { companies, contacts };
}

// Counts for the status card: total + already-linked, per entity type.
export async function pipedriveSyncCounts(orgId: string): Promise<{ companies: number; synced: number; contacts: number; syncedContacts: number }> {
  const [{ count: companies }, { count: synced }, { count: contacts }, { count: syncedContacts }] = await Promise.all([
    supabaseAdmin.from("crm_companies").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("crm_pipedrive_links").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("entity_type", "company"),
    supabaseAdmin.from("crm_contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("crm_pipedrive_links").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("entity_type", "contact"),
  ]);
  return { companies: companies ?? 0, synced: synced ?? 0, contacts: contacts ?? 0, syncedContacts: syncedContacts ?? 0 };
}
