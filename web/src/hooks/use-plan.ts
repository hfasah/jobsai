"use client";

import { useEffect, useState } from "react";
import type { Plan } from "@/lib/billing";

interface PlanState {
  plan: Plan;
  loading: boolean;
}

// Simple module-level cache so components on the same page share one fetch
let cached: { plan: Plan; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({ plan: "free", loading: true });

  useEffect(() => {
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setState({ plan: cached.plan, loading: false });
      return;
    }
    fetch("/api/billing")
      .then((r) => r.json())
      .then((j) => {
        const plan = (j.data?.plan ?? "free") as Plan;
        cached = { plan, ts: Date.now() };
        setState({ plan, loading: false });
      })
      .catch(() => setState({ plan: "free", loading: false }));
  }, []);

  return state;
}

export function isPaidPlan(plan: Plan): boolean {
  return plan === "pro" || plan === "premium" || plan === "accelerator";
}
