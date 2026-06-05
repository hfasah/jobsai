import { supabaseAdmin } from "@/lib/supabase";

export type NotificationType =
  | "auto_applied"
  | "manual_required"
  | "high_match"
  | "discovery_summary"
  | "plan_upgraded"
  | "pending_approval"
  | "interview"
  | "auto_replied";

// Fire-and-forget — never throws, never blocks the caller
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabaseAdmin.from("user_notifications").insert({
      user_id: userId,
      type,
      title,
      body,
      metadata,
    });
  } catch (err) {
    console.error("createNotification failed:", err);
  }
}
