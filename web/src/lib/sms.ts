// Twilio SMS + WhatsApp helper
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_WHATSAPP_FROM

const BASE = "https://api.twilio.com/2010-04-01";

function twilioHeaders(): HeadersInit {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return {
    Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function isConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

async function sendTwilioMessage(from: string, to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`${BASE}/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: twilioHeaders(),
    body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Twilio error");
  return json as { sid: string; status: string };
}

export async function sendSMS(to: string, body: string) {
  if (!isConfigured()) throw new Error("SMS not configured (missing Twilio env vars)");
  const from = process.env.TWILIO_PHONE_NUMBER!;
  return sendTwilioMessage(from, to, body);
}

export async function sendWhatsApp(to: string, body: string) {
  if (!isConfigured() || !process.env.TWILIO_WHATSAPP_FROM) {
    throw new Error("WhatsApp not configured (missing TWILIO_WHATSAPP_FROM)");
  }
  const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  return sendTwilioMessage(from, toWa, body);
}

export function smsConfigured() {
  return isConfigured();
}
export function whatsappConfigured() {
  return isConfigured() && !!process.env.TWILIO_WHATSAPP_FROM;
}
