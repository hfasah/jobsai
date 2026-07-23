// GoHighLevel (LeadConnector) bridge for the marketing lead loop.
//
// Pushes leads and product milestones into the agency's GHL location so their
// automations (email/SMS sequences, pipelines, attribution) fire on real
// events. Server-only. Fire-and-forget friendly: every function no-ops with a
// log when GHL_PRIVATE_TOKEN / GHL_LOCATION_ID are unset and never throws, so
// callers can invoke it unconditionally via after().
//
// Boundary note: this is one-way (JobsAI -> GHL contacts + tags). Transactional
// email stays in the product (Resend); GHL owns marketing nurture only.

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export interface GhlAttribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
}

export interface GhlLead {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** Tags drive the agency's automations, e.g. "lp-fair-followup" or "product-trial-started". */
  tags?: string[];
  source?: string;
  attribution?: GhlAttribution;
}

export function ghlConfigured(): boolean {
  return Boolean(process.env.GHL_PRIVATE_TOKEN && process.env.GHL_LOCATION_ID);
}

// Upserts a contact by email (GHL merges tags on upsert, so repeated calls
// accumulate milestone tags rather than overwriting them).
export async function ghlUpsertContact(lead: GhlLead): Promise<boolean> {
  const token = process.env.GHL_PRIVATE_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!token || !locationId) {
    console.log("[ghl] not configured — skipping upsert for", lead.email);
    return false;
  }
  if (!lead.email) return false;

  // Attribution travels two ways the agency can actually use: the campaign
  // becomes a filterable tag (utm-<campaign>), and the full first-touch trail
  // is packed into `source` (visible on the contact record).
  const a = lead.attribution ?? {};
  const tags = [...(lead.tags ?? [])];
  if (a.utm_campaign) tags.push(`utm-${a.utm_campaign.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 40)}`);
  const sourceTrail = [lead.source ?? "jobsai", a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / ");

  const body = {
    locationId,
    email: lead.email.trim().toLowerCase(),
    ...(lead.firstName ? { firstName: lead.firstName } : {}),
    ...(lead.lastName ? { lastName: lead.lastName } : {}),
    ...(lead.phone ? { phone: lead.phone } : {}),
    ...(tags.length ? { tags } : {}),
    source: sourceTrail.slice(0, 120),
  };

  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GHL_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[ghl] upsert failed:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ghl] upsert error:", e instanceof Error ? e.message : e);
    return false;
  }
}

// Convenience for product milestones: tags an email with an event tag.
// Safe to call from after() anywhere — no-ops when unconfigured.
export async function ghlTrackEvent(email: string | null | undefined, tag: string, extra?: Partial<GhlLead>): Promise<void> {
  if (!email) return;
  await ghlUpsertContact({ email, tags: [tag], source: extra?.source ?? "jobsai-product", ...extra });
}
