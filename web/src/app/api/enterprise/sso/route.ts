import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_sso_configs")
    .select("id,sso_domain,enforce_sso,provider,status,status_message,idp_metadata_url,idp_entity_id,idp_sso_url,oidc_discovery_url,oidc_client_id,created_at,updated_at")
    .eq("org_id", org.id)
    .maybeSingle();

  // Generate SP metadata fields
  const sp = {
    entity_id: `${APP_URL}/sso/${org.slug}`,
    acs_url: `${APP_URL}/api/enterprise/sso/callback/${org.slug}`,
    sp_metadata_url: `${APP_URL}/api/enterprise/sso/metadata/${org.slug}`,
  };

  return NextResponse.json({ data, sp });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can configure SSO." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    sso_domain, enforce_sso, provider,
    idp_metadata_url, idp_entity_id, idp_sso_url, idp_certificate,
    oidc_discovery_url, oidc_client_id, oidc_client_secret,
    action,
  } = body;

  // Validate domain format
  if (sso_domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(sso_domain)) {
    return NextResponse.json({ error: "Invalid domain format (e.g. acme.com)" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("enterprise_sso_configs")
    .select("id,status")
    .eq("org_id", org.id)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    org_id: org.id,
    updated_at: new Date().toISOString(),
    ...(sso_domain !== undefined && { sso_domain }),
    ...(enforce_sso !== undefined && { enforce_sso }),
    ...(provider !== undefined && { provider }),
    ...(idp_metadata_url !== undefined && { idp_metadata_url }),
    ...(idp_entity_id !== undefined && { idp_entity_id }),
    ...(idp_sso_url !== undefined && { idp_sso_url }),
    ...(idp_certificate !== undefined && { idp_certificate }),
    ...(oidc_discovery_url !== undefined && { oidc_discovery_url }),
    ...(oidc_client_id !== undefined && { oidc_client_id }),
    ...(oidc_client_secret !== undefined && { oidc_client_secret }),
  };

  let record;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("enterprise_sso_configs")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    record = data;
  } else {
    if (!sso_domain || !provider) {
      return NextResponse.json({ error: "sso_domain and provider are required." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("enterprise_sso_configs")
      .insert({ ...payload, status: "pending" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    record = data;
  }

  // "request_activation" action: mark pending and email ops team
  if (action === "request_activation") {
    await supabaseAdmin
      .from("enterprise_sso_configs")
      .update({ status: "pending", status_message: "Activation requested. Our team will enable this within 1 business day." })
      .eq("id", record.id);

    await resend.emails.send({
      from: "JobsAI Platform <support@jobsai.work>",
      to: "everybrainai@gmail.com",
      subject: `[SSO Activation] ${org.name} — ${sso_domain ?? record.sso_domain}`,
      html: `<p>SSO activation requested for <strong>${org.name}</strong> (org ID: ${org.id})</p>
<p>Domain: <strong>${sso_domain ?? record.sso_domain}</strong><br>
Provider: <strong>${provider ?? record.provider}</strong><br>
Status: pending → needs Clerk Enterprise Connection</p>
<p>IdP Metadata URL: ${idp_metadata_url ?? record.idp_metadata_url ?? "not set"}</p>`,
    }).catch(console.error);

    return NextResponse.json({ data: { ...record, status: "pending", status_message: "Activation requested. Our team will enable this within 1 business day." } });
  }

  return NextResponse.json({ data: record });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove SSO." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  await supabaseAdmin.from("enterprise_sso_configs").delete().eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
