import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { loadCatalog } from "@/lib/enterprise-catalog";
import { computeQuote, type QuoteAddon } from "@/lib/enterprise-quote";

export const dynamic = "force-dynamic";

// GET ?lead_id= — list quotes (newest first), optionally for one lead.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leadId = new URL(req.url).searchParams.get("lead_id");
  const q = supabaseAdmin.from("enterprise_quotes").select("*").order("created_at", { ascending: false }).limit(100);
  if (leadId) q.eq("lead_id", leadId);
  const { data } = await q;
  return NextResponse.json({ data: data ?? [] });
}

// POST — create or update a quote. Totals are recomputed server-side so the
// stored snapshot is authoritative. Body mirrors QuoteInput plus snapshot fields.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const planSlug = (b.plan_slug as string | undefined)?.trim();
  if (!planSlug) return NextResponse.json({ error: "plan_slug is required." }, { status: 400 });

  const billingPeriod = b.billing_period === "monthly" ? "monthly" : "yearly";
  const addons = (Array.isArray(b.addons) ? b.addons : []) as QuoteAddon[];
  const extraRecruiters = Math.max(0, Math.round(Number(b.extra_recruiters) || 0));
  const discountPct = Math.min(100, Math.max(0, Number(b.discount_pct) || 0));
  const founding = Boolean(b.founding);
  const override = b.price_override_monthly_cents != null && b.price_override_monthly_cents !== ""
    ? Math.max(0, Math.round(Number(b.price_override_monthly_cents)))
    : null;

  const catalog = await loadCatalog();
  const result = computeQuote(
    { planSlug, billingPeriod, addons, extraRecruiters, discountPct, founding, priceOverrideMonthlyCents: override },
    catalog,
  );

  const row = {
    lead_id: (b.lead_id as string | undefined) || null,
    company: (b.company as string | undefined)?.trim() || null,
    contact_name: (b.contact_name as string | undefined)?.trim() || null,
    contact_email: (b.contact_email as string | undefined)?.trim()?.toLowerCase() || null,
    plan_slug: planSlug,
    billing_period: billingPeriod,
    addons,
    extra_recruiters: extraRecruiters,
    discount_pct: discountPct,
    founding,
    price_override_monthly_cents: override,
    monthly_cents: result.monthlyTotalCents,
    yearly_cents: result.yearlyTotalCents,
    first_year_cents: result.firstYearCents,
    notes: (b.notes as string | undefined)?.trim() || null,
  };

  if (b.id) {
    const { data, error } = await supabaseAdmin
      .from("enterprise_quotes").update(row).eq("id", b.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ quote: data });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_quotes")
    .insert({ ...row, token: randomBytes(16).toString("hex"), status: "draft", created_by: admin.userId })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quote: data });
}
