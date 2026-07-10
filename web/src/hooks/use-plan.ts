"use client";

import { useEffect, useState } from "react";
import type { Plan } from "@/lib/billing";

interface PlanState {
  plan: Plan;
  /** Current token balance — lets components unlock token-metered features. */
  balance: number;
  loading: boolean;
}

// Simple module-level cache so components on the same page share one fetch
let cached: { plan: Plan; balance: number; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({ plan: "free", balance: 0, loading: true });

  useEffect(() => {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setState({ plan: cached.plan, balance: cached.balance, loading: false });
      return;
    }
    fetch("/api/billing")
      .then((r) => r.json())
      .then((j) => {
        const plan = (j.data?.plan ?? "free") as Plan;
        const balance = Number(j.data?.balance ?? 0);
        cached = { plan, balance, ts: Date.now() };
        setState({ plan, balance, loading: false });
      })
      .catch(() => setState({ plan: "free", balance: 0, loading: false }));
  }, []);

  return state;
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === "pro" || plan === "premium" || plan === "accelerator";
}
