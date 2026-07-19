import { supabaseAdmin } from "@/lib/supabase";
import { addTokens, TOKEN_COSTS } from "@/lib/tokens";
import { createNotification } from "@/lib/notifications";

// ─── Auto-apply charge settlement ─────────────────────────────────────────────
// Principle: an auto_apply charge (600 credits) is only EARNED when an
// application was actually submitted. Several paths can strand a charge on a
// non-submitted outcome (the attempt ends manual_required after the charge, a
// failed run whose refund never fired, a flip-to-pending that never resolved).
// Rather than patching each branch, this sweep settles the ledger against the
// attempts table and refunds whatever is owed.
//
// Born from a real chargeback: a customer was charged 600 × ~25 for applies
// that mostly ended "Manual required", was told (incorrectly) nothing was
// consumed, and disputed the payment. This sweep makes that class of complaint
// structurally impossible.
//
// Idempotent: refunds only (deducts − existing refunds) per (user, job), so
// re-running never double-credits, and refunds issued by other paths (launch
// failure, finalize) are counted.

export interface ReconcileSummary {
  jobs_scanned: number;
  jobs_refunded: number;
  credits_refunded: number;
}

export async function refundStrandedAutoApplies(
  opts: { olderThanMinutes?: number; windowDays?: number; limit?: number } = {},
): Promise<ReconcileSummary> {
  // Only settle charges old enough that in-flight runs have finished (the
  // stuck-pending reconciler handles anything still unresolved after that).
  const olderThan = new Date(Date.now() - (opts.olderThanMinutes ?? 120) * 60_000).toISOString();
  const since = new Date(Date.now() - (opts.windowDays ?? 30) * 86_400_000).toISOString();

  const { data: charges, error } = await supabaseAdmin
    .from("token_ledger")
    .select("user_id, delta, metadata, created_at")
    .eq("reason", "auto_apply")
    .lt("delta", 0)
    .gte("created_at", since)
    .lte("created_at", olderThan)
    .order("created_at", { ascending: true })
    .limit(opts.limit ?? 1000);
  if (error) {
    console.error("[apply-reconcile] charge query failed:", error.message);
    return { jobs_scanned: 0, jobs_refunded: 0, credits_refunded: 0 };
  }

  // Deduct counts per (user, job).
  const byKey = new Map<string, { userId: string; jobId: string; deducts: number }>();
  for (const c of charges ?? []) {
    const jobId = (c.metadata as { job_id?: string } | null)?.job_id;
    if (!jobId) continue;
    const key = `${c.user_id}|${jobId}`;
    const entry = byKey.get(key) ?? { userId: c.user_id as string, jobId, deducts: 0 };
    entry.deducts += 1;
    byKey.set(key, entry);
  }

  const summary: ReconcileSummary = { jobs_scanned: byKey.size, jobs_refunded: 0, credits_refunded: 0 };

  for (const { userId, jobId, deducts } of byKey.values()) {
    try {
      // Final state of the job's application attempt. submitted = charge
      // earned; pending = still in flight — leave for the stuck reconciler.
      const { data: attempt } = await supabaseAdmin
        .from("apply_attempts")
        .select("status")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const status = (attempt as { status?: string } | null)?.status ?? "unknown";
      if (status === "submitted" || status === "pending") continue;

      // Refunds already issued for this job (any source: launch failure,
      // finalize, previous sweep).
      const { count: refunds, error: refundErr } = await supabaseAdmin
        .from("token_ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reason", "auto_apply_refund")
        .contains("metadata", { job_id: jobId });
      if (refundErr) {
        console.error("[apply-reconcile] refund lookup failed:", refundErr.message);
        continue;
      }

      const owed = deducts - (refunds ?? 0);
      if (owed <= 0) continue;

      const amount = owed * TOKEN_COSTS.auto_apply;
      await addTokens(userId, amount, "auto_apply_refund", {
        job_id: jobId,
        source: "reconcile",
        attempts_refunded: owed,
        attempt_status: status,
      });
      createNotification(
        userId,
        "agent_apply_failed",
        "Credits refunded",
        `${amount.toLocaleString()} credits were refunded — ${owed === 1 ? "an application" : `${owed} applications`} couldn't be submitted automatically (${status === "manual_required" ? "the job board requires manual submission; your tailored resume and cover letter are ready" : "the run didn't complete"}). You're only charged when an application actually goes through.`,
        { job_id: jobId, refunded: amount },
      ).catch(() => {});
      summary.jobs_refunded += 1;
      summary.credits_refunded += amount;
    } catch (e) {
      console.error("[apply-reconcile] settle failed for job:", jobId, e);
    }
  }

  if (summary.jobs_refunded > 0) console.log("[apply-reconcile]", summary);
  return summary;
}
