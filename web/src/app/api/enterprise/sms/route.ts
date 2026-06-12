import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { sendSMS, sendWhatsApp, smsConfigured, whatsappConfigured } from "@/lib/sms";

export const maxDuration = 30;

// GET — check configuration status
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ sms: smsConfigured(), whatsapp: whatsappConfigured() });
}

// POST — send SMS or WhatsApp to one or many candidates
// body: { channel: "sms"|"whatsapp", appIds: string[], message: string }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const channel: "sms" | "whatsapp" = b.channel === "whatsapp" ? "whatsapp" : "sms";
  const appIds: string[] = Array.isArray(b.appIds) ? b.appIds : [];
  const message: string = (b.message ?? "").trim();

  if (!appIds.length) return NextResponse.json({ error: "No recipients." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message required." }, { status: 400 });

  if (channel === "sms" && !smsConfigured()) {
    return NextResponse.json({ error: "SMS not configured. Add TWILIO_* env vars." }, { status: 422 });
  }
  if (channel === "whatsapp" && !whatsappConfigured()) {
    return NextResponse.json({ error: "WhatsApp not configured. Add TWILIO_WHATSAPP_FROM." }, { status: 422 });
  }

  // Fetch applications + phone numbers
  const { data: apps, error: appErr } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_email,candidate_phone,job_id")
    .in("id", appIds)
    .eq("org_id", org.id);

  if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 });

  const results: { id: string; name: string; status: "sent" | "failed"; error?: string }[] = [];

  for (const app of apps ?? []) {
    const phone = (app as Record<string, unknown>).candidate_phone as string | null;
    if (!phone) {
      results.push({ id: app.id, name: app.candidate_name, status: "failed", error: "No phone number" });
      continue;
    }

    try {
      if (channel === "whatsapp") {
        await sendWhatsApp(phone, message);
      } else {
        await sendSMS(phone, message);
      }

      // Log the outreach
      await supabaseAdmin.from("enterprise_outreach_log").insert({
        org_id: org.id,
        application_id: app.id,
        job_id: (app as Record<string, unknown>).job_id ?? null,
        channel,
        message,
        sent_by: userId,
        sent_at: new Date().toISOString(),
      }).single();

      results.push({ id: app.id, name: app.candidate_name, status: "sent" });
    } catch (e) {
      results.push({ id: app.id, name: app.candidate_name, status: "failed", error: (e as Error).message });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return NextResponse.json({ results, sent, total: results.length });
}
