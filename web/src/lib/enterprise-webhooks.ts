import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export type WebhookEventType =
  | "application.created"
  | "application.stage_changed"
  | "application.hired"
  | "interview.scheduled"
  | "offer.sent";

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  created_at: string;
  org_id: string;
  data: Record<string, unknown>;
}

export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString("base64url")}`;
}

function sign(secret: string, body: string): string {
  const raw = secret.replace(/^whsec_/, "");
  const key = Buffer.from(raw, "base64");
  return `sha256=${crypto.createHmac("sha256", key).update(body).digest("hex")}`;
}

export async function sendWebhookEvent(
  orgId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const { data: endpoints } = await supabaseAdmin
    .from("enterprise_webhooks")
    .select("id, url, secret")
    .eq("org_id", orgId)
    .eq("active", true);

  if (!endpoints?.length) return;

  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    created_at: new Date().toISOString(),
    org_id: orgId,
    data,
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const sig = sign(ep.secret as string, body);
      try {
        await fetch(ep.url as string, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-JobsAI-Signature": sig,
            "X-JobsAI-Event": event,
            "X-JobsAI-Delivery": payload.id,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // fire-and-forget; endpoint unreachable → silently skip
      }
    })
  );
}
