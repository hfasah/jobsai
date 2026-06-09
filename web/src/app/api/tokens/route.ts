import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTokenAccount, TOKEN_COSTS, TOKEN_PACKS } from "@/lib/tokens";

// GET /api/tokens — current balance, plan grant, cost table, and top-up packs.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getTokenAccount(userId);
  return NextResponse.json({
    data: {
      balance: account.balance,
      grant_balance: account.grant_balance,
      topup_balance: account.topup_balance,
      monthly_grant: account.monthly_grant,
      plan: account.plan,
      costs: TOKEN_COSTS,
      packs: TOKEN_PACKS,
    },
  });
}
