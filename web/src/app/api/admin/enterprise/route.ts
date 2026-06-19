import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { uniqueSlug, inviteToken } from "@/lib/enterprise";
import { getTemplate, ORG_TEMPLATES } from "@/lib/enterprise-templates";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// GET — list all enterprise orgs with stats + this-month LLM cost
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: orgs } = await supabaseAdmin.from("enterprise_orgs").select("*").order("created_at", { ascending: false });

  // Resolve each org's actual plan (plan_id → name), not the free-text label.
  const { data: allPlans } = await supabaseAdmin.from("plans").select("id,name,slug");
  const planById = new Map((allPlans ?? []).map((p) => [p.id as string, p as { name: string; slug: string }]));

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const enriched = await Promise.all((orgs ?? []).map(async (o) => {
    const [members, jobs, apps, cost] = await Promise.all([
      supabaseAdmin.from("enterprise_members").select("id", { count: "exact", head: true }).eq("org_id", o.id),
      supabaseAdmin.from("enterprise_jobs").select("id", { count: "exact", head: true }).eq("org_id", o.id),
      supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", o.id),
      supabaseAdmin.from("llm_usage").select("cost_usd").eq("org_id", o.id).gte("created_at", monthStart.toISOString()),
    ]);
    const monthCost = (cost.data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
    const plan = o.plan_id ? planById.get(o.plan_id) : null;
    return {
      id: o.id, name: o.name, slug: o.slug, industry: o.industry,
      plan_label: o.plan_label ?? "Enterprise",
      plan_name: plan?.name ?? null, plan_slug: plan?.slug ?? null,
      status: o.status ?? "active", onboarding_done: o.onboarding_done ?? false, created_at: o.created_at,
      members: members.count ?? 0, jobs: jobs.count ?? 0, applicants: apps.count ?? 0,
      month_cost: Math.round(monthCost * 100) / 100,
    };
  }));

  const { data: plans } = await supabaseAdmin
    .from("plans")
    .select("slug,name,price_monthly")
    .eq("active", true)
    .order("sort_order");

  return NextResponse.json({
    data: enriched,
    templates: ORG_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description })),
    plans: plans ?? [],
  });
}

// POST — create a new enterprise org from a template
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  const ownerEmail = (body.owner_email as string | undefined)?.trim().toLowerCase();
  if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 });

  const tpl = getTemplate(body.template ?? "general");
  const slug = await uniqueSlug(name);

  // Resolve the entitlement plan: prefer an explicit plan_slug (e.g. the
  // intake's suggested plan), else match the plan_label to a plan name. Setting
  // plan_id gives the org its full feature entitlements immediately.
  const planSlug = (body.plan_slug as string | undefined)?.trim().toLowerCase();
  let planRow: { id: string; name: string } | null = null;
  if (planSlug) {
    const { data } = await supabaseAdmin.from("plans").select("id,name").eq("slug", planSlug).maybeSingle();
    planRow = (data as { id: string; name: string } | null) ?? null;
  } else if (body.plan_label) {
    const { data } = await supabaseAdmin.from("plans").select("id,name").ilike("name", (body.plan_label as string).trim()).maybeSingle();
    planRow = (data as { id: string; name: string } | null) ?? null;
  }
  const planLabel = (body.plan_label as string | undefined)?.trim() || planRow?.name || "Enterprise";

  // Admin-provisioned orgs start on a 14-day trial with full plan entitlements,
  // then must subscribe (the proxy locks expired non-Stripe trials). Pass
  // access_status: "comped" to grant free access indefinitely instead.
  const accessStatus = (body.access_status as string | undefined)?.trim() || "trialing";
  const trialEndsAt = accessStatus === "trialing"
    ? new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString()
    : null;

  const { data: org, error } = await supabaseAdmin.from("enterprise_orgs").insert({
    name, slug,
    industry: body.industry ?? tpl.industry ?? null,
    brand_color: tpl.brand_color,
    tagline: tpl.tagline || null,
    careers_intro: tpl.careers_intro || null,
    plan_label: planLabel,
    plan_id: planRow?.id ?? null,
    created_by: admin.userId,
    created_by_admin: admin.userId,
    admin_notes: body.admin_notes ?? null,
    contact_name: body.contact_name ?? null,
    contact_email: ownerEmail ?? null,
    contact_phone: body.contact_phone ?? null,
    status: "active",
    access_status: accessStatus,
    trial_ends_at: trialEndsAt,
    activated_at: new Date().toISOString(),
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Demo accounts: grant every add-on free so clients see the whole platform.
  if (body.grant_all_addons) {
    await supabaseAdmin.from("org_addons").insert(
      ["ai_interviews", "recruiting_agent", "sms_whatsapp", "white_label_plus"].map((addon_key) => ({
        org_id: org.id, addon_key, status: "active",
      })),
    ).then(() => {}, () => {});
  }

  // Email templates from the template
  if (tpl.email_templates.length) {
    await supabaseAdmin.from("enterprise_email_templates").insert(
      tpl.email_templates.map((t) => ({ org_id: org.id, trigger: t.trigger, subject: t.subject, body: t.body, active: true }))
    ).then(() => {}, () => {});
  }

  // Invite the owner (if email given) so they can claim the workspace
  let inviteUrl: string | null = null;
  if (ownerEmail) {
    const { data: inv } = await supabaseAdmin.from("enterprise_invitations")
      .insert({ org_id: org.id, email: ownerEmail, role: "owner", invited_by: admin.userId, token: inviteToken(slug) })
      .select("token").single();
    if (inv) {
      inviteUrl = `${APP_URL}/enterprise/invite/${inv.token}`;
      await resend.emails.send({
        from: "JobsAI <support@jobsai.work>",
        to: ownerEmail,
        subject: `Your ${name} workspace on JobsAI Enterprise is ready`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#2563eb">Welcome to JobsAI Enterprise</h2>
          <p>Your recruiting workspace for <strong>${name}</strong> has been set up. Click below to sign in and take ownership.</p>
          <div style="margin:24px 0"><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Open your workspace →</a></div>
          <p style="color:#888;font-size:13px">Getting started:</p>
          <ol style="color:#555;font-size:13px">${tpl.onboarding_steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        </div>`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ data: { org, onboarding_steps: tpl.onboarding_steps, invite_url: inviteUrl } }, { status: 201 });
}
