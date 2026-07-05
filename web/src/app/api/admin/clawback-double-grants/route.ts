import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deductTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Users we NEVER claw back from, no matter what the caller passes. Thomas Bianco
// surfaced the calendar-month grant leak (PR #268) — grandfathered as a thank-you.
const ALWAYS_GRANDFATHER = ["tom.bianco@gmail.com"];

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { userId } = await auth();
  if (!userId) return false;
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
}

// Resolve a set of email addresses to Clerk user IDs (for exclusion).
async function resolveEmailsToUserIds(emails: string[]): Promise<string[]> {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return [];
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ emailAddress: clean, limit: 200 });
    return res.data.map((u) => u.id);
  } catch (err) {
    console.error("[clawback] email resolution failed:", err);
    return [];
  }
}

// A recurring grant is only legitimate once a full calendar month has elapsed
// since the prior grant. The old sameMonth() check double-granted anyone who
// signed up before month-end. This mirrors monthlyGrantDue() in lib/tokens.ts.
function grantWasEarly(prev: Date, grant: Date): boolean {
  const due = new Date(prev);
  due.setUTCMonth(due.getUTCMonth() + 1);
  return grant < due;
}

interface GrantRow {
  user_id: string;
  delta: number;
  reason: string;
  created_at: string;
}

interface UserResult {
  user_id: string;
  erroneous_grants: number;
  clawed_credits: number;
}

// One-time (idempotent) remediation: reverse monthly_grant ledger entries that
// DUPLICATED the current allowance (same amount as the prior grant) and fired
// BEFORE a full month had elapsed — the calendar-month leak fixed in PR #268.
// Plan-UPGRADE grants (a different, higher amount) are legit and never touched.
// Reads the SHARED Supabase. GET = dry-run preview (no charges); POST = execute.
async function run(req: NextRequest, dryRun: boolean) {
  // Build the exclusion set: always-grandfather list + any extra ?exclude_emails.
  const extra = (new URL(req.url).searchParams.get("exclude_emails") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const excludeUserIds = new Set(
    await resolveEmailsToUserIds([...ALWAYS_GRANDFATHER, ...extra])
  );

  // Every grant ledger entry, oldest first, so we can measure each monthly grant
  // against the one before it per user.
  const { data: rows, error } = await supabaseAdmin
    .from("token_ledger")
    .select("user_id, delta, reason, created_at")
    .in("reason", ["signup_grant", "monthly_grant"])
    .order("user_id", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(50000);
  if (error) return { error: error.message };

  // Existing clawbacks → idempotency (skip a grant we've already reversed).
  const { data: prior } = await supabaseAdmin
    .from("token_ledger")
    .select("user_id, metadata")
    .eq("reason", "monthly_grant_clawback")
    .limit(50000);
  const alreadyClawed = new Set(
    (prior ?? []).map((r) => `${r.user_id}::${(r.metadata as { erroneous_at?: string })?.erroneous_at ?? ""}`)
  );

  // Group grants by user (rows are already ordered by user_id, created_at).
  const byUser = new Map<string, GrantRow[]>();
  for (const r of (rows ?? []) as GrantRow[]) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const results: UserResult[] = [];
  let erroneousTotal = 0;
  let cappedNote = 0; // # of grants where balance couldn't cover the full claw-back

  for (const [userId, grants] of byUser) {
    if (excludeUserIds.has(userId)) continue;

    // Find this user's erroneous calendar-month grants. A grant is the bug ONLY
    // if it DUPLICATES the current allowance — i.e. a monthly_grant of the SAME
    // amount as the prior legit grant, fired < 1 month after it. A grant with a
    // DIFFERENT amount is a plan UPGRADE (new higher allowance) and is legit, so
    // it must never be clawed back. `baseline` tracks the last legit grant and
    // only advances on legit grants, so a duplicate doesn't reset the clock.
    const early: GrantRow[] = [];
    let baseline = grants[0]; // earliest grant (signup) is always legit
    for (let i = 1; i < grants.length; i++) {
      const g = grants[i];
      const sameAllowance = g.delta === baseline.delta;
      const tooSoon = grantWasEarly(new Date(baseline.created_at), new Date(g.created_at));
      if (g.reason === "monthly_grant" && sameAllowance && tooSoon) {
        if (!alreadyClawed.has(`${userId}::${g.created_at}`)) early.push(g);
        // erroneous duplicate → do NOT advance the baseline
      } else {
        baseline = g; // legit grant (upgrade or a real monthly) → new baseline
      }
    }
    if (early.length === 0) continue;

    // Current balance caps what we can claw back (never push a user negative).
    const { data: acct } = await supabaseAdmin
      .from("user_tokens").select("balance").eq("user_id", userId).maybeSingle();
    let balance = (acct?.balance as number) ?? 0;

    let userClawed = 0;
    let userCount = 0;
    for (const g of early) {
      const claw = Math.min(g.delta, balance);
      if (claw <= 0) { cappedNote++; continue; }
      if (claw < g.delta) cappedNote++;
      if (!dryRun) {
        const res = await deductTokens(userId, claw, "monthly_grant_clawback", {
          erroneous_at: g.created_at,
          granted: g.delta,
          clawed: claw,
          note: "calendar-month double-grant reversal (PR #268)",
        }).catch(() => ({ ok: false }));
        if (!("ok" in res) || !res.ok) continue;
      }
      balance -= claw;
      userClawed += claw;
      userCount++;
      erroneousTotal += claw;
    }
    if (userCount > 0) results.push({ user_id: userId, erroneous_grants: userCount, clawed_credits: userClawed });
  }

  results.sort((a, b) => b.clawed_credits - a.clawed_credits);
  return {
    dryRun,
    users_scanned: byUser.size,
    grandfathered: excludeUserIds.size,
    users_affected: results.length,
    grants_reversed: results.reduce((s, r) => s + r.erroneous_grants, 0),
    credits_clawed_back: erroneousTotal,
    partial_capped: cappedNote,
    per_user: results.slice(0, 200),
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(req, true));
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(req, false));
}
