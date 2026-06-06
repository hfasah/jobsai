import { auth } from "@clerk/nextjs/server";

export async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false }> {
  const { userId } = await auth();
  if (!userId) return { ok: false };
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? { ok: true, userId } : { ok: false };
}
