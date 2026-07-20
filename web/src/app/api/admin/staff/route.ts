import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm, adminAudit, type AdminRole } from "@/lib/admin";
import { ROLE_LABELS } from "@/lib/admin-perms";
import { sendStaffAccessEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const ROLES: AdminRole[] = ["super_admin", "support_agent", "support_lead", "analyst", "sales"];

// GET /api/admin/staff — roster (env super admins shown read-only)
export async function GET() {
  const ctx = await requireAdminPerm("staff.manage");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: staff, error } = await supabaseAdmin
    .from("admin_staff")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const envSuperIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return NextResponse.json({ staff: staff ?? [], env_super_ids: envSuperIds });
}

// POST /api/admin/staff — add a staff member by email
// Body: { email, role, overrides?, grant_cap_daily? }
export async function POST(req: NextRequest) {
  const ctx = await requireAdminPerm("staff.manage");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role as AdminRole;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });

  // The person must already have a JobsAI login — we key staff by Clerk id.
  const client = await clerkClient();
  const matches = await client.users.getUserList({ emailAddress: [email] });
  const target = matches.data[0];
  if (!target) {
    return NextResponse.json({ error: "No account with that email. Ask them to sign up at app.jobsai.work first, then add them." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("admin_staff").upsert({
    user_id: target.id,
    email,
    display_name: [target.firstName, target.lastName].filter(Boolean).join(" ") || null,
    role,
    overrides: body.overrides && typeof body.overrides === "object" ? body.overrides : {},
    grant_cap_daily: Number.isInteger(body.grant_cap_daily) && body.grant_cap_daily > 0 ? body.grant_cap_daily : null,
    active: true,
    created_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminAudit(ctx, "staff.add", { type: "staff", id: target.id }, { email, role });

  // Tell them they're in — which role, and where to sign in. Awaited (never
  // fire-and-forget on serverless) but non-fatal: access exists either way.
  let adderEmail: string | null = null;
  try {
    const adder = await client.users.getUser(ctx.userId);
    adderEmail = adder.emailAddresses[0]?.emailAddress ?? null;
  } catch { /* non-fatal */ }
  await sendStaffAccessEmail({
    to: email,
    firstName: target.firstName,
    roleLabel: ROLE_LABELS[role],
    addedByEmail: adderEmail,
  }).catch((e) => console.error("[staff] access email failed:", e));

  return NextResponse.json({ ok: true, user_id: target.id, email_sent: true });
}

// PUT /api/admin/staff — resend the access notification email. Body: { user_id }
export async function PUT(req: NextRequest) {
  const ctx = await requireAdminPerm("staff.manage");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id ?? "");
  if (!userId) return NextResponse.json({ error: "user_id required." }, { status: 400 });

  const { data: row, error } = await supabaseAdmin
    .from("admin_staff")
    .select("email, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  if (!row.active) return NextResponse.json({ error: "This member is deactivated — reactivate before resending." }, { status: 400 });

  const client = await clerkClient();
  const [target, adder] = await Promise.all([
    client.users.getUser(userId).catch(() => null),
    client.users.getUser(ctx.userId).catch(() => null),
  ]);

  await sendStaffAccessEmail({
    to: row.email,
    firstName: target?.firstName ?? null,
    roleLabel: ROLE_LABELS[row.role as AdminRole] ?? row.role,
    addedByEmail: adder?.emailAddresses[0]?.emailAddress ?? null,
  });

  await adminAudit(ctx, "staff.notify_resend", { type: "staff", id: userId }, { email: row.email });
  return NextResponse.json({ ok: true });
}

// PATCH /api/admin/staff — update role / overrides / cap / active
// Body: { user_id, role?, overrides?, grant_cap_daily?, active? }
export async function PATCH(req: NextRequest) {
  const ctx = await requireAdminPerm("staff.manage");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id ?? "");
  if (!userId) return NextResponse.json({ error: "user_id required." }, { status: 400 });
  if (userId === ctx.userId) return NextResponse.json({ error: "You can't edit your own access." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
    patch.role = body.role;
  }
  if (body.overrides !== undefined && typeof body.overrides === "object") patch.overrides = body.overrides ?? {};
  if (body.grant_cap_daily !== undefined) patch.grant_cap_daily = Number.isInteger(body.grant_cap_daily) && body.grant_cap_daily > 0 ? body.grant_cap_daily : null;
  if (body.active !== undefined) patch.active = Boolean(body.active);

  const { error } = await supabaseAdmin.from("admin_staff").update(patch).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminAudit(ctx, "staff.update", { type: "staff", id: userId }, patch);
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/staff — remove from roster entirely. Body: { user_id }
export async function DELETE(req: NextRequest) {
  const ctx = await requireAdminPerm("staff.manage");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id ?? "");
  if (!userId) return NextResponse.json({ error: "user_id required." }, { status: 400 });
  if (userId === ctx.userId) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });

  const { error } = await supabaseAdmin.from("admin_staff").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminAudit(ctx, "staff.remove", { type: "staff", id: userId });
  return NextResponse.json({ ok: true });
}
